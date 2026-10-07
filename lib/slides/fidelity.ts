import type { SourceSlide } from "./pptx-source";
import type { ReplicateStep } from "./replicate";
import type { SlideContent } from "./schema";

/**
 * How faithful a replicated slide is to its source slide (Mario, 28 Sep
 * 2026: "replicate must not change the content"). Always slide against
 * slide, the source's `steps[i]` against the model's `results[i]` in
 * `runReplicate`: a whole-deck substring test (what tools/qa-suite.ts did
 * before) finds "2026" somewhere and calls every 2026 kept.
 *
 * Three measures, all on normalised text (case, punctuation, the
 * typographic minus, thousands separators and the spacing before % do not
 * count as changes; a different form of a number does, "240K" is not
 * "240,000"):
 * - figures: every number the source writes (two digits or more, or a
 *   percentage) must appear on the slide as written; a chart value may be
 *   a bar (3.10 on the source, 3.1 in the data);
 * - lines: every title, point, sub-point, footnote and table cell, aligned
 *   word by word against the slide's text (the longest common subsequence,
 *   with the slide's ends free), is identical, touched (85% or more),
 *   changed (50% or more) or missing;
 * - added: runs of words on the slide that trace back to nothing in the
 *   source.
 */

export interface Figure {
  /** Normalised: "12750", "-32.79", "76%". */
  key: string;
  /** The source line it sits in, for the review. */
  line: string;
  /** A chart value: a bar with the same number counts. */
  chart?: boolean;
}

/**
 * A source line with where it came from, in reading order: what the app
 * needs to put a line back where it belongs, or to rebuild the slide from
 * the source (lib/slides/restore.ts). `figure` is a line with no letter in
 * it ("(99%)"), measured only for its figures and so not in `lines`.
 */
export interface SourceEntry {
  text: string;
  /** Written as a sub-point ("- " in the source). */
  sub: boolean;
  kind: "title" | "text" | "cell" | "note" | "figure" | "legend";
  /** A legend name: the chart it names a series of (0-based, in the order the source lists its charts). */
  chart?: number;
}

/** A chart the source slide draws: its columns (axis label, values top to bottom), from the labels written on the slide or, without them, the chart's data. */
export interface SourceChart {
  labelled: boolean;
  /** The series' names, when the chart's data gives them. */
  series?: string[];
  columns: { label: string; values: string[] }[];
}

export interface SourceUnits {
  lines: string[];
  figures: Figure[];
  /** Every word the source slide writes, normalised: what "added" is measured against. */
  vocabulary: Set<string>;
  /** Every line of `lines` (same order, same filter) with its kind and level, plus the lines of figures only. */
  entries: SourceEntry[];
  charts: SourceChart[];
  /** Figures written on the slide as a flat list (a PDF's chart labels), as written. */
  floating: string[];
}

export interface LinePair {
  source: string;
  /** The stretch of the slide the line was matched to ("" when nothing matched). */
  deck: string;
  score: number;
}

export interface SlideFidelity {
  /** The source slide's number, 1-based. */
  n: number;
  title: string;
  figures: { ok: number; total: number; wrong: { figure: string; source: string; deck: string }[] };
  words: { kept: number; total: number };
  lines: { same: number; touched: LinePair[]; changed: LinePair[]; missing: string[] };
  added: string[];
  /** Words of `added`, content words only. */
  addedWords: number;
}

export interface Leftover {
  n: number;
  title: string;
  lines: string[];
  /**
   * "structure": text the plan leaves out; "renamed": a chapter named in
   * other words on another agenda of the source (the deck names each chapter
   * once, as the agenda that opens it does), said but not counted missing.
   */
  reason: "failed" | "ceiling" | "structure" | "renamed";
}

// ─── Normalisation ─────────────────────────────────────────────────────────

/** Text as the comparison reads it: NFKC (¹ is 1), dashes and minus as "-", no thousands separators, "76 %" as "76%", lower case. */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[−‒–—‐‑]/g, "-")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d)\s+%/g, "$1%")
    .toLowerCase();
}

