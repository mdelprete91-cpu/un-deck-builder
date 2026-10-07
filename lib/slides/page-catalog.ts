import { AI_BLOCK_TYPES, type PageBlockType } from "./pages/schema";

/**
 * The AI-facing block catalog and the archetypes of a two-pager (rebuilt
 * 6 Oct 2026 on the Estonia pieces). The limits are in characters and come
 * from the grid, not from taste: the text column is 435pt, about 85
 * characters of Open Sans 10pt per line; the label column is 100pt, about 16
 * characters of the 12pt label per line; a stat card's caption about 28.
 *
 * The model never sets geometry. Whether a page fits is measured after it is
 * drawn (pages/fit.ts), and the page budgets below only keep the first draft
 * close, so the fit pass has little to do.
 */
export interface PageCatalogEntry {
  type: PageBlockType;
  /** When to use it, one line. */
  usage: string;
  /** The fields it fills, with hard limits. */
  fields: string;
  /** The block spreadsheet (Mario, 7 Oct 2026): what part of a story it tells. */
  shape: string;
  /** How to recognise that part in a brief or a document. */
  signals: string;
  /** Its job for the reader: a visual anchor, something to scan, running text, or structure. */
  role: "anchor" | "scan" | "narrative" | "structure";
  /** What it holds, and about how much of an A4 page it takes (pt, of ~740). */
  capacity: string;
  /** When not to use it. */
  never: string;
}

