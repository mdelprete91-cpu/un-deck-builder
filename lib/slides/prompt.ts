import { CATALOG } from "./catalog";
import type { Attachment } from "@/lib/slides/attachments";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { PAGE_CATALOG } from "./page-catalog";
import { AI_LAYOUT_IDS, type SlideContent } from "./schema";
import { AI_BLOCK_TYPES } from "./pages/schema";
import type { DeckFormat } from "./state";
import { PARTNER_NAMES } from "./partners";

/**
 * System prompt: layout catalog + brand voice. Kept tight — prompt size
 * drives latency and cost on every generation.
 */
export function buildSystemPrompt(format: DeckFormat = "slides"): string {
  if (format === "two-pager") return buildPagePrompt();
  const catalogLines = CATALOG.map((c) => `- ${c.id}: ${c.usage}. Fields: ${c.fields}`).join("\n");
  return `You are the slide planner for a deck builder used by UNICEF and Giga teams. The deck's subject is whatever the brief and the attached material are about: the organisations behind this tool are not the topic unless the brief makes them one. You turn a brief into a slide deck by picking layouts from a fixed template library and writing the text that fills them. You never design slides — you only choose layoutIds from the catalog and fill their fields.

LAYOUT CATALOG (id: when to use. fields with hard word limits):
${catalogLines}

RULES:
- Output slides in presentation order. ALWAYS start with "cover" and ALWAYS end with "thank-you" (the user deletes them if unneeded).
- Use "agenda" right after the cover only for decks of 6+ slides. Agenda bullets MUST mirror the deck's "section-divider" slides one-to-one: same order, same wording (<=5 words each). Every chapter opens with its own section-divider carrying that exact title.
- THE BRIEF COMES FIRST. When it prescribes a structure (one slide per item, what each slide is titled, what goes on it, the order), follow it to the letter: every item gets its own slide, in the brief's order; the slide's title is the item's own name, copied as written and shortened only when it exceeds the limit. Each slide of such a series takes a layout that holds all of that item's sub-points, and the series ALTERNATES between those layouts, by point count: 5-6 points → "list" (and "list" is NOT allowed under 5 points); 3-4 points → four-cards, icon-cards, steps or callout, never the same as the slide before; 1-2 points → example-image-left, example-image-right, callout or two-column layouts, never "list" and never the same as the slide before. Repeat one layout across the series ONLY when the brief asks for it ("same layout", "stesso layout").
- Never drop, merge or renumber a sub-point the brief lists under an item (a KR, a step, a point): one block per sub-point, its label the brief's own (KR1, KR2, ...), its body the sub-point shortened to the limit. If no layout holds them all, use the one that holds the most; shorten bodies, never the list.
- Pick the layout that best fits each beat of the story. Never use the same layout for 3 slides in a row. Alternate light and dark surfaces so the deck has rhythm.
- The brief's opening instruction ("Create a deck", "creami uno slide deck per", "fammi una presentazione su") is a request, not the subject: it never appears on a slide, and the cover title names the topic that follows it.
- Respect every word limit strictly. Numbers do the talking: prefer concrete figures over adjectives. A stat value is a number (61%, 1.4M, $500M), never a word. "big-stat" and "single-stat" exist for a figure the brief gives; a sentence without a figure goes on section-image-deep or section-image-light, never on a stat slide with the number left empty.
- Voice: plain, declarative, public-good. Sentence case everywhere (never Title Case in body text). Banned words: leveraging, synergies, cutting-edge, revolutionary, empower, unlock.
- Write in the same language as the brief.
- Only state facts given in the brief or the attached material. Never invent statistics, names, emails or dates: no year, quarter or period the brief does not give, not even in a subtitle. Giga's own figures (2.2M+ schools mapped, 146 countries, giga.global) belong only in a deck the brief makes about Giga. A brief that names neither Giga nor UNICEF gets a deck that names neither, outside the closing slide.
- For chart-bars, values are relative heights 0-100.
- For "partner", use it only when the brief names partners, and copy the names EXACTLY from this list (each maps to a real logo): ${PARTNER_NAMES.join(", ")}. Never invent partner names or write categories like "Telecom operators" — a name outside the list renders as plain text instead of a logo.
- Every slide object includes every field of the output schema. Set fields the chosen layout does not use to "" (strings) or [] (arrays) — never invent content for them.`;
}

