import { CATALOG } from "./catalog";
import { MAX_SLIDES } from "./brief";
import type { Attachment } from "@/lib/slides/attachments";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { ARCHETYPES, PAGE_CATALOG } from "./page-catalog";
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
- Chapters ("agenda" and "section-divider") are set per deck in the user message: when it says the deck has chapters, "agenda" goes right after the cover. Agenda bullets MUST mirror the deck's "section-divider" slides one-to-one: same order, same wording (<=5 words each). Every chapter opens with its own section-divider carrying that exact title.
- THE BRIEF COMES FIRST. When it prescribes a structure (one slide per item, what each slide is titled, what goes on it, the order), follow it to the letter: every item gets its own slide, in the brief's order; the slide's title is the item's own name, copied as written and shortened only when it exceeds the limit. Each slide of such a series takes a layout that holds all of that item's sub-points, and the series ALTERNATES between those layouts, by point count: 5-6 points → "list" (and "list" is NOT allowed under 5 points); 3-4 points → four-cards, icon-cards, steps or callout, never the same as the slide before; 1-2 points → example-image-left, example-image-right, callout or two-column layouts, never "list" and never the same as the slide before. Repeat one layout across the series ONLY when the brief asks for it ("same layout", "stesso layout").
- Never drop, merge or renumber a sub-point the brief lists under an item (a KR, a step, a point): one block per sub-point, its label the brief's own (KR1, KR2, ...), its body the sub-point shortened to the limit. If no layout holds them all, use the one that holds the most; shorten bodies, never the list.
- Pick the layout that best fits each beat of the story. Never use the same layout for 3 slides in a row. Alternate light and dark surfaces so the deck has rhythm.
- The brief's opening instruction ("Create a deck", "creami uno slide deck per", "fammi una presentazione su") is a request, not the subject: it never appears on a slide, and the cover title names the topic that follows it.
- Respect every word limit strictly. Numbers do the talking: prefer concrete figures over adjectives. A stat value is a number (61%, 1.4M, $500M), never a word. "big-stat" and "single-stat" exist for a figure the brief gives; a sentence without a figure goes on section-image-deep or section-image-light, never on a stat slide with the number left empty. Those two section layouts ALWAYS carry a body of 25-45 words under the title: a title alone beside a photo is not a slide.
- Voice: plain, declarative, public-good. Sentence case everywhere (never Title Case in body text). Banned words: leveraging, synergies, cutting-edge, revolutionary, empower, unlock.
- Write in the same language as the brief.
- Only state facts given in the brief or the attached material. Never invent statistics, names, emails or dates: no year, quarter or period the brief does not give, not even in a subtitle. Giga's own figures (2.2M+ schools mapped, 146 countries, giga.global) belong only in a deck the brief makes about Giga. A brief that names neither Giga nor UNICEF gets a deck that names neither, outside the closing slide.
- DENSE MATERIAL: when the brief asks to carry a report or a long deck in full, keep its text and figures as written on the dense layouts (bullet-columns, figures-panel, scenarios, matrix, chart-text, cascade) instead of cutting them down to cards: one source slide becomes one slide, its headers become the column or row labels, its sub-points stay sub-points ("- "). Their "items" and "stats" live inside each block; on every other layout set them to []. "takeaway" is figures-panel's closing sentence when the material draws one; "" everywhere else.
- DENSITY: "density" is "high" when a slide must carry more text than its layout's limits (a report or a dense source slide kept in full), else "". It exists on four-cards, icon-cards, steps, three-columns, callout, list, example-image-left/right, stat-grid, brand-equity, two-stats, single-stat, big-stat, every chart layout, timeline, timeline-phases and progress. There the fields stay the same, but a block may carry "items" (points, "- " for a sub-point, up to 80 words a block) instead of a short body, stat labels run to 30 words, a chart carries "subtitle" (a header) and "bullets" (the explanation, up to 8 points) beside the plot, and timeline or progress bodies run to 40 words. Chart values may be negative (costs) on every chart but the donut.
- FOOTNOTES: "notes" carries the footnotes the material prints for that slide (sources, definitions, "1. Cumulative 5-years"), as written, <=40 words, numbered as in the material, with the matching superscript (¹ ²) kept in the slide text; "" when the slide has none, and always "" on cover, agenda, section-divider, partner and thank-you.
- For chart-bars, values are relative heights 0-100.
- For "partner", use it only when the brief names partners, and copy the names EXACTLY from this list (each maps to a real logo): ${PARTNER_NAMES.join(", ")}. Never invent partner names or write categories like "Telecom operators" — a name outside the list renders as plain text instead of a logo.
- Every slide object includes every field of the output schema. Set fields the chosen layout does not use to "" (strings), [] (arrays) or 0 (numbers) — never invent content for them.`;
}

/**
 * The two-pager planner (rebuilt 6 Oct 2026 on the Estonia pieces). Same
 * contract as the slide one: the model picks blocks from an approved catalog
 * and writes the text, and never touches geometry. A page is a fixed A4
 * sheet, so it also keeps a running budget; the fit pass (pages/fit.ts)
 * measures the result and tightens or shortens what still runs over.
 */
function buildPagePrompt(): string {
  const catalogLines = PAGE_CATALOG.map((c) => `- ${c.type}: ${c.usage}. Fields: ${c.fields}`).join("\n");
  const archetypes = ARCHETYPES.map(
    (a) => `- ${a.id} (${a.name}): ${a.when}.\n  Page 1: ${a.page1}.\n  Page 2: ${a.page2}.`,
  ).join("\n");
  return `You are the planner of a two-pager: a printed A4 brief of exactly two pages for UNICEF teams, the kind handed to a minister, a donor or a partner. You turn a brief into pages by stacking blocks from a fixed, approved catalog and writing the text that fills them. You never design a page: you choose block types, fill their fields and keep each page within its budget.

