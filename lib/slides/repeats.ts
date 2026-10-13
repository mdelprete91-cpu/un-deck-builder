import { STOP, tokens } from "./fidelity";
import type { SlideContent } from "./schema";

/**
 * What a reader notices across slides even when every slide is fine on its
 * own (the evaluation of 13 Oct 2026): the same sentence on three slides,
 * figures that are not data. Pure functions shared by the pipeline (rhythm.ts)
 * and the QA suite.
 */

/** The words that carry meaning, as the fidelity check reads them. */
export function meaningful(text: string): string[] {
  return tokens(text).filter((w) => w.length > 1 && !STOP.has(w));
}

/** The sentences a slide says: every prose field split at its full stops, three meaningful words at least. */
export function sentencesOf(s: SlideContent): string[][] {
  const fields = [
    s.subtitle,
    s.body,
    s.support,
    s.quote,
    s.takeaway,
    ...(s.bullets ?? []),
    ...(s.blocks ?? []).flatMap((b) => [b.body, ...(b.items ?? [])]),
    ...(s.stats ?? []).map((x) => x.label),
  ];
  return fields
    .filter((f): f is string => !!f && !!f.trim())
    .flatMap((f) => f.split(/(?<=[.!?])\s+/))
    .map(meaningful)
    .filter((w) => w.length >= 3);
}

/** Share of `a`'s words that `b` has. */
function covered(a: string[], b: Set<string>): number {
  return a.length ? a.filter((w) => b.has(w)).length / a.length : 0;
}

/**
 * True when every sentence of `slide` is already on one of `earlier`, at
 * `threshold` of its meaningful words or more. A slide with no sentence of
 * its own (a chart, a stat row) is never a repeat by this test.
 */
export function repeatsEarlier(slide: SlideContent, earlier: SlideContent[], threshold = 0.8): boolean {
  const own = sentencesOf(slide);
  if (!own.length) return false;
  const seen = earlier.flatMap(sentencesOf).map((w) => new Set(w));
  return own.every((sent) => seen.some((set) => covered(sent, set) >= threshold));
}

/**
 * A figure as a number, so "2.2M+" and "2,200,000" are the same figure:
 * K, M, B and "million" / "billion" multiply, "%" keeps its own kind, a
 * currency sign is dropped. Undefined for text with no figure.
 */
export function parseFigure(raw: string): string | undefined {
  const t = raw.replace(/[ \s]+/g, " ").trim().toLowerCase();
  const m = /(-|\u2212)?\s*[$€£]?\s*(\d[\d,]*(?:\.\d+)?)\s*(%|(?:k|m|b|bn|million|billion|thousand)\b)?/i.exec(t);
  if (!m) return undefined;
  let n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  const unit = (m[3] ?? "").toLowerCase();
  if (unit === "%") return `p:${m[1] ? -n : n}`;
  const mult: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
  n *= mult[unit] ?? 1;
  return `n:${m[1] ? -n : n}`;
}

/** Every figure a slide shows as data: stat values, the hero stat, chart values. */
export function figuresShown(s: SlideContent): string[] {
  const out: string[] = [];
  const add = (v: string | undefined) => {
    const f = v ? parseFigure(v) : undefined;
    if (f) out.push(f);
  };
  add(s.stat);
  (s.stats ?? []).forEach((x) => add(x.value));
  for (const b of s.bars ?? []) for (const v of b.values?.length ? b.values : [b.value]) out.push(`n:${v}`);
  return out;
}

/**
 * A funnel that is not one: values that grow somewhere, or a step that
 * keeps under 1% of the one before (schools and countries in one funnel,
 * the evaluation of 13 Oct 2026).
 */
export function isMixedFunnel(s: SlideContent): boolean {
  if (s.layoutId !== "chart-funnel" || !s.bars?.length) return false;
  const v = s.bars.map((b) => b.value);
  return v.some((x, i) => i > 0 && (x > v[i - 1] || (v[i - 1] > 0 && x / v[i - 1] < 0.01)));
}

/** Stat layouts whose figures are the slide's point. */
export const STAT_LAYOUTS = new Set(["stat-grid", "two-stats", "single-stat", "big-stat", "brand-equity"]);
/** The ones that show a row of figures with labels. */
export const STAT_ROWS = new Set(["stat-grid", "two-stats", "brand-equity"]);

/**
 * Figures that only count things ("1 regional partner", "2 streams"):
 * every value a whole number under ten with no unit.
 */
export function isFillerStats(s: SlideContent): boolean {
  if (!STAT_ROWS.has(s.layoutId)) return false;
  const values = (s.stats ?? []).map((x) => x.value).filter((v) => !!v && !!v.trim());
  return values.length > 0 && values.every((v) => /^\s*\d\s*$/.test(v));
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|enero|febrero|abril|mayo|junio|julio|septiembre|octubre|noviembre|diciembre";
const MONTH_ONLY = new RegExp(`^\\s*(?:${MONTHS})\\.?\\s*$`, "i");

/**
 * The year a month carries in the sources ("October 2025", "Oct 2025"), or
 * undefined when the sources never give that month with a year, or give it
 * with two different years.
 */
export function yearOfMonth(month: string, sources: string): string | undefined {
  const m = month.trim().replace(/\.$/, "");
  const re = new RegExp(`\\b${m}\\w*\\.?\\s+((?:19|20)\\d{2})\\b`, "gi");
  const years = new Set([...sources.matchAll(re)].map((x) => x[1]));
  return years.size === 1 ? [...years][0] : undefined;
}

/** A timeline label that is a month with no year. */
export const isBareMonth = (label: string | undefined) => !!label && MONTH_ONLY.test(label);

/** A figure as a stat value prints it, short enough for the stat grid ("2.2M", "54", "136K"). */
export function compactFigure(n: number): string {
  const a = Math.abs(n);
  const short = (v: number) => String(Math.round(v * 10) / 10);
  return a >= 1e9 ? `${short(n / 1e9)}B` : a >= 1e6 ? `${short(n / 1e6)}M` : a >= 1e4 ? `${short(n / 1e3)}K` : n.toLocaleString("en-US");
}