/**
 * The two-pager planner. Same contract as the slide one: the model picks
 * blocks from an approved catalog and writes the text, and never touches
 * geometry. The one thing it has to keep track of that a slide planner does
 * not is how full the sheet is, since a page is a fixed A4 box.
 */
function buildPagePrompt(): string {
  const catalogLines = PAGE_CATALOG.map(
    (c) => `- ${c.type} (weight ${c.weight}): ${c.usage}. Fields: ${c.fields}`,
  ).join("\n");
  return `You are the page planner for the UNICEF Digital Inclusion two-pager: a printed A4 brief, not a slide deck. You turn a brief into pages by stacking blocks from a fixed, approved catalog and writing the text that fills them. You never design a page — you only choose block types and fill their fields.

BLOCK CATALOG (type: when to use. fields with hard word limits):
${catalogLines}

RULES:
- A page is a vertical stack of blocks, in reading order. Output pages in reading order.
- THE PAGE IS A FIXED SHEET. The weights of the blocks on one page must add up to 100 or less. Text that does not fit is cut off, so keep well inside the limit rather than at it.
- The first page starts with a "title" block, which also brings the masthead. Later pages do NOT start with a title.
- Use "rail-prose" for most content: its rail label is what gives a printed page its structure. Every rail label on a page must be different.
- A page carries 3 to 6 blocks. Never two blocks of the same type in a row, except "rail-prose".
- Put "contacts" (preceded by "divider") only at the end of the last page, and only if the brief names people. Never invent a name or an address.
- The brief's opening instruction ("Create a deck", "creami uno slide deck per", "fammi una presentazione su") is a request, not the subject: it never appears on a slide, and the cover title names the topic that follows it.
- Respect every word limit strictly. Numbers do the talking: prefer concrete figures over adjectives. A stat value is a number (61%, 1.4M, $500M), never a word. "big-stat" and "single-stat" exist for a figure the brief gives; a sentence without a figure goes on section-image-deep or section-image-light, never on a stat slide with the number left empty.
- Voice: plain, declarative, public-good. Sentence case everywhere (never Title Case in body text). Banned words: leveraging, synergies, cutting-edge, revolutionary, empower, unlock.
- Write in the same language as the brief.
- The subject is whatever the brief and the attached material are about. Only state facts given there. Never invent statistics, names, emails or dates. Giga's own figures (2.2M+ schools mapped, 146 countries, giga.global) belong only in a piece the brief makes about Giga.
- Every page carries "footerLabel": the piece's name, <=5 words, identical on every page.
- Every block object includes every field of the output schema. Set fields the chosen block does not use to "" or [] — never invent content for them.`;
}

interface GenerateBody {
  mode: "generate" | "add" | "regenerate";
  /** Reference material attached to the brief; never persisted, see lib/slides/attachments.ts */
  attachments?: Attachment[];
  format?: DeckFormat;
  brief: string;
  count?: number;
  /** The brief asks for one slide per item: a named count is then the number of items. */
  perItem?: boolean;
  brandLabel?: string;
  existingSlides?: SlideContent[];
  targetSlide?: SlideContent;
  instruction?: string;
  /** false = a deck with no agenda slide and no section dividers */
  chapters?: boolean;
  /** The brief's language when it is not English (languageOf in brief.ts): named in the user turn. */
  language?: string;
}

/**
 * Chapter opt-out. It lives in the user message, not the system prompt: the
 * system prompt is built once at module load and its "agenda mirrors the
 * dividers" rule is the default, so this overrides it per request.
 */
const NO_CHAPTERS =
  '\n- This deck has NO chapters: never use the "agenda" or "section-divider" layouts. Carry the structure with the content slides themselves and let each one stand on its own.';

/**
 * How the attached files relate to the brief. Goes at the end of the text so
 * the instructions about layouts and counts stay where they always were.
 */
function attachmentsNote(body: GenerateBody): string {
  const n = body.attachments?.length ?? 0;
  if (n === 0) return "";
  const names = body.attachments!.map((a) => `"${a.name}"`).join(", ");
  return `\n\nAttached reference material (${n} item${n === 1 ? "" : "s"}: ${names}) precedes this message. The ${body.format === "two-pager" ? "pages are" : "deck is"} about this material: take the subject, structure, facts, figures and names from it. The brief comes first on everything it says (length, angle, audience, which organisations to feature); where the brief is silent, the material decides. Quote numbers exactly as they appear, never invent what is not there, and do not copy long passages verbatim.`;
}

/**
 * The full user turn: attachments first (PDFs and images as native blocks,
 * extracted text as labelled text blocks), then the brief and instructions.
 * Without attachments this is a single text block equal to buildUserMessage.
 */