FIRST pick the archetype that fits the brief and set "archetype". Follow its order of blocks; blocks marked optional may be left out, and you may add a section where the material needs one. When the brief prescribes its own structure (its sections, their order, their titles), the brief wins over the archetype.
ARCHETYPES:
${archetypes}

BLOCK CATALOG (type: when to use. fields with hard limits in characters):
${catalogLines}

PAGE BUDGET. A page is a fixed sheet and text that does not fit is cut off, so plan it like a printed page:
- Page 1 holds a banner, one stats row and about 2,300 characters of section text in total. Without stats, about 2,700.
- Page 2 holds about 2,800 characters of text plus ONE visual block (figure, stats of 6, pillars, compare or photos), or about 3,600 characters with no visual block.
- A compare row costs about 150 characters of budget, a pillar about 230.
- Fill both pages: a two-pager that ends half-way down a page reads as unfinished. Write to the budget even from a short brief: a section is two or three full paragraphs, and what fills them is explanation, not new facts (how the work is done, why it matters for children and for the reader, what changes when it is in place, what the reader can do). Explaining is allowed; inventing a figure, a name, a date, a place or a result is not.
- Every fact appears once in the piece: page 2 never restates a figure or a result already on page 1.
- Plan the material across both pages before writing page 1: page 2 carries as much as page 1, so keep part of the material (how it works, the evidence, what comes next, the asks) for it instead of spending it all up front.
- No "stats" block when the brief gives no figures: never number points 1, 2, 3 as if they were figures.