/**
 * Words, compared without punctuation: "76%/" is "76%", "+428k" is "428k",
 * "(school)" is "school", and a footnote marker glued to a word ("case2",
 * "Benefits¹") is the word.
 */
export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}%.+\-']+/u)
    .map((t) => t.replace(/^[.+\-']+|[.+\-']+$/g, "").replace(/^(\p{L}{2,})\d{1,2}$/u, "$1"))
    .filter(Boolean);
}

const FIGURE = /(?<![\p{L}\p{N}.,])-?\d[\d.]*\d%?|(?<![\p{L}\p{N}.,])-?\d%/gu;

/** The figures a text writes: two digits or more, or a percentage; normalised keys. */
export function figuresIn(text: string): string[] {
  const out: string[] = [];
  for (const m of normalize(text).matchAll(FIGURE)) {
    const key = m[0].replace(/\.$/, "");
    // "00" and "01" are the pieces of a time or a code, not figures.
    if (/^-?0\d?$/.test(key)) continue;
    if (key.includes("%") || key.replace(/\D/g, "").length >= 2) out.push(key);
  }
  return out;
}

/** The chart's rounding (pptx-source `round`): what "3.1 is 3.10" means for a bar. */
const same = (a: number, b: number) => {
  const r = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);
  return a === b || r(a) === r(b);
};

// ─── The slide's side ──────────────────────────────────────────────────────

/**
 * Every piece of visible text on a slide, in reading order: title,
 * subtitle, the single fields, bullets, blocks (label, body, points,
 * figures), stats, chart series and bars (label and value), footnotes and
 * the takeaway. `hasText` in schema.ts asks only whether there is any.
 */
export function slideStrings(s: SlideContent): string[] {
  const out = [s.title, s.subtitle, s.stat, s.support, s.quote, s.author, s.body, ...(s.bullets ?? [])];
  for (const b of s.blocks ?? []) {
    out.push(b.label, b.body, ...(b.items ?? []));
    for (const x of b.stats ?? []) out.push(x.value, x.label);
  }
  for (const x of s.stats ?? []) out.push(x.value, x.label);
  out.push(...(s.series ?? []));
  for (const b of s.bars ?? []) out.push(b.label, ...(b.values ?? [b.value]).map(String));
  out.push(s.notes, s.takeaway);
  // A two-pager page: every block's text, in reading order.
  for (const b of s.stack ?? []) {
    out.push(b.rail, b.heading, b.sub, b.lead, b.body);
    let group: string | undefined;
    for (const it of b.items ?? []) {
      if (it.group && it.group !== group) out.push((group = it.group));
      out.push(it.label, it.body, it.extra);
    }
  }
  return out.filter((t): t is string => !!t?.trim());
}

export function slideText(s: SlideContent): string {
  return slideStrings(s).join("\n");
}

// ─── The source's side ─────────────────────────────────────────────────────

const LABELS_LINE = /^(Chart labels written on the slide|Figures written on the slide)\b/;

/**
 * Lines that repeat across the source (a running header such as "School &
 * Health Facility Connectivity"): short, on three slides or more. The
 * prompt tells the model they are not content, so they are not measured.
 */
