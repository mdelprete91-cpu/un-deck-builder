import { CATALOG } from "./catalog";
import { MAX_SLIDES } from "./brief";
import type { Attachment } from "@/lib/slides/attachments";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { PAGE_CATALOG } from "./page-catalog";
import { AI_LAYOUT_IDS, type SlideContent } from "./schema";
import { AI_BLOCK_TYPES } from "./pages/schema";
import type { DeckFormat } from "./state";
import { PARTNER_NAMES } from "./partners";
import { AI_ICONS } from "./icon-set";
import { LIBRARY } from "./library";

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

PHOTOS for slides with a photo slot (callout, example-image-left, example-image-right, section-image-deep, section-image-light, photo): set "photo" to the id of the library photo that fits what the slide is about, never the same photo twice in a deck, and "" when none fits or on any other layout. The two buildings only for a slide about that office. Library (id: what it shows; suits):
${LIBRARY.map((l) => `- ${l.id}: ${l.description} Suits: ${l.useFor}.`).join("\n")}

ICONS for "icon-cards" (one per block, in block order, each the one that says what that card is about, never the same icon twice on a slide; [] on every other layout): ${AI_ICONS.join(", ")}

RULES:
- Output slides in presentation order. ALWAYS start with "cover" and ALWAYS end with "thank-you" (the user deletes them if unneeded).
- Use "agenda" right after the cover only for decks of 6+ slides. Agenda bullets MUST mirror the deck's "section-divider" slides one-to-one: same order, same wording (<=5 words each). Every chapter opens with its own section-divider carrying that exact title.
- THE BRIEF COMES FIRST. When it prescribes a structure (one slide per item, what each slide is titled, what goes on it, the order), follow it to the letter: every item gets its own slide, in the brief's order; the slide's title is the item's own name, copied as written and shortened only when it exceeds the limit. Each slide of such a series takes a layout that holds all of that item's sub-points, and the series ALTERNATES between those layouts, by point count: 5-6 points → "list" (and "list" is NOT allowed under 5 points); 3-4 points → four-cards, icon-cards, steps or callout, never the same as the slide before; 1-2 points → example-image-left, example-image-right, callout or two-column layouts, never "list" and never the same as the slide before. Repeat one layout across the series ONLY when the brief asks for it ("same layout", "stesso layout").
- Never drop, merge or renumber a sub-point the brief lists under an item (a KR, a step, a point): one block per sub-point, its label the brief's own (KR1, KR2, ...), its body the sub-point shortened to the limit. If no layout holds them all, use the one that holds the most; shorten bodies, never the list.
- Pick the layout that best fits each beat of the story. Never use the same layout for 3 slides in a row. Alternate light and dark surfaces so the deck has rhythm.
- The brief's opening instruction ("Create a deck", "creami uno slide deck per", "fammi una presentazione su") is a request, not the subject: it never appears on a slide, and the cover title names the topic that follows it.
- Respect every word limit strictly. Numbers do the talking: prefer concrete figures over adjectives. A stat value is a number (61%, 1.4M, $500M), never a word. "big-stat" and "single-stat" exist for a figure the brief gives; a sentence without a figure goes on section-image-deep or section-image-light, never on a stat slide with the number left empty. Those two section layouts ALWAYS carry a body of 25-45 words under the title: a title alone beside a photo is not a slide.
- Voice: plain, declarative, public-good. Sentence case everywhere (never Title Case in body text). Banned words: leveraging, synergies, cutting-edge, revolutionary, empower, unlock.
- Write in the same language as the brief.
- Only state facts given in the brief or the attached material. Never invent statistics, names, emails or dates: no year, quarter or period the brief does not give, not even in a subtitle. Giga's own figures (2.2M+ schools mapped, 146 countries, giga.global) belong only in a deck the brief makes about Giga. A brief that names neither Giga nor UNICEF gets a deck that names neither, outside the closing slide.
- DENSE MATERIAL: when the brief asks to carry a report or a long deck in full, keep its text and figures as written on the dense layouts (bullet-columns, figures-panel, scenarios, matrix, chart-text) instead of cutting them down to cards: one source slide becomes one slide, its headers become the column or row labels, its sub-points stay sub-points ("- "). Their "items" and "stats" live inside each block; on every other layout set them to [].
- DENSITY: "density" is "high" when a slide must carry more text than its layout's limits (a report or a dense source slide kept in full), else "". It exists on four-cards, icon-cards, steps, three-columns, callout, list, example-image-left/right, stat-grid, brand-equity, two-stats, single-stat, big-stat, every chart layout, timeline, timeline-phases and progress. There the fields stay the same, but a block may carry "items" (points, "- " for a sub-point, up to 80 words a block) instead of a short body, stat labels run to 30 words, a chart carries "subtitle" (a header) and "bullets" (the explanation, up to 8 points) beside the plot, and timeline or progress bodies run to 40 words. Chart values may be negative (costs) on every chart but the donut.
- FOOTNOTES: "notes" carries the footnotes the material prints for that slide (sources, definitions, "1. Cumulative 5-years"), as written, <=40 words, numbered as in the material, with the matching superscript (¹ ²) kept in the slide text; "" when the slide has none, and always "" on cover, agenda, section-divider, partner and thank-you.
- For chart-bars, values are relative heights 0-100.
- For "partner", use it only when the brief names partners, and copy the names EXACTLY from this list (each maps to a real logo): ${PARTNER_NAMES.join(", ")}. Never invent partner names or write categories like "Telecom operators" — a name outside the list renders as plain text instead of a logo.
- Every slide object includes every field of the output schema. Set fields the chosen layout does not use to "" (strings), [] (arrays) or 0 (numbers) — never invent content for them.`;
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
- WHAT TEXT TO SHOW AND WHERE (fidelity first):
  - Take the words from the brief and the material: their terms, names and figures, shortened to the limits, never paraphrased into claims they do not make. Prefer the material's own headings and labels for titles.
  - Include every point, item and figure the brief asks for; from the material, choose what matters for this brief. Never pad a slide with generic sentences to fill it.
  - Put each text where its shape fits: parallel points as blocks with a short label and a body, a sequence as steps or a timeline, figures as stats or a chart, one statement as a section slide. Parallel slides use the same kind of label and the same level of detail.
  - Every slide adds something new: after a chart or a stat, the next slide never restates the same figures.
  - Every figure carries its unit or currency, and its date or period when the source gives one; never set side by side figures that measure different things.
- Write in the same language as the brief.
- The subject is whatever the brief and the attached material are about. Only state facts given there. Never invent statistics, names, emails or dates. Giga's own figures (2.2M+ schools mapped, 146 countries, giga.global) belong only in a piece the brief makes about Giga.
- Every page carries "footerLabel": the piece's name, <=5 words, identical on every page.
- Every block object includes every field of the output schema. Set fields the chosen block does not use to "" or [] — never invent content for them.`;
}

