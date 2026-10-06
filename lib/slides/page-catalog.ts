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
      'rail(the section label, <=28 chars, sentence case, e.g. "The challenge", "What we do"), items(1-5: kind "para"|"bullet", label(bold lead-in such as a country or programme name followed by a full stop, <=24 chars, usually empty), body(a paragraph, <=480 chars; a bullet <=160 chars))',
  },
  {
    type: "stats",
    usage: "Headline figures in cards: 3 or 4 in a row, or 6 as two rows of 3. Only figures the brief gives",
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
    type: "compare",
    usage: "Progress before vs today, grouped by country or programme. Only when the brief gives both states",
    fields:
      'heading(<=60 chars, e.g. "Progress since 2023"), sub(first column head, e.g. "2023-2024"), lead(second column head, e.g. "Today"), items(2-9 rows: group(the country or programme, the same on consecutive rows), label(the area, <=22 chars), body(before, <=95 chars), extra(today, <=95 chars))',
  },
  {
    type: "asks",
    usage: "Opportunities or asks for a partner, each a labelled paragraph: what it is, then how the partner could help",
    fields: "heading(<=80 chars, e.g. \"Shaping the next phase together\"), items(2-4: label(<=40 chars), body(<=520 chars))",
  },
  {
    type: "panels",
    usage: "Two headed columns: what is running vs what is asked for (the second one is the ask)",
    fields:
      'items(exactly 2: label(column head, <=35 chars), body(lines, each bullet on its own line starting with "- ", <=600 chars)), accent(1 when the second column is the ask, else -1)',
  },
  {
    type: "photos",
    usage: "Two or four photo cards for programmes or places. The photos come from the library",
    fields: "rail(<=28 chars), items(2 or 4: label(<=28 chars), body(<=60 chars))",
  },
  {
    type: "contacts",
    usage: "Who to write to. Last block of the last page, and only if the brief names people",
    fields: "rail(\"Contact\"), items(1-4: label(name), body(role, team), extra(email address))",
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
    page2: "section (a flagship initiative), compare (before vs today, optional), asks (the next phase)",
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
    when: "Explaining a tool, a product or a pilot: what it is, how it works, where it stands",
    page1: "banner, section (what it is), section (the problem it solves), stats (3), pillars (how it works)",
    page2: "section (where it stands), figure or photos (optional), section (what's next), asks or panels, contacts (optional)",
  },
] as const;
export type ArchetypeId = (typeof ARCHETYPES)[number]["id"];

// Every AI-selectable block needs a catalog entry, checked at load.
const covered = new Set(PAGE_CATALOG.map((c) => c.type));
for (const type of AI_BLOCK_TYPES) {
  if (!covered.has(type)) throw new Error(`page-catalog.ts missing entry for block "${type}"`);
}