export function runningLines(slides: SourceSlide[]): Set<string> {
  const counts = new Map<string, number>();
  for (const s of slides) {
    if (s.kind === "agenda") continue;
    const seen = new Set<string>();
    for (const raw of s.text.split("\n").slice(1)) {
      const line = raw.replace(/^- /, "").trim();
      if (!line || line.includes(":") || tokens(line).length > 8) continue;
      seen.add(tokens(line).join(" "));
    }
    for (const l of seen) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const min = Math.max(3, Math.ceil(slides.length * 0.15));
  return new Set([...counts].filter(([, c]) => c >= min).map(([l]) => l));
}

/**
 * What a source slide says, as `SourceSlide.text` lays it out
 * (pptx-source.ts `classify`): "Title: …", one line per paragraph with "- "
 * on sub-points, "Table:" and its "| … |" rows, "Chart (kind) data:" and its
 * "- series …" lines, the chart labels drawn on the slide, "Footnotes: …"
 * and "Speaker notes: …".
 *
 * - Lines: the title, every paragraph, every footnote, every table cell
 *   with a letter in it. Speaker notes are not on the slide: left out.
 * - Figures: every figure of those lines, the chart labels written on the
 *   slide, and the series values when the slide has no labels of its own
 *   (the labels win: the Gambia deck draws 3.10 over data that says 3.2).
 *   A raw series dump is never read as prose.
 */
export function sourceUnits(source: Pick<SourceSlide, "text">, ignore: Set<string> = new Set()): SourceUnits {
  const lines: string[] = [];
  const entries: SourceEntry[] = [];
  const figures: Figure[] = [];
  const chart: number[] = [];
  const dataCharts: SourceChart[] = [];
  const labelCharts: SourceChart[] = [];
  const floating: string[] = [];
  const legends: string[][] = [];
  let labelled = false;
  let mode: "text" | "table" | "chart" = "text";
  const addLine = (text: string, kind: SourceEntry["kind"] = "text", sub = false) => {
    const line = text.trim();
    if (!line) return;
    for (const key of figuresIn(line)) figures.push({ key, line });
    // A line of figures only ("76%") is measured as figures, not as words.
    if (!/\p{L}/u.test(line)) {
      if (figuresIn(line).length) entries.push({ text: line, sub, kind: "figure" });
      return;
    }
    if (ignore.has(tokens(line).join(" "))) return;
    lines.push(line);
    entries.push({ text: line, sub, kind });
  };
  for (const raw of source.text.split("\n")) {
    if (mode === "chart" && /^- series\b/.test(raw)) {
      const values = raw.slice(raw.indexOf(":") + 1).split(",");
      const current = dataCharts[dataCharts.length - 1];
      const name = /^- series "([^"]*)"/.exec(raw)?.[1];
      (current.series ??= []).push(name ?? "");
      let k = 0;
      for (const v of values) {
        const n = Number(v.split("=").pop());
        if (!v.trim() || !Number.isFinite(n)) continue;
        chart.push(n);
        const label = v.includes("=") ? v.slice(0, v.lastIndexOf("=")).trim() : String(k + 1);
        (current.columns[k] ??= { label, values: [] }).values.push(String(n));
        k++;
      }
      continue;
    }
    if (mode === "table" && /^\|.*\|$/.test(raw.trim())) {
      for (const cell of raw.trim().slice(1, -1).split("|")) addLine(cell, "cell");
      continue;
    }
    mode = "text";
    if (/^Speaker notes:/.test(raw)) continue;
    if (/^Chart \([^)]*\) data:/.test(raw)) {
      mode = "chart";
      dataCharts.push({ labelled: false, columns: [] });
      continue;
    }
    if (/^Table:\s*$/.test(raw)) {
      mode = "table";
      continue;
    }
    if (LABELS_LINE.test(raw)) {
      labelled = true;
      const at = raw.indexOf("): ");
      const body = at >= 0 ? raw.slice(at + 3) : raw.slice(raw.indexOf(":") + 1);
      // "2026: 0, 0 | 27: 0 | 28: 3.10, 0.44": the axis label before each colon is not a figure.
      // An axis label seen again opens the next chart (two charts side by side).
      for (const col of body.split(" | ")) {
        const at = col.indexOf(": ");
        const values = at >= 0 ? col.slice(at + 2) : col;
        for (const key of figuresIn(values)) figures.push({ key, line: `Chart label: ${col.trim()}`, chart: true });
        if (at < 0) {
          floating.push(...values.split(/,\s+/).map((v) => v.trim()).filter((v) => figuresIn(v).length));
          continue;
        }
        const label = col.slice(0, at).trim();
        let current = labelCharts[labelCharts.length - 1];
        if (!current || current.columns.some((c) => c.label === label)) labelCharts.push((current = { labelled: true, columns: [] }));
        current.columns.push({ label, values: values.split(/,\s+/).map((v) => v.trim()).filter((v) => v && v !== "-") });
      }
      continue;
    }
    if (/^Chart legend:/.test(raw)) {
      const chartIndex = legends.length;
      const names = raw.replace(/^Chart legend:\s*/, "").split(" | ").map((x) => x.trim()).filter(Boolean);
      legends.push(names);
      for (const name of names) {
        const before = entries.length;
        addLine(name, "legend");
        if (entries.length > before) entries[entries.length - 1].chart = chartIndex;
      }
      continue;
    }
    if (/^Footnotes:/.test(raw)) {
      const notes = raw.replace(/^Footnotes:\s*/, "");
      for (const note of notes.split(/;\s+(?=\d{1,2}[.)]?\s)|\s+(?=\d{1,2}[.)]\s)/)) addLine(note, "note");
      continue;
    }
    if (/^Title:/.test(raw)) addLine(raw.replace(/^Title:\s*/, ""), "title");
    else addLine(raw.replace(/^- /, ""), "text", /^- /.test(raw));
  }
  if (!labelled) {
    for (const v of new Set(chart)) figures.push({ key: String(v), line: "Chart data", chart: true });
  }
  // One figure once per slide: "38%" written three times is one figure to find.
  const unique = new Map<string, Figure>();
  for (const f of figures) if (!unique.has(f.key)) unique.set(f.key, f);
  const vocabulary = new Set(tokens(source.text.split("\n").filter((l) => !/^Speaker notes:/.test(l)).join(" ")));
  // Series names: the chart's own when its data names them, else its legend.
  // A hand-labelled chart lists each column's labels top to bottom, which is
  // the series ranked by value, not in the legend's order: the data's last
  // values (stale as figures, right as a ranking) say which is which.
  dataCharts.forEach((c, i) => {
    const legend = legends[i];
    if (legend?.length === c.series?.length && c.series?.some((x) => !x)) c.series = legend;
  });
  labelCharts.forEach((c, i) => {
    const legend = legends[i];
    const k = Math.max(0, ...c.columns.map((col) => col.values.length));
    if (!legend || legend.length !== k) return;
    const data = dataCharts[i];
    const last = data?.columns[data.columns.length - 1]?.values.map(Number);
    if (data && last?.length === k && last.every(Number.isFinite)) {
      const order = last.map((v, j) => ({ v, j })).sort((a, b) => b.v - a.v).map((x) => x.j);
      c.series = order.map((j) => legend[j]);
    } else c.series = legend;
  });
  return { lines, figures: [...unique.values()], vocabulary, entries, charts: labelled ? labelCharts : dataCharts.filter((c) => c.columns.length), floating };
}

