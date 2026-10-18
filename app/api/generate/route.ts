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
import { languageOf, MAX_SLIDES } from "@/lib/slides/brief";
import { cleanVoice } from "@/lib/slides/voice";
import { yearTimelineMonths } from "@/lib/slides/rhythm";
import { kbBackground, kbLive } from "@/lib/slides/kb";
import { checkFigures, indexSources, type Source } from "@/lib/slides/provenance";
import { attribute } from "@/lib/slides/attribution";
import { GIGA_FACTS } from "@/lib/slides/giga-facts";

/** The request's sources, each with what a footnote would call it. */
function sourcesOf(body: GenerateBody): Source[] {
  const out: Source[] = [
    { label: "the brief", text: body.brief ?? "", own: true, kind: "brief" },
    { label: "your answers", text: body.briefNotes ?? "", own: true, kind: "answers" },
    ...GIGA_FACTS.map((f) => ({ label: f.source.replace(/^https?:\/\//, "").replace(/\/$/, ""), text: f.fact, date: f.verified, url: /^https?:/.test(f.source) ? f.source : `https://${f.source}/`, own: false, kind: "facts" as const })),
    // A replica's source is the file it rebuilds.
    ...(body.source ? [{ label: "the source file", text: body.source, own: true, kind: "replica" as const }] : []),
  ];
  for (const a of body.attachments ?? []) {
    if (a.kind !== "text") continue;
    if (a.background) {
      // One knowledge-base attachment holds several pages: "# title (Source, url, read date)".
      for (const part of a.text.split(/\n(?=# )/)) {
        const head = /^# (.*?) \((?:[^,]*), (https?:\/\/[^,]+), read (\d{4}-\d{2}-\d{2})\)/.exec(part);
        out.push({ label: head ? new URL(head[2]).host.replace(/^www\./, "") : "knowledge base", text: part, date: head?.[3], url: head?.[2], own: false, kind: "kb", title: head?.[1] });
      }
    } else if (/^https?:\/\//.test(a.name)) out.push({ label: new URL(a.name).host.replace(/^www\./, ""), text: a.text, date: a.published, url: a.name, own: false, kind: "page" });
    else out.push({ label: a.name, text: a.text, own: true, kind: "file" });
  }
  return out;
}
import type { Attachment } from "@/lib/slides/attachments";
import { materialScore, SCARCE_MATERIAL } from "@/lib/slides/brief";

/** The knowledge base for this request: scarce material, or the user's files beside it (Mario, 13 Oct 2026). */
/**
 * The knowledge base is not live yet (Mario, 13 Oct 2026: it did not pass the
 * quality gate; it ships when a fair measure says it helps). Off, it adds nothing.
 */
const KB_LIVE = kbLive();

function background(body: GenerateBody, given: Attachment[]): Attachment[] {
  if (!KB_LIVE) return [];
  const brief = body.brief ?? "";
  const attachedChars = given.reduce((n, a) => n + (a.kind === "text" ? a.text.length : a.kind === "pdf" ? 20_000 : 2_000), 0);
  // Answered slots ("Purpose: … The ask: …"), or any answer given.
  const notes = body.briefNotes ?? "";
  const answered = (notes.match(/\b(Purpose|Facts|The ask|Audience):/g) ?? []).length || (notes.trim() ? 1 : 0);
  const scarce = materialScore(brief, { attachedChars, answered }) < SCARCE_MATERIAL;
  const kb = kbBackground(`${brief} ${notes}`, { scarce, withFiles: given.length > 0 });
  return kb ? [kb] : [];
}
import type { SlideContent } from "@/lib/slides/schema";
import { LANG_NAMES } from "@/lib/slides/i18n";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GPT-6 Luna (Mario's call, 25 Sep 2026, in place of claude-haiku-4-5): the
 * fast model of the GPT-6 series, about a tenth of Haiku's price. The job is
 * the same constrained one, so reasoning is off: the schema and the catalog
 * do the constraining, and thinking tokens would only add latency and cost.
 */
const MODEL = "gpt-6-luna";
/** No token for this long, or this long in all, and the stream is cut. */
const IDLE_MS = 60_000;
// A forty-slide deck is about 32k output tokens: the whole stream has to fit
// under the function limit below, with a margin to close it cleanly.
const TOTAL_MS = 285_000;
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
  // A replicated slide is one slide from its own source text: no links, no files.
  const oneSlide = body.mode === "regenerate" || body.mode === "replicate";
  const linked = oneSlide ? [] : await fetchLinkedPages(body.brief ?? "");
  body = {
    ...body,
    // The knowledge base as background when the material is scarce or files sit beside it (lib/slides/kb.ts), never on a replica or a rewrite.
    attachments: [...attachments, ...linked, ...(oneSlide || body.source ? [] : background(body, [...attachments, ...linked]))],
    // A replicated slide keeps the source's language, whatever the brief's.
    // The deck's language once it has been switched (lib/slides/i18n.ts), else the brief's.
    language:
      typeof body.outputLanguage === "string" && Object.values(LANG_NAMES).includes(body.outputLanguage)
        ? body.outputLanguage
        : body.mode === "replicate"
          ? undefined
          : languageOf(body.brief ?? ""),
    briefNotes: typeof body.briefNotes === "string" ? body.briefNotes.slice(0, 4000) : undefined,
    lastContent: typeof body.lastContent === "string" ? body.lastContent.slice(0, 300) : undefined,
    // The model knows the date only from here (12 Oct 2026: an article of August 2025 told in the future tense).
    today: new Date().toISOString().slice(0, 10),
  };
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
  // The closing slide is on top of a named count (12 Oct 2026), two slides on top of a series.
  const named = typeof body.count === "number" ? body.count + (body.perItem ? 2 : body.countIsCeiling ? 0 : 1) : 20;
  const count = oneSlide ? 1 : Math.min(Math.max(named, 1), MAX_SLIDES + 2);
  // Add mode carries extra output (insertAfter + refreshed agenda bullets).
  // Every slide carries all its required fields, so a content-heavy slide (a
  // PDF behind it) costs 400-750 tokens: 800 keeps twenty-two of them under
  // the ceiling. An A4 page of text is worth about four slides. The stream
  // reports truncation and the client shows it, but the parser never emits a
  // slide cut in half, so the budget has to be honest.
  // 800 a slide since 26 Sep 2026: a fifteen-slide deck with chapters from a
  // long report hit 650 and came back truncated.
  const perItem = twoPager ? 1600 : 800;
  // A replicated slide carries a whole source slide: up to 250 words and a
  // chart, in the dense layouts' items and stats.
  // A two-pager replica rewrites the whole document as JSON, and reasons
  // first (below): its budget follows the source, about 1.8 tokens of output
  // for each token of text, plus room for the reasoning. At 1,600 a page a
  // four-page piece was cut short and the app put the rest back in bulk.
  const replicaPages = twoPager && !!body.source;
  const maxTokens =
    body.mode === "replicate"
      ? 3000
      : replicaPages
        ? Math.min(4000 + Math.ceil((body.source!.length / 3.5) * 1.8) + 12000, 48000)
        : Math.min(800 + perItem * count + (isAdd ? 400 : 0), 36000);
  const encoder = new TextEncoder();

  // Every figure on a slide must be in one of these (lib/slides/provenance.ts). A PDF or an image
  // is read by the model, not by us: with one attached the check cannot see all the material.
  const verifiable = (body.attachments ?? []).every((a) => a.kind === "text");
  const allSources = sourcesOf(body);
  const figureIndex = verifiable ? indexSources(allSources) : null;
  // A file the server cannot read (a PDF, an image) may be where an unmatched text comes from.
  const unreadable = (body.attachments ?? []).find((a) => a.kind !== "text")?.name;
  const sourceText = [body.brief ?? "", body.briefNotes ?? "", ...(body.attachments ?? []).map((a) => (a.kind === "text" ? a.text : ""))].join(" ");
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const parser = new SlideStreamParser();
      let index = 0;
      let raw = "";
      let refusal = "";
      // A stream that stops sending is cut, not waited for: one hung for 17
      // minutes on 26 Sep 2026 and the editor sat on "Generating…". Sixty
      // seconds without a token, or four minutes in all, ends it with a
      // plain error the client already knows how to show.
      const abort = new AbortController();
      let stalled = false;
      let idle: ReturnType<typeof setTimeout> | undefined;
      const armIdle = () => {
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => {
          stalled = true;
          abort.abort();
        }, IDLE_MS);
      };
      const total = setTimeout(() => {
        stalled = true;
        abort.abort();
      }, TOTAL_MS);
      try {
        armIdle();
        const schema = twoPager
          ? isAdd
            ? ADD_PAGES_OUTPUT_SCHEMA
            : PAGES_OUTPUT_SCHEMA
          : isAdd
            ? ADD_OUTPUT_SCHEMA
            : SLIDES_OUTPUT_SCHEMA;
        const events = await client.responses.create(
          {
            model: MODEL,
            instructions: SYSTEM_PROMPTS[twoPager ? "two-pager" : "slides"],
            // The system prompt (catalog, library, rules) is the same on every
            // call: one cache key per format lets the provider reuse it, which
            // shortens the wait before the first token. Output is unchanged.
            prompt_cache_key: twoPager ? "udb-two-pager-v1" : "udb-slides-v1",
            input: [{ role: "user", content: buildUserContent(body) }],
            text: {
              format: {
                type: "json_schema",
                name: twoPager ? "pages" : "slides",
                schema: schema as unknown as Record<string, unknown>,
                strict: true,
              },
            },
            // A two-pager replica reads a layout (columns over two pages, cards,
            // captions) before it writes: with no reasoning the same PDF came
            // out right one time and scrambled the next (7 Oct 2026). Every
            // other generation keeps it off. Low, not medium (Mario, 13 Oct 2026:
            // "the two-pager is very slow to replicate"): the thinking came
            // before the first page and again on every repair pass.
            reasoning: { effort: twoPager && body.source ? "low" : "none" },
            max_output_tokens: maxTokens,
            stream: true,
          },
          { signal: abort.signal },
        );

        let stopReason = "stop";
        let usage = { inputTokens: 0, outputTokens: 0 };
        for await (const event of events) {
          armIdle();
          if (event.type === "response.output_text.delta") {
            raw += event.delta;
            for (const slide of parser.feed(event.delta)) {
              // A two-pager's block plan comes first; its rows have "part",
              // its pages have "blocks". The rows go to the client as they are.
              if (twoPager && slide && typeof slide === "object" && "part" in slide) {
                send({ type: "plan", row: slide });
                continue;
              }
              // A replica keeps the source's words: the voice pass would turn
              // the source's own "synergies" into "shared gains". A two-pager
              // replica carries its document in `source`.
              // A timeline month takes its year from the sources here, where the
              // linked pages are (the client never sees them): A6, 13 Oct 2026.
              const clean = twoPager ? stripEmptyPage(slide) : (yearTimelineMonths(stripEmptyFields(slide) as SlideContent, sourceText) as unknown);
              let out = body.mode === "replicate" || body.source ? clean : cleanVoice(clean, body.brief ?? "");
              // Only figures that exist, with a source (Mario, 13 Oct 2026). Never on a replica: its figures are the file's.
              if (!twoPager && figureIndex && body.mode !== "replicate" && !body.source && out && typeof out === "object") {
                const checked = checkFigures(out as SlideContent, figureIndex, new Date(), body.language);
                if (checked.removed.length) send({ type: "unsourced", index, title: (out as SlideContent).title ?? "", figures: checked.removed, dropped: !checked.slide });
                if (!checked.slide) continue;
                out = checked.slide;
              }
              // Where each text comes from, for the editor's right-click menu (lib/slides/attribution.ts).
              if (out && typeof out === "object") {
                const page = twoPager && "blocks" in (out as object);
                const target = page ? { stack: (out as { blocks: unknown }).blocks } : out;
                (out as { sources?: unknown }).sources = attribute(target, allSources, { unreadable: unreadable ? `the attached file "${unreadable}" (not readable here)` : undefined });
              }
              send({ type: "slide", index: index++, slide: out });
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
        send({
          type: "error",
          message: stalled
            ? `The model stopped responding${index > 0 ? ` after ${index} slide${index === 1 ? "" : "s"}` : ""}. Try again; a shorter brief or fewer slides helps.`
            : describeError(err),
        });
      } finally {
        if (idle) clearTimeout(idle);
        clearTimeout(total);
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