interface GenerateBody {
  mode: "generate" | "add" | "regenerate" | "replicate";
  /** Replicate: the one source slide to rebuild, as read by lib/slides/pptx-source.ts. */
  source?: string;
  /** Replicate: where it sits ("slide 12 of 37", its chapter, the deck's title). */
  sourceContext?: string;
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
  /** The user's answers to the questions a short brief raised (compileInsights): they rank with the brief. */
  briefNotes?: string;
}

/**
 * Replicating a deck (Mario, 28 Sep 2026: "replicate it in a more beautiful
 * way, all text are important, don't miss anything"). Each source slide is
 * rebuilt on its own call, so the count and the order are the source's by
 * construction; this is what the model is told about the one slide it gets.
 */
const REPLICATE_NOTE =
  "You are rebuilding an existing deck on the brand template, one slide at a time. Return exactly ONE slide for the source slide below: its title copied as written (shortened only past the layout's limit), every point, figure, unit and date it states kept as written, its sub-points as sub-points (\"- \"), its footnotes in \"notes\" with their numbers and the matching superscripts in the text. Pick the layout whose SHAPE matches the source slide, and set \"density\" to \"high\" only when its text does not fit that layout's standard word limits (a short slide stays standard, even in a dense deck): labelled boxes or cards → four-cards, icon-cards or steps; rows of points → list or callout; figures with explanations → stat-grid, two-stats or single-stat; a chart → the chart layout of its kind (line, grouped or stacked columns, bars, donut) with its explanation in subtitle and bullets; phases or dates → timeline or progress. Use the dense layouts (bullet-columns for columns of prose points under long headers, figures-panel for outcome/benefits/costs rows, scenarios for options side by side, matrix for a grid, chart-text for a chart with numbered notes) only when no layout of the source's shape fits. Vary the layouts across the deck as the source varies. Choose the layout that holds all of it: a chart layout when the slide is a chart (use the chart labels written on the slide, column by column; the chart data is only a fallback; when the slide has two charts side by side, as two scenarios, draw the first on chart-text and give the second's figures in its points, never one line of both), a stat or card layout only when the slide is that short. Never cut content to fit a simpler layout, never add content the source slide does not have, never write a cover, agenda, section-divider or thank-you here. The source's own header and footer lines (organisation handles, running headers) are not content. Write in the source slide's language.";

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
  const sheets = body.attachments!.some((a) => a.kind === "text" && a.spreadsheet);
  const answered = body.attachments!.some((a) => a.kind !== "image" && a.insights?.trim());
  return (
    `\n\nAttached reference material (${n} item${n === 1 ? "" : "s"}: ${names}) precedes this message.` +
    (answered ? " The user answered questions about the material; those answers rank with the brief, above the material itself." : "") +
    ` The ${body.format === "two-pager" ? "pages are" : "deck is"} about this material: take the subject, structure, facts, figures and names from it. The brief comes first on everything it says (length, angle, audience, which organisations to feature); where the brief is silent, the material decides. Quote numbers exactly as they appear, copied digit by digit (3,323 is not 3,523), never invent what is not there, and do not copy long passages verbatim.` +
    (sheets ? SPREADSHEET_NOTE : "")
  );
}

