import type { LayoutId } from "./schema";
import { AI_LAYOUT_IDS } from "./schema";

export interface CatalogEntry {
  id: LayoutId;
  /** One-line usage guidance shown to the model. */
  usage: string;
  /** Field spec string shown to the model, with hard word limits. */
  fields: string;
}

/**
 * The AI-facing layout catalog. Keep each line tight: this is compiled into
 * the system prompt, and prompt size drives latency and cost.
 */
export const CATALOG: CatalogEntry[] = [
  { id: "cover", usage: "Opening slide, always first", fields: "title(<=6 words), subtitle(<=10 words)" },
  { id: "agenda", usage: "Deck overview, right after cover on decks of 6+ slides", fields: "title(1 word e.g. Agenda), bullets(2-9 items, <=5 words each)" },
  { id: "three-columns", usage: "1-3 parallel points on a dark surface (pillars, streams, priorities)", fields: "title(<=3 words), blocks(1-3: label <=3 words, body <=20 words)" },
  { id: "callout", usage: "The signature partnership callout: What/Give/Get/KPIs rows + image", fields: "title(<=5 words), blocks(2-4: label 1-2 words; body <=8 words with 4 blocks, <=16 with 3, <=32 with 2 — hard limits, text does not shrink)" },
  { id: "section-divider", usage: "Full-bleed chapter opener between sections", fields: "title(<=5 words)" },
  { id: "big-stat", usage: "One hero number that carries the argument, dark surface", fields: "stat(<=8 chars e.g. 1.4M), support(<=35 words)" },
  { id: "quote", usage: "Pull-quote from a person, green surface, use at most once", fields: "quote(<=24 words, no quotation marks), author(name or name+role)" },
  { id: "section-image-deep", usage: "Section intro with photo, deep blue surface", fields: "title(<=6 words), body(<=45 words)" },
  { id: "section-image-light", usage: "Section intro with photo, light surface", fields: "title(<=6 words), body(<=45 words)" },
  { id: "four-cards", usage: "1-4 labelled cards (4 = 2x2 grid, fewer = wider cards); What/Give/Get/KPIs or similar", fields: "title(<=6 words), blocks(1-4: label 1-2 words, body <=16 words)" },
  { id: "list", usage: "5-6 labelled points in rows (KRs, requirements, criteria). NOT for 4 or fewer points: those go on four-cards, icon-cards, steps, callout or example-image", fields: "title(<=10 words), blocks(1-6: label <=2 words e.g. KR1, body <=30 words with 5-6 rows, <=45 with 4, <=60 with fewer)" },
  { id: "steps", usage: "Numbered process, 3 or 4 steps", fields: "title(<=6 words), blocks(2-4: label <=2 words, body <=8 words)" },
  { id: "body-copy", usage: "Running prose in two columns; only when text truly needs a full slide", fields: 'title(<=6 words), blocks(2: label always "", body 40-60 words each — two halves of one continuous text)' },
  { id: "photo", usage: "Full-width photo under a title; visual pause or context", fields: "title(<=6 words)" },
  { id: "icon-cards", usage: "2-4 points with icons (globe, wifi, school, chart)", fields: "title(<=6 words), blocks(2-4: label <=2 words, body <=12 words)" },
  { id: "stat-grid", usage: "Up to six KPI numbers beside a title", fields: "title(<=8 words), stats(1-6: value a figure like 61% or 1.4M <=5 chars, label <=5 words)" },
  { id: "brand-equity", usage: "Intro paragraph + six supporting stats (research findings)", fields: "title(<=6 words), body(<=35 words), stats(3-6: value a figure <=5 chars, label <=14 words)" },
  { id: "two-stats", usage: "1-2 numbers with explanations", fields: "title(<=8 words), stats(1-2: value a figure <=6 chars, label <=15 words)" },
  { id: "single-stat", usage: "One oversized number with explanation, light surface", fields: "title(<=8 words), stat(a figure <=6 chars), support(<=30 words)" },
  { id: "chart-bars", usage: "Column chart of a simple trend or distribution", fields: "title(<=4 words), bars(2-5: label <=2 words, value = real number from the brief; chart scales to the max)" },
  { id: "donut-chart", usage: "Share-of-total breakdown as a donut with legend", fields: "title(<=6 words), bars(2-5: label <=4 words, value = share, sums roughly to 100)" },
  { id: "chart-columns-wide", usage: "Column chart of many categories (countries, months), full width", fields: "title(<=8 words), bars(6-30: label <=2 words, value = real number)" },
  { id: "chart-bars-horizontal", usage: "Ranking as horizontal bars, largest first", fields: "title(<=8 words), bars(3-15: label <=4 words, value = real number, sorted descending)" },
  { id: "chart-line", usage: "Trend over time, one to three lines", fields: "title(<=8 words), series(1-3 names <=3 words), bars(3-24: label = period <=2 words, values = one real number per series, in series order)" },
  { id: "chart-columns-grouped", usage: "Two or three measures side by side per category (2024 vs 2025); the series are measures every category has, never the categories themselves", fields: "title(<=8 words), series(2-3 names <=3 words), bars(2-10: label <=2 words, values = one real number per series)" },
  { id: "chart-columns-stacked", usage: "Composition: parts of a total per category; the series are parts every category has, never the categories themselves (one figure per category is chart-bars or chart-columns-wide)", fields: "title(<=8 words), series(2-4 part names <=3 words), bars(2-10: label <=2 words, values = one real number per part)" },
  { id: "timeline", usage: "Chronological milestones, 4 or 5 points", fields: "title(<=3 words), blocks(4-5: label = year or date, body <=6 words)" },
  { id: "progress", usage: "Where a process or programme stands: 3-6 stages on a progress bar, done / in progress / next. Use when the brief says which stage is under way", fields: "title(<=8 words), blocks(3-6 stages: label <=3 words, body <=12 words with 3-4 stages, <=8 with 5-6), current(the stage in progress, 1-based, only when the brief says it; else 0)" },
  { id: "timeline-phases", usage: "Project phases with months", fields: "title(<=4 words), blocks(2-5: label = month(s), body <=7 words)" },
  { id: "example-image-left", usage: "Two labelled paragraphs + full-height photo left", fields: "title(<=6 words), blocks(1-2: label 1-2 words, body <=30 words)" },
  { id: "example-image-right", usage: "Two labelled paragraphs + full-height photo right", fields: "title(<=6 words), blocks(1-2: label 1-2 words, body <=30 words)" },
  { id: "partner", usage: "Partner name wall on accent background; only when partners are named in the brief", fields: "title(<=3 words e.g. Our partners), bullets(2-15 partner names)" },
  { id: "thank-you", usage: "Closing slide, always last", fields: 'title(always exactly "Thanks"), contacts(1-2: name, role, location, email)' },
];

// Compile-time guarantee that the catalog covers every AI-selectable layout.
const covered = new Set(CATALOG.map((c) => c.id));
for (const id of AI_LAYOUT_IDS) {
  if (!covered.has(id)) throw new Error(`catalog.ts missing entry for layout "${id}"`);
}
