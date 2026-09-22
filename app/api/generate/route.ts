import Anthropic from "@anthropic-ai/sdk";
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

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
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

// The output schema cannot pin the slide count: the API accepts minItems of
// 0 or 1 only (tried 22 Sep 2026). A short deck is topped up client-side
// instead, see onGenerate in app/page.tsx.
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
  const linked = body.mode === "regenerate" ? [] : await fetchLinkedPages(body.brief ?? "");
  body = { ...body, attachments: [...attachments, ...linked] };
  if (!body.brief?.trim() && body.mode !== "regenerate") {
    if (attachments.length === 0) return new Response("Missing brief", { status: 400 });
    body.brief = "Build it from the attached material.";
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY is not configured", { status: 500 });
  }

  // 4 retries (default 2): rides out transient 529 "overloaded" spikes
  const client = new Anthropic({ maxRetries: 4 });
  const isAdd = body.mode === "add";
  const twoPager = body.format === "two-pager";
  // The count is the brief's when it names one, else the biggest reasonable
  // deck; add/regenerate keep count-driven budgets.
  // With `perItem` the named count is the items, and the cover and the
  // closing slide come on top of it.
  const named = typeof body.count === "number" ? body.count + (body.perItem ? 2 : 0) : 20;
  const count = body.mode === "regenerate" ? 1 : Math.min(Math.max(named, 1), 22);
  // Add mode carries extra output (insertAfter + refreshed agenda bullets).
  // Every slide carries all thirteen required fields, so a content-heavy
  // slide (a PDF behind it) costs 400-700 tokens: 650 keeps twenty of them
  // under the ceiling. An A4 page of text is worth about four slides. The
  // stream reports truncation and the client shows it, but the parser never
  // emits a slide cut in half, so the budget has to be honest.
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
      try {
        const messageStream = client.messages.stream({
          model: MODEL,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPTS[twoPager ? "two-pager" : "slides"],
          output_config: {
            format: {
              type: "json_schema",
              schema: twoPager
                ? isAdd
                  ? ADD_PAGES_OUTPUT_SCHEMA
                  : PAGES_OUTPUT_SCHEMA
                : isAdd
                  ? ADD_OUTPUT_SCHEMA
                  : SLIDES_OUTPUT_SCHEMA,
            },
          },
          messages: [{ role: "user", content: buildUserContent(body) }],
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            raw += event.delta.text;
            for (const slide of parser.feed(event.delta.text)) {
              send({
                type: "slide",
                index: index++,
                slide: twoPager ? stripEmptyPage(slide) : stripEmptyFields(slide),
              });
            }
          }
        }

        const final = await messageStream.finalMessage();
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
          stopReason: final.stop_reason,
          truncated: final.stop_reason === "max_tokens",
          usage: {
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
          },
        });
      } catch (err) {
        let message = "Generation failed";
        if (err instanceof Anthropic.AuthenticationError) {
          message = "Invalid ANTHROPIC_API_KEY";
        } else if (err instanceof Anthropic.RateLimitError) {
          message = "Rate limited by the Anthropic API. Wait a moment and retry.";
        } else if (err instanceof Anthropic.APIError) {
          message =
            err.status === 529 || /overloaded/i.test(err.message)
              ? "The AI service is momentarily overloaded (this is on Anthropic's side, not your prompt). Try again in a few seconds."
              : `Anthropic API error (${err.status ?? "network"}): ${err.message}`;
        } else if (err instanceof Error) {
          message = err.message;
        }
        send({ type: "error", message });
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