/**
 * A spreadsheet is rows, not an argument. Without this the model narrates
 * the header row; with it, the figures the user asked for land on the
 * chart and stat layouts, values as written in the cells.
 */
const SPREADSHEET_NOTE =
  " A spreadsheet is data, not prose: one table per sheet, first row usually the headers, and under it what the user wants drawn from it. That note says which figures to draw, not how many slides to write: the deck keeps its usual length and story (the subject and why it matters, then the charts, then what the numbers mean and what comes next). A slide after a chart never restates its figures. A comparison across rows becomes a chart-bars slide (chart-columns-wide past five categories, chart-bars-horizontal for a ranking), a trend over periods a chart-line, two or three measures side by side a chart-columns-grouped, parts of a total a chart-columns-stacked or a donut-chart, a headline figure a stat slide, each with the cell values as written; never narrate the column headers, and never mention the spreadsheet or the file itself on a slide (the reader sees the figures, not where they came from). One chart per dataset: a chart with two or three series is never split into one chart per series, and the same figures never appear on two charts. Prefer figures that appear in the cells over ones you compute.";

/**
 * The full user turn: attachments first (PDFs as `input_file` parts, images
 * as `input_image` parts, extracted text as labelled text parts), then the
 * brief and instructions. Without attachments this is a single text part
 * equal to buildUserMessage. Responses API shapes (OpenAI, 25 Sep 2026).
 */