export function buildUserContent(body: GenerateBody): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];
  for (const a of body.attachments ?? []) {
    if (a.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.data },
        title: a.name,
      });
    } else if (a.kind === "image") {
      blocks.push({ type: "text", text: `Attached image: "${a.name}"` });
      blocks.push({ type: "image", source: { type: "base64", media_type: a.mediaType, data: a.data } });
    } else {
      blocks.push({
        type: "text",
        text: `${/^https?:\/\//.test(a.name) ? "Linked page" : "Attached file"} "${a.name}"${a.truncated ? " (truncated)" : ""}:\n<<<\n${a.text}\n>>>`,
      });
    }
  }
  blocks.push({ type: "text", text: buildUserMessage(body) + attachmentsNote(body) });
  return blocks;
}

export function buildUserMessage(body: GenerateBody): string {
  if (body.format === "two-pager") return buildPageUserMessage(body);
  // The lockup sets logo and colours, never the subject. The closing slide's
  // fallback contact is the brand's team; Giga's own address only for Giga.
  const brand = body.brandLabel
    ? ` The deck carries the "${body.brandLabel}" lockup: that sets its logo and colours, not its subject, and its name is never a slide title. If the brief gives no contact for thank-you, use ${
        body.brandLabel === "Giga"
          ? 'name "Giga Team", role "Giga", location "Geneva, Switzerland", email "giga@unicef.org"'
          : `name "${body.brandLabel} team" and leave role, location and email empty`
      }.`
    : "";
  const noChapters = body.chapters === false ? NO_CHAPTERS : "";
  const language = body.language ? ` The brief is in ${body.language}: write every slide in ${body.language}.` : "";
  switch (body.mode) {
    case "add": {
      const n = body.count ?? 3;
      return `Existing deck (JSON): ${JSON.stringify(body.existingSlides ?? [])}\n\nDeck brief: ${body.brief}${brand}${language}\n\nRequest: ${body.instruction?.trim() || "continue and deepen the story"}\n\nAdd exactly ${n} new slide${n === 1 ? "" : "s"} fulfilling the request.\n- Return ONLY the new slides in "slides": never repeat, rewrite or include existing slides, and never add another cover, agenda or thank-you.\n- Set "insertAfter" to the 1-based index of the existing slide the new slides belong after (0 = before the first slide). Pick where they best fit the story, keeping any thank-you last.\n- If the deck has an "agenda" slide, return its updated bullets (reflecting the deck after insertion, <=5 words each) in "agenda"; otherwise return an empty array.${noChapters}`;
    }
    case "regenerate":
      return `Current slide (JSON): ${JSON.stringify(body.targetSlide)}\n\nDeck brief: ${body.brief}${brand}${language}\n\nRewrite this single slide.${body.instruction ? ` Instruction: ${body.instruction}` : " Improve the copy."} You may switch to a more appropriate layout if the instruction calls for it. Return exactly one slide.`;
    default: {
      // A count named in the brief arrives as body.count (see countFromBrief
      // in app/page.tsx): demanded exactly, with no competing default.
      // A count with "one slide per item" is the number of items, not a
      // ceiling: a conditional ("unless the items need more") was obeyed
      // one time in two by Haiku, so the client decides and the rule is flat.
      const chaptersCount =
        body.chapters === false
          ? ""
          : " (agenda and section dividers count too; if they would leave no room for the content, leave the chapters out, never the content)";
      const length = body.perItem
        ? typeof body.count === "number"
          ? `The brief asks for one slide per item and names ${body.count}: that is the number of items, not the size of the deck. Make exactly one slide for each item the brief lists, then add the cover and the closing slide on top${body.chapters === false ? "" : ", and the agenda and dividers if the deck has chapters"}.`
          : `The brief asks for one slide per item: make exactly one slide for each item it lists, plus the cover and the closing slide${body.chapters === false ? "" : ", and the agenda and dividers if the deck has chapters"}.`
        : typeof body.count === "number"
          ? `Produce exactly ${body.count} slides, no more and no fewer, counting the cover and the closing slide${chaptersCount}.`
          : "Choose the number of slides yourself (typically 8-14). A \"page\" in the brief means a slide.";
      return `Brief: ${body.brief}${brand}${language}\n\nCreate the deck that best tells this story. ${length}${noChapters}`;
    }
  }
}

