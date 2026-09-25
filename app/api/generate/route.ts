import OpenAI from "openai";
import {
  buildSystemPrompt,
  buildUserContent,
  SLIDES_OUTPUT_SCHEMA,
  ADD_OUTPUT_SCHEMA,
  PAGES_OUTPUT_SCHEMA,
  ADD_PAGES_OUTPUT_SCHEMA,
  type GenerateBody,
} from "@/lib/slides/prompt";
import type { DeckFormat } from "@/lib/slides/state";
import { SlideStreamParser } from "@/lib/slides/parse";
import { sanitizeAttachments } from "@/lib/slides/attachments-server";
import { fetchLinkedPages } from "@/lib/slides/links-server";
import { languageOf } from "@/lib/slides/brief";
import { cleanVoice } from "@/lib/slides/voice";

export const runtime = "nodejs";

/**
 * GPT-6 Luna (Mario's call, 25 Sep 2026, in place of claude-haiku-4-5): the
 * fast model of the GPT-6 series, about a tenth of Haiku's price. The job is
 * the same constrained one, so reasoning is off: the schema and the catalog
 * do the constraining, and thinking tokens would only add latency and cost.
 */
const MODEL = "gpt-6-luna";
/**
 * Both prompts are built once at module load: nothing per-request may go in
 * here (that is what the user message is for), and building two strings costs
 * nothing while keeping the slide path byte-identical.
 */
const SYSTEM_PROMPTS: Record<DeckFormat, string> = {
  slides: buildSystemPrompt("slides"),
  "two-pager": buildSystemPrompt("two-pager"),
};

/** The schema requires every field, so unused ones arrive as ""/[] — drop them. */
function stripEmptyFields(slide: unknown): unknown {
  if (typeof slide !== "object" || slide === null) return slide;
  return Object.fromEntries(
    Object.entries(slide).filter(([, v]) => v !== "" && !(Array.isArray(v) && v.length === 0)),
  );
}

/**
 * The same job one level down, for a page: `stripEmptyFields` only looks at
 * the top level, which would leave every block carrying rail:"" and every
 * item carrying extra:"". Kept separate rather than made recursive so the
 * slide path stays exactly as it was.
 */
function stripEmptyPage(page: unknown): unknown {
  if (typeof page !== "object" || page === null) return page;
  const p = page as { blocks?: unknown[] };
  const blocks = Array.isArray(p.blocks)
    ? p.blocks.map((b) => {
        const block = stripEmptyFields(b) as { items?: unknown[] };
        if (Array.isArray(block.items)) block.items = block.items.map(stripEmptyFields);
        return block;
      })
    : [];
  return { ...(stripEmptyFields(page) as Record<string, unknown>), blocks };
}