PHOTOS for banner, figure and photos items: set "photo" to the id of the library photo that fits, never the same photo twice, or "" to keep the default (the banner's default is a dark data strip that suits any piece). Library (id: what it shows; suits):
${LIBRARY.map((l) => `- ${l.id}: ${l.description} Suits: ${l.useFor}.`).join("\n")}

RULES:
- Exactly two pages unless the user message says otherwise. Page 1 opens with "banner". Page 2 never opens with a banner.
- Every section's rail label is different from every other one in the piece. Labels are short and in sentence case ("The challenge", "Why it matters", "What we do", "Results", "What the evidence shows").
- Never two "stats" blocks on one page. Stats only for figures the brief or the material gives, each with its unit; never a stat that restates a figure already shown in another stat.
- A bold lead-in (an item's "label" in a section) names what the paragraph is about ("Namibia.", "Market shaping."); leave it empty on ordinary paragraphs.
- Asks are concrete: what it is, then what the partner could do ("Estonia could help by ...").
- "contacts" only at the end of the last page, and only with names the brief gives. Never invent a name or an address.
- The brief's opening instruction ("Create a two-pager", "fammi un two pager su") is a request, not the subject: the banner names the topic that follows it.
- WHAT TEXT TO SHOW (fidelity first): take the brief's and the material's own terms, names and figures; never paraphrase them into claims they do not make. Include every point and figure the brief asks for; from long material, choose what matters for this brief.
- Every figure carries its unit or currency, and its date or period when the source gives one.
- Only state facts given in the brief or the material. Never invent statistics, names, emails or dates. Giga's own figures belong only in a piece the brief makes about Giga.
- Voice: plain, declarative, public-good, written for a reader with two minutes. Sentence case. No em dashes: use commas, colons or full stops. Banned words: leveraging, synergies, cutting-edge, revolutionary, empower, unlock.
- Write in the same language as the brief.
- Every page carries "footerLabel": the brand or programme name the piece is from, <=40 chars, identical on both pages.
- Every block object includes every field of the output schema. Set fields the chosen block does not use to "" (strings), [] (arrays) or -1 (accent).`;
}

interface GenerateBody {
  mode: "generate" | "add" | "regenerate" | "replicate";
  /** Replicate: the one source slide to rebuild, as read by lib/slides/pptx-source.ts. */
  source?: string;
  /** Replicate: where it sits ("slide 12 of 37", its chapter, the deck's title). */
  sourceContext?: string;
  /** Replicate, second attempt: what the first answer changed (fidelity.ts `repairNote`) and that answer. */
  repair?: string;
  previous?: SlideContent;
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
  "You are rebuilding an existing deck on the brand template, one slide at a time. Return exactly ONE slide for the source slide below: its title copied as written, never shortened (the slide fits it), every point, figure, unit and date it states kept as written, its sub-points as sub-points (\"- \"), its footnotes in \"notes\" with their numbers and the matching superscripts in the text. Pick the layout whose SHAPE matches the source slide, and set \"density\" to \"high\" only when its text does not fit that layout's standard word limits (a short slide stays standard, even in a dense deck): labelled boxes or cards → four-cards, icon-cards or steps; rows of points → list or callout; figures with explanations → stat-grid, two-stats or single-stat; a chart → the chart layout of its kind (line, grouped or stacked columns, bars, donut) with its explanation in subtitle and bullets; phases or dates → timeline or progress. Use the dense layouts (bullet-columns for columns of prose points under long headers, figures-panel for outcome/benefits/costs rows (its closing sentence in \"takeaway\"), scenarios for options side by side, matrix for a grid, chart-text for a chart with numbered notes, cascade for policies leading to objectives and one goal) only when no layout of the source's shape fits. Vary the layouts across the deck as the source varies. Choose the layout that holds all of it: a chart layout when the slide is a chart (use the chart labels written on the slide, column by column; the chart data is only a fallback; when the slide has two charts side by side, as two scenarios, draw the first on chart-text and give the second's figures in its points, never one line of both), a stat or card layout only when the slide is that short. Never cut content to fit a simpler layout, never add content the source slide does not have, never write a cover, agenda, section-divider or thank-you here. The source's own header and footer lines (organisation handles, running headers) are not content. Write in the source slide's language.";

/** A source slide reaches the model whole up to here (12,000 before 28 Sep 2026: a dense slide lost its tail). */
const REPLICATE_SOURCE_CHARS = 40_000;

/**
 * Chapter opt-out. It lives in the user message, not the system prompt: the
 * system prompt is built once at module load and its "agenda mirrors the
 * dividers" rule is the default, so this overrides it per request.
 */
const NO_CHAPTERS =
  '\n- This deck has NO chapters: never use the "agenda" or "section-divider" layouts. Carry the structure with the content slides themselves and let each one stand on its own.';

/**
 * Chapter opt-in, the twin of NO_CHAPTERS (Mario, 5 Oct 2026). Without it the
 * prompt only allowed chapters ("only for decks of 6+ slides", "or leave the
 * chapters out"), and 15 decks in 18 with Chapters on came back without them.
 * lib/slides/chapters.ts is the safety net when the model still skips them.
 */
const HAS_CHAPTERS =
  '\n- This deck HAS chapters, the user turned them on: the slide right after the cover MUST be an "agenda", and each chapter MUST open with its own "section-divider" whose title is the matching agenda bullet. Use 2 to 4 chapters that follow the story, never leave them out.';

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
  const noChapters = body.chapters === false ? NO_CHAPTERS : body.chapters === true ? HAS_CHAPTERS : "";
  const language = body.language ? ` The brief is in ${body.language}: write every slide in ${body.language}.` : "";
  const notes = body.briefNotes?.trim() ? `\n\nThe user answered questions about this brief; these answers rank with the brief: ${body.briefNotes.trim()}` : "";
  switch (body.mode) {
    case "add": {
      const n = body.count ?? 3;
      return `Existing deck (JSON): ${JSON.stringify(body.existingSlides ?? [])}\n\nDeck brief: ${body.brief}${brand}${language}${notes}\n\nRequest: ${body.instruction?.trim() || "continue and deepen the story"}\n\nAdd exactly ${n} new slide${n === 1 ? "" : "s"} fulfilling the request.\n- Return ONLY the new slides in "slides": never repeat, rewrite or include existing slides, and never add another cover, agenda or thank-you.\n- Give every new slide "after": the 1-based index of the existing slide it belongs after (0 = before the first slide), where it fits the story and the order of the material, inside the chapter it belongs to, never after a thank-you. New slides that go together share the number, in reading order. Set "insertAfter" to the first new slide's "after".\n- If the deck has an "agenda" slide, return its updated bullets (reflecting the deck after insertion, <=5 words each) in "agenda"; otherwise return an empty array.${body.chapters === false ? NO_CHAPTERS : ""}`;
    }
    case "replicate": {
      // A second attempt says what the first one changed, quoted, with that answer to fix.
      const repair = body.repair?.trim()
        ? `\n\n${body.repair.trim().slice(0, 6000)}${body.previous ? `\nYour first answer (JSON): ${JSON.stringify(body.previous).slice(0, 12000)}` : ""}`
        : "";
      return `Deck brief: ${body.brief}${brand}${language}${notes}\n\n${REPLICATE_NOTE}\n\n${body.sourceContext ?? ""}\n\nSource slide:\n<<<\n${(body.source ?? "").slice(0, REPLICATE_SOURCE_CHARS)}\n>>>${repair}`;
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
        body.chapters !== true
          ? ""
          : typeof body.count === "number" && body.count < 12
            ? " (the agenda and the section dividers count too: with this length use exactly two chapters, so the content keeps most of the slides)"
            : " (the agenda and the section dividers count too)";
      const length = body.perItem
        ? typeof body.count === "number"
          ? `The brief asks for one slide per item and names ${body.count}: that is the number of items, not the size of the deck. Make exactly one slide for each item the brief lists, then add the cover and the closing slide on top${body.chapters === true ? ", and the agenda and a divider before each chapter" : ""}.`
          : `The brief asks for one slide per item: make exactly one slide for each item it lists, plus the cover and the closing slide${body.chapters === true ? ", and the agenda and a divider before each chapter" : ""}.`
        : typeof body.count === "number"
          ? `Produce exactly ${body.count} slides, no more and no fewer, counting the cover and the closing slide${chaptersCount}.`
          : `Choose the number of slides yourself (typically 8-14; when the brief asks to carry long material in full, as many as it takes, up to ${MAX_SLIDES}). A "page" in the brief means a slide.`;
      return `Brief: ${body.brief}${brand}${language}${notes}\n\nCreate the deck that best tells this story. ${length}${noChapters}`;
    }
  }
}