export const PAGE_CATALOG: PageCatalogEntry[] = [
  {
    type: "banner",
    usage: "First block of page 1: a photo strip with the piece's title over it. It also brings the masthead",
    fields: "heading(the title, <=95 chars, the topic and the angle, never 'Two-pager')",
    shape: "the piece's title and topic",
    signals: "the document's title band; the opening of a new part with its own title band",
    role: "anchor",
    capacity: "1 title of 1-3 lines; ~130pt",
    never: "never mid-page; never on page 2 unless a new part of the document starts there",
  },
  {
    type: "title",
    usage: "A big page title, to open page 2 when it starts with a new theme",
    fields: "heading(<=55 chars), highlight(2-3 words copied exactly from heading, set in the accent, may be empty)",
    shape: "a page or product title without a picture",
    signals: "a product or programme name with its promise; a new theme opening a page",
    role: "structure",
    capacity: "1-2 lines; ~70pt",
    never: "never for a figure ('2.3M Schools') or a partner name; never a title the document does not have",
  },
  {
    type: "section",
    usage: "The workhorse: a labelled section of running text. Most of a two-pager is sections",
    fields:
      'rail(the section label, <=28 chars, sentence case, e.g. "The challenge", "What we do"), items(1-8: kind "para"|"bullet"|"number" (a numbered list when the order matters), label(bold lead-in such as a country or programme name followed by a full stop, <=24 chars, usually empty), body(a paragraph, <=480 chars; a bullet <=160 chars))',
    shape: "running text under a label",
    signals: "paragraphs or a short list under a heading",
    role: "narrative",
    capacity: "1-8 paragraphs or bullets; ~15pt a line",
    never: "never three in a row; never for figures, settings or side-by-side columns; split one over ~900 chars",
  },
  {
    type: "stats",
    usage: "Headline figures in cards: 3 in a row, 4 as two rows of 2, or 6 as two rows of 3; never more than 3 in a row. Only figures the brief gives",
    fields:
      'items(3, 4 or 6: label(the figure with its unit, <=7 chars: "2.2B", "44k+", "30-50%", "€120k"), body(what it counts, <=55 chars)), accent(index of one card to set in orange, the most striking, or -1)',
    shape: "headline figures",
    signals: "a number written large with what it counts under it, in a row",
    role: "anchor",
    capacity: "3, 4 or 6 cards; ~110pt a row",
    never: "never without real figures; never a page number; never a caption from another line",
  },
  {
    type: "figure",
    usage: "A full-width image or country map under a title or between sections. One per piece at most",
    fields: "map(a country name when the piece is about one country, else \"\"), body(caption, <=110 chars, may be empty)",
    shape: "a map or a photo of the place",
    signals: "the piece is about one country, or the document shows a full-width picture",
    role: "anchor",
    capacity: "1 image; ~220pt",
    never: "never twice in a piece",
  },
  {
    type: "pillars",
    usage: "Three areas of work side by side, each with an icon. After a section that introduces them",
    fields: 'rail(the side title when the document gives one, else ""), items(3: label(<=22 chars), body(<=210 chars), icon(a Lucide icon name, e.g. "map-pin", "handshake", "hand-coins", "school", "wifi", "heart-pulse", "shield-check", "chart-column"))',
    shape: "three areas of work",
    signals: "three parallel items with a bold title and a short text, often with icons",
    role: "scan",
    capacity: "3 columns; ~120pt",
    never: "never for more or fewer than 3",
  },
  {
    type: "asks",
    usage: "Opportunities or asks for a partner, each a labelled paragraph: what it is, then how the partner could help",
    fields: "heading(<=80 chars, e.g. \"Shaping the next phase together\"), items(2-4: label(<=40 chars), body(<=520 chars))",
    shape: "opportunities for a partner",
    signals: "labelled paragraphs, each an opportunity and how the partner could help",
    role: "scan",
    capacity: "2-4 paragraphs; ~60pt each",
    never: "never for a short list (use numbered)",
  },
  {
    type: "panels",
    usage: "Two headed columns compared side by side: what is running vs what is asked for, partners now vs partners wanted, before vs after (the US partnerships piece). Can be long: it runs on to the next page by itself",
    fields:
      'items(exactly 2: label(column head, <=40 chars), body(lines: "# Subhead" for a bold subhead, "- " for a bullet, "**Name**: text" for a bold name leading a line or bullet, otherwise a paragraph; <=1800 chars)), accent(1 when the second column is the ask, drawn in orange, else -1)',
    shape: "two sides compared",
    signals: "two headed columns side by side (now vs asked, partners vs prospects, before vs after)",
    role: "scan",
    capacity: "2 long columns, runs on to the next page; ~15pt a line",
    never: "never split into two tables; never flattened into sections",
  },
  {
    type: "photos",
    usage: "Photo cards for programmes, places or settings, two to a row. The photos come from the library",
    fields: "rail(<=28 chars), items(2 to 6: label(<=28 chars), body(<=60 chars))",
    shape: "places, settings or programmes",
    signals: "2-6 short items, each a name and one line, about where the work happens or who it reaches",
    role: "anchor",
    capacity: "2-6 cards, 2 to a row; ~150pt a row",
    never: "never for abstract ideas with no fitting library photo",
  },
  {
    type: "heading",
    usage: "A title inside a page that opens a new part of it (e.g. \"The ask\" before the asks); never at the top of page 1",
    fields: "heading(<=50 chars)",
    shape: "the start of a new part inside a page",
    signals: "a subtitle that opens the ask or a new theme mid-page",
    role: "structure",
    capacity: "1 line; ~40pt",
    never: "never at the top of page 1; never invented",
  },
  {
    type: "lede",
    usage: "A full-width paragraph right under a page title, saying what the piece is (with a title, not after a banner)",
    fields: "body(<=320 chars)",
    shape: "what the piece is, in one paragraph",
    signals: "the opening paragraph under the title, with no label of its own",
    role: "narrative",
    capacity: "1 paragraph; ~60pt",
    never: "never after a banner when the paragraph has a label",
  },
  {
    type: "callout",
    usage: "A bordered note on the state of a product or project (concept, prototype, pilot, no live service), right under the title",
    fields: 'lead(the label with its colon, e.g. "Status:"), body(<=320 chars)',
    shape: "where a product or project stands",
    signals: "a status line: concept, prototype, pilot, live",
    role: "scan",
    capacity: "1-2 lines; ~45pt",
    never: "never for general text",
  },
  {
    type: "split",
    usage: "A framed panel: a short pill and a paragraph on the left, a picture or a country map on the right. For a phase, a region or a site",
    fields: 'tag(the pill, <=16 chars, e.g. "Phase 1"), body(<=300 chars), map(a country name when the panel is about one country, else ""), photo',
    shape: "one phase, region or site with its picture",
    signals: "a short tagged paragraph beside a map or a picture",
    role: "anchor",
    capacity: "1 panel; ~210pt",
    never: "never more than one per page",
  },
  {
    type: "screens",
    usage: "Two screenshots of a product with arrows between them. Always when the brief asks for screenshots or screens; otherwise when the piece is about a digital tool, prototype included. The images are placeholders the user replaces",
    fields: 'rail(<=28 chars, may be empty), items(exactly 2: label(""), body(""))',
    shape: "what a digital tool looks like",
    signals: "the brief asks for screenshots, or the piece is about an app or platform",
    role: "anchor",
    capacity: "2 screenshots; ~190pt",
    never: "never for non-digital work",
  },
  {
    type: "numbered",
    usage: "Asks or next steps, each a full sentence in a numbered circle. The block for what the reader is asked to do",
    fields: "rail(<=28 chars), items(1-6: body(<=220 chars))",
    shape: "what the reader is asked to do",
    signals: "asks or next steps, one sentence each, where the order matters",
    role: "scan",
    capacity: "1-6 points; ~35pt each",
    never: "never for long paragraphs",
  },
  {
    type: "table",
    usage: "A small comparison with a header row: category / now / next, or option / cost / effect",
    fields: 'rail(<=28 chars, the table\'s title goes here, may be empty), heading(head of column 1), sub(head of column 2), lead(head of column 3): each a column name the rows fill, <=20 chars, never empty and never a title (e.g. "Phase", "Where and when", "Budget"); items(1-8 rows: label(column 1), body(column 2), extra(column 3), each <=60 chars)',
    shape: "a small grid of facts",
    signals: "rows with the same 2-5 attributes (phase, where, when, budget)",
    role: "scan",
    capacity: "1-8 rows; ~30pt a row",
    never: "never as a title, never for two long columns of prose (use panels)",
  },
  {
    type: "contacts",
    usage: "Who to write to. Last block of the last page, and only if the brief names people",
    fields: "rail(\"Contact\"), lead(one bold sentence before the names, e.g. what kind of partners are sought, may be empty), items(1-4: label(name), body(role, team), extra(email address))",
    shape: "who to write to",
    signals: "named people with a role and an email",
    role: "structure",
    capacity: "1-4 people; ~40pt each",
    never: "never without names the brief gives; never anywhere but last",
  },
];