export function buildUserContent(body: GenerateBody): ResponseInputContent[] {
  const blocks: ResponseInputContent[] = [];
  for (const a of body.attachments ?? []) {
    if (a.kind === "pdf") {
      blocks.push({
        type: "input_file",
        filename: a.name,
        file_data: `data:application/pdf;base64,${a.data}`,
      });
      if (a.insights?.trim()) blocks.push({ type: "input_text", text: `About "${a.name}", from the user: ${a.insights.trim()}` });
    } else if (a.kind === "image") {
      blocks.push({ type: "input_text", text: `Attached image: "${a.name}"` });
      blocks.push({ type: "input_image", image_url: `data:${a.mediaType};base64,${a.data}`, detail: "auto" });
    } else {
      const label = /^https?:\/\//.test(a.name) ? "Linked page" : a.spreadsheet ? "Attached spreadsheet" : "Attached file";
      const insights = a.insights?.trim() ? `\n${a.spreadsheet ? "What to draw from this spreadsheet" : "About this file, from the user"}: ${a.insights.trim()}` : "";
      blocks.push({
        type: "input_text",
        text: `${label} "${a.name}"${a.truncated ? " (truncated)" : ""}:\n<<<\n${a.text}\n>>>${insights}`,
      });
    }
  }
  blocks.push({ type: "input_text", text: buildUserMessage(body) + attachmentsNote(body) });
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
  const notes = body.briefNotes?.trim() ? `\n\nThe user answered questions about this brief; these answers rank with the brief: ${body.briefNotes.trim()}` : "";
  switch (body.mode) {
    case "add": {
      const n = body.count ?? 3;
      return `Existing deck (JSON): ${JSON.stringify(body.existingSlides ?? [])}\n\nDeck brief: ${body.brief}${brand}${language}${notes}\n\nRequest: ${body.instruction?.trim() || "continue and deepen the story"}\n\nAdd exactly ${n} new slide${n === 1 ? "" : "s"} fulfilling the request.\n- Return ONLY the new slides in "slides": never repeat, rewrite or include existing slides, and never add another cover, agenda or thank-you.\n- Give every new slide "after": the 1-based index of the existing slide it belongs after (0 = before the first slide), where it fits the story and the order of the material, inside the chapter it belongs to, never after a thank-you. New slides that go together share the number, in reading order. Set "insertAfter" to the first new slide's "after".\n- If the deck has an "agenda" slide, return its updated bullets (reflecting the deck after insertion, <=5 words each) in "agenda"; otherwise return an empty array.${noChapters}`;
    }
    case "replicate":
      return `Deck brief: ${body.brief}${brand}${language}${notes}\n\n${REPLICATE_NOTE}\n\n${body.sourceContext ?? ""}\n\nSource slide:\n<<<\n${(body.source ?? "").slice(0, 12000)}\n>>>`;
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
          : typeof body.count === "number" && body.count < 12
            ? " (agenda and section dividers count too: with this length use at most two chapters, so the content keeps most of the slides, or leave the chapters out)"
            : " (agenda and section dividers count too; if they would leave no room for the content, leave the chapters out, never the content)";
      const length = body.perItem
        ? typeof body.count === "number"
          ? `The brief asks for one slide per item and names ${body.count}: that is the number of items, not the size of the deck. Make exactly one slide for each item the brief lists, then add the cover and the closing slide on top${body.chapters === false ? "" : ", and the agenda and dividers if the deck has chapters"}.`
          : `The brief asks for one slide per item: make exactly one slide for each item it lists, plus the cover and the closing slide${body.chapters === false ? "" : ", and the agenda and dividers if the deck has chapters"}.`
        : typeof body.count === "number"
          ? `Produce exactly ${body.count} slides, no more and no fewer, counting the cover and the closing slide${chaptersCount}.`
          : `Choose the number of slides yourself (typically 8-14; when the brief asks to carry long material in full, as many as it takes, up to ${MAX_SLIDES}). A "page" in the brief means a slide.`;
      return `Brief: ${body.brief}${brand}${language}${notes}\n\nCreate the deck that best tells this story. ${length}${noChapters}`;
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
 * JSON schema for the route's structured output (`text.format`, strict) — a
 * flat union of fields, validated per-layout client-side. Every field is
 * required and `additionalProperties` is false on every object: that is what
 * strict mode demands, and it was the shape already (optional fields made the
 * grammar too complex for the Anthropic API, 22 Sep 2026). The model fills
 * unused fields with ""/[] and the route strips them.
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
              properties: {
                label: { type: "string" },
                body: { type: "string" },
                items: { type: "array", items: { type: "string" } },
                stats: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { value: { type: "string" }, label: { type: "string" } },
                    required: ["value", "label"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["label", "body", "items", "stats"],
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
              properties: {
                label: { type: "string" },
                value: { type: "number" },
                values: { type: "array", items: { type: "number" } },
              },
              required: ["label", "value", "values"],
              additionalProperties: false,
            },
          },
          series: { type: "array", items: { type: "string" } },
          current: { type: "integer" },
          icons: { type: "array", items: { type: "string" } },
          photo: { type: "string" },
          notes: { type: "string" },
          density: { type: "string", enum: ["", "high"] },
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
          "series",
          "current",
          "icons",
          "photo",
          "notes",
          "density",
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
    slides: {
      type: "array",
      items: {
        ...SLIDES_OUTPUT_SCHEMA.properties.slides.items,
        properties: { ...SLIDES_OUTPUT_SCHEMA.properties.slides.items.properties, after: { type: "integer" } },
        required: [...SLIDES_OUTPUT_SCHEMA.properties.slides.items.required, "after"],
      },
    },
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