// ─── Alignment ─────────────────────────────────────────────────────────────

/**
 * The source line against the slide's word stream: every source word is
 * matched or skipped, the slide's ends are free (the line sits somewhere on
 * the slide), a gap inside costs. Returns the matched words and the stretch
 * of the slide they span. A fitting alignment, O(line × slide).
 */
export function align(line: string[], deck: string[]): { matched: number; start: number; end: number } {
  const m = line.length;
  const n = deck.length;
  if (!m || !n) return { matched: 0, start: 0, end: 0 };
  const W = n + 1;
  const H = new Float64Array((m + 1) * W);
  const from = new Uint8Array((m + 1) * W); // 1 diagonal match, 2 diagonal mismatch, 3 up (skip source), 4 left (skip deck)
  for (let i = 1; i <= m; i++) {
    H[i * W] = -i;
    from[i * W] = 3;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const hit = line[i - 1] === deck[j - 1];
      const d = H[(i - 1) * W + j - 1] + (hit ? 2 : -1);
      const u = H[(i - 1) * W + j] - 1;
      const l = H[i * W + j - 1] - 1;
      let best = d;
      let dir = hit ? 1 : 2;
      if (u > best) {
        best = u;
        dir = 3;
      }
      if (l > best) {
        best = l;
        dir = 4;
      }
      H[i * W + j] = best;
      from[i * W + j] = dir;
    }
  }
  let j = 0;
  for (let k = 1; k <= n; k++) if (H[m * W + k] > H[m * W + j]) j = k;
  const end = j;
  let i = m;
  let matched = 0;
  let start = j;
  while (i > 0 && j > 0) {
    const dir = from[i * W + j];
    if (dir === 1 || dir === 2) {
      if (dir === 1) matched++;
      start = j - 1;
      i--;
      j--;
    } else if (dir === 3) i--;
    else j--;
  }
  return { matched, start: Math.min(start, end), end };
}

