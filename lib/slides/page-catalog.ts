import { AI_BLOCK_TYPES, type PageBlockType } from "./pages/schema";

export interface PageCatalogEntry {
  type: PageBlockType;
  /** One-line usage guidance shown to the model. */
  usage: string;
  /** Field spec shown to the model, with hard word limits. */
  fields: string;
  /**
   * Roughly how much of one A4 page the block takes, out of 100. The model is
   * told to keep a page's weights under 100: a page is a fixed sheet, and a
   * stack that runs past it is clipped rather than reflowed. This is the print
   * twin of the fit-budget/word-limit pairing on slides — change a block's
   * geometry and this number has to be re-checked with it.
   */
  weight: number;
}

/**
 * The AI-facing block catalog. Keep each line tight: it is compiled into the
 * system prompt, and prompt size drives latency and cost on every call.
 */
export const PAGE_CATALOG: PageCatalogEntry[] = [
  {
    type: "title",
    usage: "Page title. First block of the opening page of a piece; it also brings the UNICEF masthead",
    fields: "heading(<=14 words)",
    weight: 16,
  },
  {
    type: "lede",
    usage: "The paragraph under a title, saying what the piece is",
    fields: "lead(bold opener, <=4 words, may be empty), body(<=45 words)",
    weight: 10,
  },
  {
    type: "rail-prose",
    usage: "The workhorse: a labelled section of running text. Use it for most content",
    fields:
      'rail(section label, <=4 words), items(1-14: kind "para"|"bullet"|"number", label(bold opener, <=4 words, may be empty), body(<=45 words), extra(""))',
    weight: 9,
  },
  {
    type: "status-callout",
    usage: "A bordered note flagging the state of something (concept, prototype, no live service)",
    fields: 'lead(<=2 words, e.g. "Status:"), body(<=45 words)',
    weight: 10,
  },
  {
    type: "stat-cards",
    usage: "Two to six numbers in a row of cards. Only real figures from the brief",
    fields:
      "items(2-6: label(the number, <=6 chars), body(what it counts, <=8 words), extra(\"\")), accent(index of the card to highlight, -1 for none)",
    weight: 12,
  },
  {
    type: "icon-columns",
    usage: "Two or three short columns, each an area of work with an icon",
    fields: "items(2-3: label(<=2 words), body(<=20 words), extra(\"\"))",
    weight: 16,
  },
  {
    type: "photo-cards",
    usage: "One to four photo cards. The photos are placeholders the user replaces",
    fields: "items(1-4: label(<=3 words), body(<=8 words), extra(\"\"))",
    weight: 23,
  },
  {
    type: "two-col-panels",
    usage: "Two headed columns side by side: what is running against what is being asked for",
    fields:
      "items(exactly 2: label(column head, <=5 words), body(<=90 words), extra(\"\")), accent(index of the column to fill with the attention colour, -1 for none)",
    weight: 28,
  },
  {
    type: "figure-split",
    usage: "A framed figure with explaining text beside it. The image is a placeholder",
    fields: "tag(pill above the text, <=2 words, may be empty), body(<=45 words)",
    weight: 29,
  },
  {
    type: "screens-flow",
    usage: "Two or three product screenshots with arrows between them. Only when the brief is about a working tool",
    fields: "items(2-3: label(\"\"), body(\"\"), extra(\"\"))",
    weight: 28,
  },
  {
    type: "table",
    usage: "A three-column comparison, e.g. category / today / next",
    fields:
      "heading(column 1 head, <=3 words), sub(column 2 head, <=3 words), lead(column 3 head, <=3 words), items(1-8 rows: label, body, extra — each <=8 words)",
    weight: 17,
  },
  {
    type: "numbered-badges",
    usage: "A numbered list of asks, each one a full sentence",
    fields: "items(1-6: label(\"\"), body(<=35 words), extra(\"\"))",
    weight: 14,
  },
  {
    type: "contacts",
    usage: "Who to write to. Last block of the last page",
    fields:
      "rail(<=2 words, e.g. Contact), items(1-4: label(name), body(/ role, team), extra(email address))",
    weight: 11,
  },
  {
    type: "divider",
    usage: "A hairline, used once before the contacts block",
    fields: "no fields",
    weight: 1,
  },
];

// Every AI-selectable block needs a catalog entry, checked at compile time —
// the same guard catalog.ts has for layouts.
const covered = new Set(PAGE_CATALOG.map((c) => c.type));
for (const type of AI_BLOCK_TYPES) {
  if (!covered.has(type)) throw new Error(`page-catalog.ts missing entry for block "${type}"`);
}
