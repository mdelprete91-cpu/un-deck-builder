import { parseFigure } from "./repeats";
import type { SlideContent } from "./schema";

/**
 * Only figures that exist, with a source (Mario, 13 Oct 2026: "the deck
 * builder takes only data that really exists and has a source; it must not
 * invent numbers or things that do not exist"). A rule in the prompt is not
 * enough (a funnel of 100, 75, 50 appeared from a page that has no such
 * figures), so every figure the model writes is looked up in the sources the
 * request carried: the brief, the user's answers, the attached and linked
 * text, the knowledge base's pages and Giga's own facts. A figure found in none
 * of them leaves the slide: the sentence that carries it, the stat that shows
 * it, the slide when the figure was its point. A figure found only on a web
 * page (a linked page, the knowledge base, giga.global) gets a footnote
 * naming that page and the date it was read.
 */
export interface Source {
  /** "giga.global", "techafricanews.com": what the footnote names. */
  label: string;
  text: string;
  /** YYYY-MM-DD: when it was published or read. */
  date?: string;
  /** The page, when the source is one. */
  url?: string;
  /** The user's own words or files: never footnoted (they know where it comes from). */
  own: boolean;
}

/** A figure in running text: not glued to a letter before it ("Q4", "G20"), with its unit after. */
const FIGURE = /(?<![\p{L}\d.,])[$€£]?\d[\d,]*(?:\.\d+)?\s?(?:%|(?:k|m|b|bn|million|billion|thousand|milioni|miliardi|millones)\b)?\+?/giu;

export function figuresIn(text: string): string[] {
  return [...text.matchAll(FIGURE)].map((m) => m[0].trim()).filter(Boolean);
}

const UNITS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/**
 * Numbers a source spells out ("about sixty percent", "eighteen months") as
 * digits, so a slide's "60%" is found in a transcript that says it in words.
 */
export function spelledToDigits(text: string): string {
  return text
    .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](one|two|three|four|five|six|seven|eight|nine))?\b/gi, (_, t: string, u?: string) => String(TENS[t.toLowerCase()] + (u ? UNITS[u.toLowerCase()] : 0)))
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi, (w: string) => String(UNITS[w.toLowerCase()]))
    .replace(/(\d)\s*(?:per\s?cent|percent|per cento)\b/gi, "$1%")
    .replace(/(\d)\s+hundred\b/gi, "$100")
    .replace(/(\d)\s+thousand\b/gi, "$1,000");
}

/** The figures of every source, as numbers, and which sources hold each. */
export function indexSources(sources: Source[]): Map<string, Source[]> {
  const index = new Map<string, Source[]>();
  for (const s of sources)
    for (const raw of figuresIn(spelledToDigits(s.text))) {
      const f = parseFigure(raw);
      if (!f) continue;
      const list = index.get(f) ?? [];
      if (!list.includes(s)) list.push(s);
      index.set(f, list);
    }
  return index;
}

/** Small counts ("3 phases", "Step 2") and today's year are not figures a source must hold. */
function exempt(f: string, todayYear: number): boolean {
  const [kind, v] = [f.slice(0, 1), Number(f.slice(2))];
  if (kind === "n" && Number.isInteger(v) && Math.abs(v) <= 10) return true;
  if (kind === "n" && (v === todayYear || v === todayYear + 1)) return true;
  return false;
}

/** The sources holding a figure: the same number, or one it rounds (73.99% shown as 74%, 2,213,000 as 2.2M). */
export function sourcesOf(f: string, index: Map<string, Source[]>): Source[] {
  const exact = index.get(f);
  if (exact) return exact;
  const [kind, v] = [f.slice(0, 1), Number(f.slice(2))];
  for (const [k, list] of index) {
    if (k[0] !== kind) continue;
    const w = Number(k.slice(2));
    if (w === 0) continue;
    // Rounded to what the slide shows: the source figure, cut to as many significant digits, is the slide's.
    const digits = String(Math.abs(v)).replace(/^0\.?0*/, "").replace(".", "").replace(/0+$/, "").length || 1;
    const rounded = Number(w.toPrecision(Math.max(1, digits)));
    if (rounded === v || Math.abs(w - v) / Math.abs(w) <= 0.005) return list;
  }
  return [];
}