// ─── The comparison ────────────────────────────────────────────────────────

export const STOP = new Set(
  "a an and are as at be by for from in into is it its of on or that the this to was were with will de del la las el los en y o para por con que un una il lo gli le di da e per con che du des et pour avec".split(" "),
);

export const IDENTICAL = 1;
export const TOUCHED = 0.85;
export const CHANGED = 0.5;

/**
 * What a source slide became: one slide, or a slide and its continuations
 * (lib/slides/restore.ts), whose repeated title is not measured ("… (cont.)"
 * would read as added words).
 */
export function slidesOf(slide: SlideContent | SlideContent[] | null): { strings: string[]; bars: SlideContent["bars"] & {} } {
  const all = slide ? (Array.isArray(slide) ? slide : [slide]) : [];
  const strings: string[] = [];
  const bars: NonNullable<SlideContent["bars"]> = [];
  all.forEach((s, i) => {
    // "Series 2", the name normalizeSeries gives a series the source did not name, is the chart's legend, not text.
    const own = slideStrings({ ...s, series: s.series?.filter((x) => !/^Series \d+$/.test(x)) });
    strings.push(...(i > 0 && s.title && own[0] === s.title ? own.slice(1) : own));
    bars.push(...(s.bars ?? []));
  });
  return { strings, bars };
}

/** One source slide against the slide replicated from it (or the slide and its continuations). */
export function compareSlide(n: number, title: string, units: SourceUnits, slide: SlideContent | SlideContent[] | null): SlideFidelity {
  const { strings, bars: deckBars } = slidesOf(slide);
  const deckRaw: string[] = [];
  const deckTok: string[] = [];
  const rawOf: number[] = [];
  // The slide as one stream of words, each normalised word pointing at the word as written.
  for (const s of strings) {
    for (const w of s.split(/\s+/)) {
      const t = tokens(w);
      if (!t.length) continue;
      deckRaw.push(w);
      for (const x of t) {
        deckTok.push(x);
        rawOf.push(deckRaw.length - 1);
      }
    }
  }

  // Figures.
  const deckFigures = new Set(strings.flatMap(figuresIn));
  const bars = deckBars.flatMap((b) => b.values ?? [b.value]);
  const wrong: SlideFidelity["figures"]["wrong"] = [];
  let figOk = 0;
  for (const f of units.figures) {
    const num = Number(f.key.replace(/%$/, ""));
    const onBar = Number.isFinite(num) && bars.some((b) => same(b, num));
    if (deckFigures.has(f.key) || onBar) figOk++;
    else wrong.push({ figure: f.key, source: f.line, deck: "" });
  }

  // Lines.
  const result: SlideFidelity = {
    n,
    title,
    figures: { ok: figOk, total: units.figures.length, wrong },
    words: { kept: 0, total: 0 },
    lines: { same: 0, touched: [], changed: [], missing: [] },
    added: [],
    addedWords: 0,
  };
  const spanOf = (a: { start: number; end: number }) => (a.end > a.start ? deckRaw.slice(rawOf[a.start], rawOf[a.end - 1] + 1).join(" ") : "");
  for (const line of units.lines) {
    const t = tokens(line);
    if (!t.length) continue;
    const a = align(t, deckTok);
    const span = a.end - a.start;
    const score = a.matched ? (2 * a.matched) / (t.length + span) : 0;
    result.words.total += t.length;
    result.words.kept += a.matched;
    if (a.matched === t.length && span === t.length) result.lines.same++;
    else if (score >= TOUCHED) result.lines.touched.push({ source: line, deck: spanOf(a), score });
    else if (score >= CHANGED) result.lines.changed.push({ source: line, deck: spanOf(a), score });
    else result.lines.missing.push(line);
  }
  // A wrong figure shows the stretch of the slide its line landed on.
  for (const w of wrong) {
    const pair = [...result.lines.touched, ...result.lines.changed].find((p) => p.source === w.source);
    w.deck = pair?.deck ?? "";
  }

  // Added: runs of words on the slide the source never writes (a stopword
  // the source has may sit inside a run, never at its end). Bar values are
  // the figures' business: 3.1 on a bar is the source's 3.10.
  const barValues = new Set(deckBars.flatMap((b) => (b.values ?? [b.value]).map(String)));
  for (const s of strings.filter((x) => !barValues.has(x))) {
    let run: { w: string; fresh: number }[] = [];
    const close = () => {
      while (run.length && !run[run.length - 1].fresh) run.pop();
      const content = run.reduce((n, x) => n + x.fresh, 0);
      if (content) {
        result.added.push(run.map((x) => x.w).join(" "));
        result.addedWords += content;
      }
      run = [];
    };
    for (const w of s.split(/\s+/)) {
      const t = tokens(w);
      if (!t.length) continue;
      const fresh = t.filter((x) => !units.vocabulary.has(x));
      if (fresh.length) run.push({ w, fresh: fresh.filter((x) => !STOP.has(x)).length });
      else if (run.length && STOP.has(t[0])) run.push({ w, fresh: 0 });
      else close();
    }
    close();
  }
  return result;
}