function buildPageUserMessage(body: GenerateBody): string {
  switch (body.mode) {
    case "add": {
      const n = body.count ?? 1;
      return `Existing pages (JSON): ${JSON.stringify(body.existingSlides ?? [])}\n\nBrief: ${body.brief}\n\nRequest: ${body.instruction?.trim() || "continue the piece"}\n\nAdd exactly ${n} new page${n === 1 ? "" : "s"} fulfilling the request. Return ONLY the new pages, never repeat an existing one, and do not start them with a "title" block.\n- Set "insertAfter" to the 1-based index of the existing page the new ones belong after (0 = before the first).`;
    }
    case "regenerate":
      return `Current page (JSON): ${JSON.stringify(body.targetSlide)}\n\nBrief: ${body.brief}\n\nRewrite this single page.${body.instruction ? ` Instruction: ${body.instruction}` : " Improve the copy."} Keep the same kind of blocks unless the instruction asks otherwise, and return exactly one page.`;
    default:
      return `Brief: ${body.brief}\n\nWrite the two-pager that tells this story in ${body.count ?? 2} page${(body.count ?? 2) === 1 ? "" : "s"}. The first page opens with a title block.`;
  }
}

/**
 * JSON schema for output_config.format — flat union of fields, validated
 * per-layout client-side. Every field is required: optional fields make the
 * grammar too complex for the API ("Schema is too complex" 400 on Haiku), so
 * the model fills unused fields with ""/[] and the route strips them.
 */
export const SLIDES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          layoutId: { type: "string", enum: [...AI_LAYOUT_IDS] },
          title: { type: "string" },
          subtitle: { type: "string" },
          stat: { type: "string" },
          support: { type: "string" },
          quote: { type: "string" },
          author: { type: "string" },
          body: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, body: { type: "string" } },
              required: ["label", "body"],
              additionalProperties: false,
            },
          },
          stats: {
            type: "array",
            items: {
              type: "object",
              properties: { value: { type: "string" }, label: { type: "string" } },
              required: ["value", "label"],
              additionalProperties: false,
            },
          },
          bars: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, value: { type: "number" } },
              required: ["label", "value"],
              additionalProperties: false,
            },
          },
          contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string" },
                location: { type: "string" },
                email: { type: "string" },
              },
              required: ["name", "role", "location", "email"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "layoutId",
          "title",
          "subtitle",
          "stat",
          "support",
          "quote",
          "author",
          "body",
          "bullets",
          "blocks",
          "stats",
          "bars",
          "contacts",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["slides"],
  additionalProperties: false,
} as const;

/**
 * Output schema for "add" mode: only the new slides, plus where they go and
 * the refreshed agenda bullets (empty when the deck has no agenda slide).
 */
export const ADD_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    insertAfter: { type: "integer" },
    agenda: { type: "array", items: { type: "string" } },
    slides: SLIDES_OUTPUT_SCHEMA.properties.slides,
  },
  required: ["insertAfter", "agenda", "slides"],
  additionalProperties: false,
} as const;

/**
 * Output schema for two-pager pages. Same philosophy as the slide one: one
 * flat block object, every field required, an enum for the type and no
 * `oneOf` — a discriminated union per block type is exactly the grammar that
 * returns "Schema is too complex" on Haiku.
 */
export const PAGES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          // The running footer is the piece's name and is the same on every
          // page. It sits on the page rather than beside `pages` so it is set
          // as each page streams in, instead of arriving after the last one.
          footerLabel: { type: "string" },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: [...AI_BLOCK_TYPES] },
                rail: { type: "string" },
                heading: { type: "string" },
                sub: { type: "string" },
                lead: { type: "string" },
                body: { type: "string" },
                accent: { type: "integer" },
                tag: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["para", "bullet", "number"] },
                      label: { type: "string" },
                      body: { type: "string" },
                      extra: { type: "string" },
                    },
                    required: ["kind", "label", "body", "extra"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["type", "rail", "heading", "sub", "lead", "body", "accent", "tag", "items"],
              additionalProperties: false,
            },
          },
        },
        required: ["footerLabel", "blocks"],
        additionalProperties: false,
      },
    },
  },
  required: ["pages"],
  additionalProperties: false,
} as const;

/** "add" mode for pages: the new pages plus where they go. */
export const ADD_PAGES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    insertAfter: { type: "integer" },
    pages: PAGES_OUTPUT_SCHEMA.properties.pages,
  },
  required: ["insertAfter", "pages"],
  additionalProperties: false,
} as const;

export type { GenerateBody };