/**
 * The block spreadsheet as the model reads it: one row per block, the part
 * of a story it tells, how to recognise that part, its job for the reader,
 * what it holds and when not to use it. tools/export-catalog.ts writes the
 * same table to docs/two-pager-blocks.csv for people.
 */
export const CATALOG_COLUMNS = ["block", "story shape", "signals in the source", "role", "capacity", "never when", "fields"] as const;
export function catalogRows(): string[][] {
  return PAGE_CATALOG.map((c) => [c.type, c.shape, c.signals, c.role, c.capacity, c.never, c.fields]);
}
export function catalogTable(): string {
  return [CATALOG_COLUMNS.slice(0, 6).join(" | "), ...PAGE_CATALOG.map((c) => [c.type, c.shape, c.signals, c.role, c.capacity, c.never].join(" | "))].join("\n");
}

/**
 * The shapes a two-pager takes, from the pieces Mario has made. The model
 * picks one first and follows its order; blocks marked optional may be left
 * out, and sections may be added where the material needs them.
 */
export const ARCHETYPES = [
  {
    id: "advocacy",
    name: "Advocacy brief",
    when: "Making the case for an issue or a way of working (the problem, why it matters, what we do, the evidence)",
    page1: "banner, section (the challenge), stats (3), section (why it matters), section (what we do), section (what the evidence shows, optional)",
    page2: "title, figure (optional), section (how it works / a proven model), stats (6, optional), section, pillars",
  },
  {
    id: "donor-update",
    name: "Donor or partner update",
    when: "Reporting to one partner what their support made possible, and what comes next",
    page1: "banner, section (the partner's investment), stats (4), section (results, one bold lead-in per country or programme)",
    page2: "section (a flagship initiative), table (before and today, optional), asks (the next phase)",
  },
  {
    id: "partnership",
    name: "Partnership brief",
    when: "Presenting an offer or a programme to prospective partners, with explicit asks",
    page1: "banner, section (the opportunity), stats (3 or 4), section (what we do), pillars (optional)",
    page2: "section (where we work / track record), photos (optional), panels (running vs asks), contacts (optional)",
  },
  {
    id: "product",
    name: "Product or initiative brief",
    when: "Explaining a tool, a product or a pilot to a partner or a regulator: what it is, where it stands, what is asked (the Spectrum and Lunar pieces)",
    page1: "title (the product and what it does), lede (optional), callout (its status), section (what it is), screens (two screenshots of the tool, prototype included; always when the brief asks for them)",
    page2: "table (when the brief gives phases, options or costs), heading (opens the ask), numbered (the asks), section (other contexts or uses, optional), contacts",
  },
  {
    id: "programme-ask",
    name: "Programme brief with an ask",
    when: "A programme or project presented to a funder or a regulator, with a phase and concrete asks (the Songbird piece)",
    page1: "title (the programme and its promise), section (what it is, with bullets for its principles), split (the current phase and its map or picture), numbered (the asks)",
    page2: "numbered (the asks, continued) or sections, contacts (optional)",
  },
] as const;
export type ArchetypeId = (typeof ARCHETYPES)[number]["id"];

// Every AI-selectable block needs a catalog entry, checked at load.
const covered = new Set(PAGE_CATALOG.map((c) => c.type));
for (const type of AI_BLOCK_TYPES) {
  if (!covered.has(type)) throw new Error(`page-catalog.ts missing entry for block "${type}"`);
}