/** Anything to repair: a wrong figure, a changed or missing line, added text. A touched line alone is not worth a call. */
export function isFlawed(r: SlideFidelity): boolean {
  return r.figures.wrong.length > 0 || r.lines.changed.length > 0 || r.lines.missing.length > 0 || r.addedWords > 0;
}

/** Higher is closer to the source: figures weigh double, added words count against. */
export function fidelityScore(r: SlideFidelity): number {
  return r.figures.ok * 2 + r.words.kept - r.addedWords;
}

/**
 * The instruction a second attempt gets: the precise list of what the first
 * one changed. Only what went wrong, quoted, so the model has nothing to
 * interpret.
 */
export function repairNote(r: SlideFidelity): string {
  const quote = (s: string) => `"${s.replace(/"/g, "'")}"`;
  const lines = [...r.lines.missing, ...r.lines.changed.map((p) => p.source), ...r.lines.touched.map((p) => p.source)];
  const parts: string[] = [];
  if (lines.length) parts.push(`these lines must appear exactly as written: ${lines.map(quote).join("; ")}`);
  if (r.figures.wrong.length) parts.push(`these figures must appear exactly as written: ${r.figures.wrong.map((w) => w.figure).join(", ")}`);
  if (r.added.length) parts.push(`remove what the source slide does not say: ${r.added.map(quote).join("; ")}`);
  return `Your first answer for this slide changed the source. Rewrite it so that ${parts.join("; ")}. Keep everything else, and pick a layout that holds all of it.`;
}

// ─── The deck ──────────────────────────────────────────────────────────────

export interface DeckFidelity {
  /**
   * Per replicated slide, measured after the app's restore: `at` is its place
   * in the deck when it landed, `deckTitle` finds it again after a move;
   * `putBack` lines the app wrote back, `rebuilt` built from the source,
   * `parts` the slides it became (more than one when continued).
   */
  slides: (SlideFidelity & { at: number; layoutId: string; deckTitle: string; putBack?: number; putBackLines?: string[]; rebuilt?: boolean; parts?: number })[];
  /** Source slides or lines that did not become a slide: a failed call, the 40-slide ceiling, an agenda or divider line. */
  leftovers: Leftover[];
  /** A PDF with no text layer: the source was the model's transcription. */
  transcribed?: boolean;
  /**
   * A two-pager replica: the whole document against the whole piece, one
   * entry, measured across its pages (app/page.tsx runReplicatePages).
   */
  piece?: { pages: number; sourcePages: number };
  /** The totals before the repair pass; how many slides it asked again, how many came back closer. */
  firstPass?: Totals;
  repairs: number;
  repaired: number;
  /** The totals after the model's repair, before the app restored anything. */
  modelPass?: Totals;
  /** What the app restored (lib/slides/restore.ts): lines put back, slides rebuilt from the source, continuation slides added, added points removed. */
  restored?: { putBack: number; rebuilt: number; continued: number; trimmed: number };
  /** A two-pager: the block plan the model wrote before its pages, and what reads badly (pages/restore.ts checkRhythm). */
  layout?: { plan: { part: string; shape: string; block: string; why: string; page: number }[]; notes: string[] };
}