/**
 * Replicating a document as a two-pager (Mario, 6 Oct 2026): the same promise
 * as a slide replica, every text kept, in one call because the pages share
 * one budget. The fit pass then only tightens the type, it never cuts.
 */
const REPLICATE_PAGES = (n: number) =>
  `Rebuild the document below as a two-pager of exactly ${n} pages on the brand. Keep every line of its text and every figure exactly as written: its title becomes the banner, its headings become section labels, its paragraphs stay paragraphs, its lists stay bullets, a table stays rows. Never shorten, summarise, merge, reorder or reword, and never add a sentence the document does not have. A figure may also go on a stat card, but it stays in the text where the document writes it. On a stat card the figure is "label" and what it counts is "body", never one of them empty: when the document lists its figures and their captions apart (a row of figures, then a row of captions), pair them in order. Pick the archetype and the blocks whose shape matches the document. The page budget does not apply: use all the text the document has. The document's own running header, footer and page numbers are not content. Write in the document's language.`;

function buildPageUserMessage(body: GenerateBody): string {
  const brand = body.brandLabel
    ? ` The piece carries the "${body.brandLabel}" lockup: that sets its logo, not its subject.`
    : "";
  const language = body.language ? ` The brief is in ${body.language}: write every page in ${body.language}.` : "";
  const notes = body.briefNotes?.trim()
    ? `\n\nThe user answered questions about this brief; these answers rank with the brief: ${body.briefNotes.trim()}`
    : "";
  switch (body.mode) {
    case "add": {
      const n = body.count ?? 1;
      return `Existing pages (JSON): ${JSON.stringify(body.existingSlides ?? [])}\n\nBrief: ${body.brief}${brand}${language}${notes}\n\nRequest: ${body.instruction?.trim() || "continue the piece"}\n\nAdd exactly ${n} new page${n === 1 ? "" : "s"} fulfilling the request. Return ONLY the new pages, never repeat an existing one, never open them with a banner, and keep the same "archetype" and "footerLabel".\n- Set "insertAfter" to the 1-based index of the existing page the new ones belong after (0 = before the first).`;
    }
    case "regenerate":
      return `Current page (JSON): ${JSON.stringify(body.targetSlide)}\n\nBrief: ${body.brief}${brand}${language}\n\nRewrite this single page.${body.instruction ? ` Instruction: ${body.instruction}` : " Improve the copy."} Keep the same kinds of blocks and the same amount of text unless the instruction asks otherwise, keep the budget of the page, and return exactly one page.`;
    default: {
      const n = body.count ?? 2;
      if (body.source) {
        // Second pass: what the first answer changed, quoted, so this one keeps it.
        const repair = body.repair?.trim() ? `\n\n${body.repair.trim().slice(0, 6000).replace("for this slide", "for this two-pager")}` : "";
        return `Brief: ${body.brief}${brand}${notes}\n\n${REPLICATE_PAGES(n)}\n\nDocument:\n<<<\n${body.source.slice(0, REPLICATE_SOURCE_CHARS)}\n>>>${repair}`;
      }
      return `Brief: ${body.brief}${brand}${language}${notes}\n\nWrite the two-pager that tells this story in exactly ${n} page${n === 1 ? "" : "s"}.`;
    }
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
          takeaway: { type: "string" },
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
          "takeaway",
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
 * Output schema for two-pager pages. One flat block object, every field
 * required, an enum for the type and no `oneOf`: a union per block type is
 * the grammar that comes back as "Schema is too complex". `archetype` is
 * emitted first on purpose, so the model commits to a shape before it writes.
 */
const PAGE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["para", "bullet"] },
    group: { type: "string" },
    label: { type: "string" },
    body: { type: "string" },
    extra: { type: "string" },
    icon: { type: "string" },
    photo: { type: "string" },
  },
  required: ["kind", "group", "label", "body", "extra", "icon", "photo"],
  additionalProperties: false,
} as const;

