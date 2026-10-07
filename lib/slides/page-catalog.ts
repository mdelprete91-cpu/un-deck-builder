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
}

export const PAGE_CATALOG: PageCatalogEntry[] = [
  {
    type: "banner",
    usage: "First block of page 1: a photo strip with the piece's title over it. It also brings the masthead",
    fields: "heading(the title, <=95 chars, the topic and the angle, never 'Two-pager')",
  },
  {
    type: "title",
    usage: "A big page title, to open page 2 when it starts with a new theme",
    fields: "heading(<=55 chars), highlight(2-3 words copied exactly from heading, set in the accent, may be empty)",
  },
  {
    type: "section",
    usage: "The workhorse: a labelled section of running text. Most of a two-pager is sections",
    fields:
      'rail(the section label, <=28 chars, sentence case, e.g. "The challenge", "What we do"), items(1-8: kind "para"|"bullet"|"number" (a numbered list when the order matters), label(bold lead-in such as a country or programme name followed by a full stop, <=24 chars, usually empty), body(a paragraph, <=480 chars; a bullet <=160 chars))',
  },
  {
    type: "stats",
    usage: "Headline figures in cards: 3 in a row, 4 as two rows of 2, or 6 as two rows of 3; never more than 3 in a row. Only figures the brief gives",
    fields:
      'items(3, 4 or 6: label(the figure with its unit, <=7 chars: "2.2B", "44k+", "30-50%", "€120k"), body(what it counts, <=55 chars)), accent(index of one card to set in orange, the most striking, or -1)',
  },
  {
    type: "figure",
    usage: "A full-width image or country map under a title or between sections. One per piece at most",
    fields: "map(a country name when the piece is about one country, else \"\"), body(caption, <=110 chars, may be empty)",
  },
  {
    type: "pillars",
    usage: "Three areas of work side by side, each with an icon. After a section that introduces them",
    fields: 'items(3: label(<=22 chars), body(<=210 chars), icon(a Lucide icon name, e.g. "map-pin", "handshake", "hand-coins", "school", "wifi", "heart-pulse", "shield-check", "chart-column"))',
  },
  {
    type: "asks",
    usage: "Opportunities or asks for a partner, each a labelled paragraph: what it is, then how the partner could help",
    fields: "heading(<=80 chars, e.g. \"Shaping the next phase together\"), items(2-4: label(<=40 chars), body(<=520 chars))",
  },
  {
    type: "panels",
    usage: "Two headed columns compared side by side: what is running vs what is asked for, partners now vs partners wanted, before vs after (the US partnerships piece). Can be long: it runs on to the next page by itself",
    fields:
      'items(exactly 2: label(column head, <=40 chars), body(lines: "# Subhead" for a bold subhead, "- " for a bullet, "**Name**: text" for a bold name leading a line or bullet, otherwise a paragraph; <=1800 chars)), accent(1 when the second column is the ask, drawn in orange, else -1)',
  },
  {
    type: "photos",
    usage: "Two or four photo cards for programmes or places. The photos come from the library",
    fields: "rail(<=28 chars), items(2 or 4: label(<=28 chars), body(<=60 chars))",
  },
  {
    type: "heading",
    usage: "A title inside a page that opens a new part of it (e.g. \"The ask\" before the asks); never at the top of page 1",
    fields: "heading(<=50 chars)",
  },
  {
    type: "lede",
    usage: "A full-width paragraph right under a page title, saying what the piece is (with a title, not after a banner)",
    fields: "body(<=320 chars)",
  },
  {
    type: "callout",
    usage: "A bordered note on the state of a product or project (concept, prototype, pilot, no live service), right under the title",
    fields: 'lead(the label with its colon, e.g. "Status:"), body(<=320 chars)',
  },
  {
    type: "split",
    usage: "A framed panel: a short pill and a paragraph on the left, a picture or a country map on the right. For a phase, a region or a site",
    fields: 'tag(the pill, <=16 chars, e.g. "Phase 1"), body(<=300 chars), map(a country name when the panel is about one country, else ""), photo',
  },
  {
    type: "screens",
    usage: "Two screenshots of a product with arrows between them. Always when the brief asks for screenshots or screens; otherwise when the piece is about a digital tool, prototype included. The images are placeholders the user replaces",
    fields: 'rail(<=28 chars, may be empty), items(exactly 2: label(""), body(""))',
  },
  {
    type: "numbered",
    usage: "Asks or next steps, each a full sentence in a numbered circle. The block for what the reader is asked to do",
    fields: "rail(<=28 chars), items(1-6: body(<=220 chars))",
  },
  {
    type: "table",
    usage: "A small comparison with a header row: category / now / next, or option / cost / effect",
    fields: 'rail(<=28 chars, the table\'s title goes here, may be empty), heading(head of column 1), sub(head of column 2), lead(head of column 3): each a column name the rows fill, <=20 chars, never empty and never a title (e.g. "Phase", "Where and when", "Budget"); items(1-8 rows: label(column 1), body(column 2), extra(column 3), each <=60 chars)',
  },
  {
    type: "contacts",
    usage: "Who to write to. Last block of the last page, and only if the brief names people",
    fields: "rail(\"Contact\"), lead(one bold sentence before the names, e.g. what kind of partners are sought, may be empty), items(1-4: label(name), body(role, team), extra(email address))",
  },
];

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