export interface Totals {
  figures: { ok: number; total: number };
  words: { kept: number; total: number };
  reworded: number;
  missing: number;
  added: number;
  notRebuilt: number;
}

export function totals(slides: SlideFidelity[], leftovers: Leftover[] = []): Totals {
  const t: Totals = { figures: { ok: 0, total: 0 }, words: { kept: 0, total: 0 }, reworded: 0, missing: 0, added: 0, notRebuilt: 0 };
  for (const s of slides) {
    t.figures.ok += s.figures.ok;
    t.figures.total += s.figures.total;
    t.words.kept += s.words.kept;
    t.words.total += s.words.total;
    t.reworded += s.lines.touched.length + s.lines.changed.length;
    t.missing += s.lines.missing.length;
    t.added += s.added.length;
  }
  for (const l of leftovers) {
    if (l.reason === "renamed") continue;
    if (l.reason === "structure") t.missing += l.lines.length;
    else t.notRebuilt++;
  }
  return t;
}

/** Every figure and every line in place, nothing added, nothing left out. */
export function isExact(t: Totals): boolean {
  return t.figures.ok === t.figures.total && t.words.kept === t.words.total && !t.reworded && !t.missing && !t.added && !t.notRebuilt;
}

/**
 * What the plan itself leaves out, so it is said rather than lost: content
 * slides past the 40-slide ceiling, and the lines of agenda, divider and
 * closing slides that the fixed agenda, dividers and closing slide do not
 * carry (a chapter named differently on a later agenda, a divider's
 * strapline, the source's contact line).
 */
export function planLeftovers(slides: SourceSlide[], steps: ReplicateStep[], ignore: Set<string> = new Set()): Leftover[] {
  const placed = new Set(steps.flatMap((st) => (st.kind === "fixed" ? [] : [st.source.n])));
  const fixed = steps.flatMap((st) => (st.kind === "fixed" ? [st.content.title ?? "", ...(st.content.bullets ?? [])] : []));
  const fixedKeys = new Set(fixed.map((t) => tokens(t).join(" ")));
  const out: Leftover[] = [];
  const seen = new Set<string>();
  const agendas = slides.filter((s) => s.kind === "agenda" && s.chapters?.length);
  // An agenda line at the place of a chapter the deck carries, on an agenda
  // of the same length: the same chapter, named in other words.
  const renamed = (s: SourceSlide, line: string) => {
    const j = s.chapters?.findIndex((c) => tokens(c).join(" ") === tokens(line).join(" ")) ?? -1;
    return j >= 0 && agendas.some((a) => a.chapters!.length === s.chapters!.length && fixedKeys.has(tokens(a.chapters![j]).join(" ")));
  };
  for (const s of slides) {
    if (placed.has(s.n) && s.kind !== "agenda") continue;
    if (s.kind === "content" || s.kind === "cover") {
      out.push({ n: s.n, title: s.title, lines: sourceUnits(s, ignore).lines, reason: "ceiling" });
      continue;
    }
    const units = sourceUnits(s, ignore).lines;
    const lines = units.filter((l, i) => {
      const key = tokens(l).join(" ");
      // The closing slide's own "Thank you" is the deck's closing slide.
      if (s.kind === "closing" && i === 0) return false;
      if (s.kind === "agenda" && /^(agenda|contents?|sommario|table of contents)$/i.test(l.trim())) return false;
      if (fixedKeys.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const other = s.kind === "agenda" ? lines.filter((l) => renamed(s, l)) : [];
    const left = lines.filter((l) => !other.includes(l));
    if (left.length) out.push({ n: s.n, title: s.title, lines: left, reason: "structure" });
    if (other.length) out.push({ n: s.n, title: s.title, lines: other, reason: "renamed" });
  }
  return out;
}