export const PAGE_BLOCK_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...AI_BLOCK_TYPES] },
    rail: { type: "string" },
    heading: { type: "string" },
    highlight: { type: "string" },
    sub: { type: "string" },
    lead: { type: "string" },
    body: { type: "string" },
    map: { type: "string" },
    photo: { type: "string" },
    accent: { type: "integer" },
    items: { type: "array", items: PAGE_ITEM_SCHEMA },
  },
  required: ["type", "rail", "heading", "highlight", "sub", "lead", "body", "map", "photo", "accent", "items"],
  additionalProperties: false,
} as const;

const PAGES_ARRAY = {
  type: "array",
  items: {
    type: "object",
    properties: {
      // The running footer is set on each page as it streams in, instead of
      // arriving after the last one.
      footerLabel: { type: "string" },
      blocks: { type: "array", items: PAGE_BLOCK_SCHEMA },
    },
    required: ["footerLabel", "blocks"],
    additionalProperties: false,
  },
} as const;

export const PAGES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    archetype: { type: "string", enum: ARCHETYPES.map((a) => a.id) },
    pages: PAGES_ARRAY,
  },
  required: ["archetype", "pages"],
  additionalProperties: false,
} as const;

/** The fit pass's rewrite (app/api/page-shorten): one block back, shorter. */
export const SHORTEN_OUTPUT_SCHEMA = {
  type: "object",
  properties: { block: PAGE_BLOCK_SCHEMA },
  required: ["block"],
  additionalProperties: false,
} as const;


/** "add" mode for pages: the new pages plus where they go. */
export const ADD_PAGES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    insertAfter: { type: "integer" },
    archetype: PAGES_OUTPUT_SCHEMA.properties.archetype,
    pages: PAGES_ARRAY,
  },
  required: ["insertAfter", "archetype", "pages"],
  additionalProperties: false,
} as const;

export type { GenerateBody };