/** Plain language for the user; the status and the API's own words stay for the console. */
function describeError(err: unknown): string {
  if (err instanceof OpenAI.AuthenticationError) return "Invalid OPENAI_API_KEY";
  if (err instanceof OpenAI.RateLimitError) return "Rate limited by the OpenAI API. Wait a moment and retry.";
  if (err instanceof OpenAI.APIError) {
    const overloaded = err.status === 503 || err.code === "server_is_overloaded" || /overloaded/i.test(err.message);
    return overloaded
      ? "The AI service is momentarily overloaded (this is on OpenAI's side, not your prompt). Try again in a few seconds."
      : `OpenAI API error (${err.status ?? "network"}): ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return "Generation failed";
}

// The output schema cannot pin the slide count (minItems is not part of the
// strict subset either). A short deck is topped up client-side instead, see
// onGenerate in app/page.tsx.
export async function POST(request: Request): Promise<Response> {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  // Everything in the body is client input; attachments are re-validated
  // here (count, size, media types) before they reach the model.
  const attachments = sanitizeAttachments(body.attachments);
  if (typeof attachments === "string") return new Response(attachments, { status: 400 });
  // Pages the brief links to travel like text attachments (public http(s)
  // only, three at most, a failed fetch is skipped). Not for regenerate: one
  // slide's rewrite does not need the whole page again.
  const oneSlide = body.mode === "regenerate";
  const linked = oneSlide ? [] : await fetchLinkedPages(body.brief ?? "");
  body = { ...body, attachments: [...attachments, ...linked], language: languageOf(body.brief ?? "") };
  if (!body.brief?.trim() && !oneSlide) {
    if (attachments.length === 0) return new Response("Missing brief", { status: 400 });
    body.brief = "Build it from the attached material.";
  }
  if (!process.env.OPENAI_API_KEY) {
    return new Response("OPENAI_API_KEY is not configured", { status: 500 });
  }

  // 4 retries (default 2): rides out transient 503 "overloaded" spikes
  const client = new OpenAI({ maxRetries: 4 });
  const isAdd = body.mode === "add";
  const twoPager = body.format === "two-pager";
  // The count is the brief's when it names one, else the biggest reasonable
  // deck; add/regenerate keep count-driven budgets.
  // With `perItem` the named count is the items, and the cover and the
  // closing slide come on top of it.
  const named = typeof body.count === "number" ? body.count + (body.perItem ? 2 : 0) : 20;
  const count = body.mode === "regenerate" ? 1 : Math.min(Math.max(named, 1), 22);
  // Add mode carries extra output (insertAfter + refreshed agenda bullets).
  // Every slide carries all its required fields, so a content-heavy slide (a
  // PDF behind it) costs 400-700 tokens: 650 keeps twenty of them under the
  // ceiling. An A4 page of text is worth about four slides. The stream
  // reports truncation and the client shows it, but the parser never emits a
  // slide cut in half, so the budget has to be honest.
  const perItem = twoPager ? 1600 : 650;
  const maxTokens = Math.min(800 + perItem * count + (isAdd ? 400 : 0), 20000);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const parser = new SlideStreamParser();
      let index = 0;
      let raw = "";
      let refusal = "";
      try {
        const schema = twoPager
          ? isAdd
            ? ADD_PAGES_OUTPUT_SCHEMA
            : PAGES_OUTPUT_SCHEMA
          : isAdd
            ? ADD_OUTPUT_SCHEMA
            : SLIDES_OUTPUT_SCHEMA;
        const events = await client.responses.create({
          model: MODEL,
          instructions: SYSTEM_PROMPTS[twoPager ? "two-pager" : "slides"],
          input: [{ role: "user", content: buildUserContent(body) }],
          text: {
            format: {
              type: "json_schema",
              name: twoPager ? "pages" : "slides",
              schema: schema as unknown as Record<string, unknown>,
              strict: true,
            },
          },
          reasoning: { effort: "none" },
          max_output_tokens: maxTokens,
          stream: true,
        });

        let stopReason = "stop";
        let usage = { inputTokens: 0, outputTokens: 0 };
        for await (const event of events) {
          if (event.type === "response.output_text.delta") {
            raw += event.delta;
            for (const slide of parser.feed(event.delta)) {
              send({
                type: "slide",
                index: index++,
                slide: cleanVoice(twoPager ? stripEmptyPage(slide) : stripEmptyFields(slide), body.brief ?? ""),
              });
            }
          } else if (event.type === "response.refusal.delta") {
            refusal += event.delta;
          } else if (event.type === "response.completed" || event.type === "response.incomplete") {
            const r = event.response;
            // The one truncation the client must hear about is the token
            // budget; anything else incomplete surfaces as its own reason.
            stopReason = event.type === "response.incomplete" ? (r.incomplete_details?.reason ?? "incomplete") : "stop";
            usage = { inputTokens: r.usage?.input_tokens ?? 0, outputTokens: r.usage?.output_tokens ?? 0 };
          } else if (event.type === "response.failed") {
            throw new Error(event.response.error?.message ?? "The model returned no response");
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
        if (refusal) throw new Error(`The model declined this brief: ${refusal}`);

        if (twoPager && isAdd) {
          try {
            const parsed = JSON.parse(raw) as { insertAfter?: number };
            send({ type: "meta", insertAfter: parsed.insertAfter });
          } catch {
            // truncated output — the client falls back to appending at the end
          }
        } else if (isAdd) {
          try {
            const parsed = JSON.parse(raw) as { insertAfter?: number; agenda?: string[] };
            send({ type: "meta", insertAfter: parsed.insertAfter, agenda: parsed.agenda });
          } catch {
            // truncated output — the client falls back to appending at the end
          }
        }
        send({
          type: "done",
          stopReason,
          truncated: stopReason === "max_output_tokens",
          usage,
        });
      } catch (err) {
        send({ type: "error", message: describeError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