export interface FigureCheck {
  /** The slide with its unsourced figures taken out, or null when they were its point. */
  slide: SlideContent | null;
  removed: string[];
  /** Web pages the slide's figures come from, for the footnote. */
  cited: Source[];
}

/** Layouts that have no footnote row. */
const NO_NOTES = new Set(["cover", "agenda", "section-divider", "thank-you", "photo-full", "a4-page", "partner"]);
/** Layouts whose bars are relative heights, not figures (the catalog's chart-bars: 0-100). */
const RELATIVE_BARS = new Set(["chart-bars"]);

export function checkFigures(slide: SlideContent, index: Map<string, Source[]>, today = new Date()): FigureCheck {
  const year = today.getFullYear();
  const removed: string[] = [];
  const cited = new Set<Source>();
  const found = (raw: string, either = false) => {
    const f = parseFigure(raw);
    if (!f || exempt(f, year)) return true;
    // A chart's value is a bare number: its source may give it as a share ("40%") or a count.
    const src = sourcesOf(f, index).length || !either ? sourcesOf(f, index) : sourcesOf(`${f[0] === "n" ? "p" : "n"}:${f.slice(2)}`, index);
    if (!src.length) return false;
    // Footnote only when no source of the user's own holds it.
    if (!src.some((s) => s.own)) src.forEach((s) => cited.add(s));
    return true;
  };
  /** A text without the sentences whose figures no source holds. */
  const prose = (text: string | undefined) => {
    if (!text?.trim()) return text;
    const sentences = text.split(/(?<=[.!?;])\s+/);
    const kept = sentences.filter((s) => {
      const bad = figuresIn(s).filter((x) => !found(x));
      if (bad.length) removed.push(...bad);
      return !bad.length;
    });
    return kept.length === sentences.length ? text : kept.join(" ").trim();
  };
  const out: SlideContent = { ...slide };
  // The figure is the slide's point: a hero stat no source holds takes the slide with it.
  if (out.stat && !found(out.stat)) return { slide: null, removed: [out.stat], cited: [] };
  if (out.stats?.length) {
    const stats = out.stats.filter((x) => found(x.value) || (removed.push(x.value), false)).map((x) => ({ ...x, label: prose(x.label) ?? x.label }));
    if (!stats.length) return { slide: null, removed, cited: [] };
    out.stats = stats;
  }
  if (out.bars?.length && !RELATIVE_BARS.has(out.layoutId)) {
    const bad = out.bars.flatMap((b) => (b.values?.length ? b.values : [b.value]).map(String)).filter((v) => !found(v, true));
    // A chart is data: one value no source holds and the chart is not shown.
    if (bad.length) return { slide: null, removed: [...removed, ...bad], cited: [] };
  }
  for (const k of ["title", "subtitle", "body", "support", "quote", "takeaway"] as const) {
    if (typeof out[k] === "string") out[k] = prose(out[k] as string) as never;
  }
  if (out.bullets) out.bullets = out.bullets.map((b) => prose(b) ?? b).filter((b) => b.trim());
  if (out.blocks) {
    out.blocks = out.blocks
      .map((b) => ({ ...b, label: prose(b.label) ?? b.label, body: prose(b.body) ?? b.body, ...(b.items ? { items: b.items.map((x) => prose(x) ?? x).filter((x) => x.trim()) } : {}), ...(b.stats ? { stats: b.stats.filter((x) => found(x.value) || (removed.push(x.value), false)) } : {}) }))
      .filter((b) => b.label?.trim() || b.body?.trim() || b.items?.length || b.stats?.length);
    if (slide.blocks?.length && !out.blocks.length) return { slide: null, removed, cited: [] };
  }
  if (out.notes) out.notes = prose(out.notes);
  // Where the figures come from, when it is a web page: "Source: giga.global, read 13 Oct 2026."
  const pages = [...cited].filter((s) => !s.own);
  if (pages.length && !NO_NOTES.has(out.layoutId)) {
    const when = (d?: string) => (d ? `, ${new Date(`${d}T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}` : "");
    const line = `Source: ${[...new Set(pages.map((s) => `${s.label}${when(s.date)}`))].join("; ")}.`;
    out.notes = out.notes?.trim() ? `${out.notes.trim()} ${line}` : line;
  }
  return { slide: out, removed, cited: pages };
}
