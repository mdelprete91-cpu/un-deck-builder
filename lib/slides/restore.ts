import { compareSlide, figuresIn, STOP, tokens, type SlideFidelity, type SourceChart, type SourceEntry, type SourceUnits } from "./fidelity";
import { addPointAt, deleteModular, holdsPoints, isModular, pointAt, pointLists, pointsIn, type List } from "./modular";
import { withContentDensity } from "./replicate";
import { DENSITY_LAYOUTS, PRIMARY_ARRAY, SERIES_LAYOUTS, isChartLayout, normalizeSlide, overLimits, type Block, type SlideContent } from "./schema";
import { columns } from "./layouts/shared";

/**
 * The replica's guarantee (Mario, 29 Sep 2026: "if I click Replicate, 100%
 * of the text must be present"). The model writes each slide and gets one
 * repair call (runReplicate); what it still changed is restored here by the
 * app, deterministically, without another call. Three layers, in order:
 *
 * 1. Put back (`putBack`): every missing, changed or reworded source line is
 *    written verbatim into the slide, where it belongs: after the point that
 *    precedes it in the source, before the one that follows it, else as a
 *    point of the nearest block, else in a new block; a sub-point stays a
 *    sub-point, a footnote goes to `notes`. A changed line replaces the
 *    stretch of the slide it was matched to. A chart value that is wrong
 *    is set on its bar; a chart value with no bar to hold it is written as a
 *    point, as the source writes it. The slide goes high density when its
 *    layout has that variant. The Element menu's own rules (modular.ts) do
 *    the inserting, so the slide stays editable.
 * 2. Rebuild (`rebuild`): a slide that cannot hold it all (over its
 *    layout's limits, or text under the 18px floor, `fits`) is built again
 *    from the source instead of the model's answer: bullet-columns with the
 *    lines in source order, chart-text when the source draws a chart,
 *    figures-panel when it is mostly figures. Nothing is dropped.
 * 3. Continue: when even that does not hold at 18px, the source is split in
 *    source order over two slides or more, the same title with " (cont.)".
 *
 * Words the model invented are removed only as whole points, blocks, headers
 * or bands that no source line needs (`trimAdded`); never the title.
 */

type S = SlideContent;
/**
 * Whether a slide holds all its text readably: "ok" (every text at 18px or
 * more, nothing clipped), "small" (some text under 18px) or "clipped" (text
 * cut off at the smallest size, or a footnote shrunk out of sight). The
 * browser measures it (fit-check.ts `readable`), a node run estimates it
 * (`estimateFits`).
 */
export type Fit = "ok" | "small" | "clipped";
export type Fits = (s: S) => Fit;

export interface Restored {
  /** The slide, and its continuations when it had to be split. */
  slides: S[];
  report: SlideFidelity;
  /** Lines (and figure groups) the app wrote back. */
  putBack: number;
  rebuilt: boolean;
  /** Points, blocks or headers the model added that were removed. */
  trimmed: number;
}

/** The source lines a comparison found word for word. */
function identical(r: SlideFidelity, units: SourceUnits): Set<string> {
  const off = new Set([...r.lines.missing, ...r.lines.changed.map((p) => p.source), ...r.lines.touched.map((p) => p.source)]);
  return new Set(units.lines.filter((l) => !off.has(l)));
}

/** Every figure and every line identical: what the replica must end with. */
export function isWhole(r: SlideFidelity): boolean {
  return !r.figures.wrong.length && !r.lines.missing.length && !r.lines.changed.length && !r.lines.touched.length;
}

// ─── Reading and writing a slide's text by path ────────────────────────────

const FIELDS = ["title", "subtitle", "stat", "support", "quote", "author", "body"] as const;

/** Every text slot of a slide with its path, in slideStrings' order. */
function slots(s: S): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const f of FIELDS) if (s[f]) out.push({ path: f, text: s[f]! });
  (s.bullets ?? []).forEach((t, j) => out.push({ path: `bullets.${j}`, text: t }));
  (s.blocks ?? []).forEach((b, i) => {
    out.push({ path: `blocks.${i}.label`, text: b.label });
    out.push({ path: `blocks.${i}.body`, text: b.body });
    (b.items ?? []).forEach((t, j) => out.push({ path: `blocks.${i}.items.${j}`, text: t }));
    (b.stats ?? []).forEach((x, j) => {
      out.push({ path: `blocks.${i}.stats.${j}.value`, text: x.value });
      out.push({ path: `blocks.${i}.stats.${j}.label`, text: x.label });
    });
  });
  (s.stats ?? []).forEach((x, j) => {
    out.push({ path: `stats.${j}.value`, text: x.value });
    out.push({ path: `stats.${j}.label`, text: x.label });
  });
  (s.series ?? []).forEach((t, j) => out.push({ path: `series.${j}`, text: t }));
  if (s.notes) out.push({ path: "notes", text: s.notes });
  if (s.takeaway) out.push({ path: "takeaway", text: s.takeaway });
  return out.filter((x) => x.text?.trim());
}

function setAt(s: S, path: string, value: string): void {
  const parts = path.split(".");
  let node: Record<string, unknown> = s as unknown as Record<string, unknown>;
  for (let k = 0; k < parts.length - 1; k++) node = node[parts[k]] as Record<string, unknown>;
  node[parts[parts.length - 1]] = value;
}

/** The words of a text with their place, and the normalised tokens each one gives. */
function wordsOf(text: string): { start: number; end: number; toks: string[] }[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, toks: tokens(m[0]) }));
}

function indexOfSeq(hay: string[], needle: string[]): number {
  if (!needle.length || needle.length > hay.length) return -1;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

/** The slot that holds a line word for word, or null. */
function locate(s: S, line: string): string | null {
  const t = tokens(line);
  if (!t.length) return null;
  for (const slot of slots(s)) if (indexOfSeq(tokens(slot.text), t) >= 0) return slot.path;
  return null;
}

/**
 * Replace, inside one text slot, the stretch the comparison matched a
 * source line to with the source line itself. False when the stretch runs
 * over two slots or cannot be found.
 */
function replaceSpan(s: S, span: string, line: string): boolean {
  const need = tokens(span);
  if (!need.length) return false;
  for (const slot of slots(s)) {
    if (slot.path === "title") continue;
    const words = wordsOf(slot.text);
    const flat: string[] = [];
    const owner: number[] = [];
    words.forEach((w, i) => w.toks.forEach((t) => (flat.push(t), owner.push(i))));
    const at = indexOfSeq(flat, need);
    if (at < 0) continue;
    const a = words[owner[at]];
    const b = words[owner[at + need.length - 1]];
    setAt(s, slot.path, slot.text.slice(0, a.start) + line + slot.text.slice(b.end));
    return true;
  }
  return false;
}

// ─── Layer 1: put back ─────────────────────────────────────────────────────

const words = (t?: string) => (t ?? "").split(/\s+/).filter(Boolean).length;

/** The entry of a source line (the first one with that text). */
const entryOf = (units: SourceUnits, line: string) => units.entries.findIndex((e) => e.text === line);

/** A point with its level: "- " opens a sub-point, except where the layout does not nest (cascade policies). */
const asPoint = (s: S, e: SourceEntry | undefined, line: string) => (e?.sub && s.layoutId !== "cascade" ? `- ${line}` : line);

/**
 * Insert one source line where it belongs (see the file comment). Returns
 * the new slide, or null when there is no room anywhere on it.
 */
function insertLine(s: S, units: SourceUnits, line: string): S | null {
  const idx = entryOf(units, line);
  const entry = units.entries[idx];
  if (entry?.kind === "note") return { ...s, notes: s.notes?.trim() ? `${s.notes}\n${line}` : line };
  const text = asPoint(s, entry, line);
  const at = (path: string | null): { list: List; index: number } | { block: number } | null => {
    if (!path) return null;
    const label = /^blocks\.(\d+)\.label$/.exec(path);
    if (label && holdsPoints(s)) return { block: +label[1] };
    const p = pointAt(s, path);
    return p && p.list.kind !== "notes" ? p : null;
  };
  const find = (from: number, step: number) => {
    for (let k = from; k >= 0 && k < units.entries.length; k += step) {
      const loc = locate(s, units.entries[k].text);
      if (loc) return at(loc);
    }
    return null;
  };
  const prev = idx >= 0 ? find(idx - 1, -1) : null;
  const next = idx >= 0 ? find(idx + 1, 1) : null;
  // After the point before it (or first under the header before it).
  if (prev) {
    const r = "block" in prev ? addPointAt(s, { kind: "items", block: prev.block }, 0, text) : addPointAt(s, prev.list, prev.index + 1, text);
    if (r) return r.slide;
  }
  // Before the point after it.
  if (next && !("block" in next)) {
    const r = addPointAt(s, next.list, next.index, text);
    if (r) return r.slide;
  }
  // The nearest block with room: after its points when it comes before the neighbour, first when it comes after.
  const lists = pointLists(s);
  const near = prev ?? next;
  const home = near ? ("block" in near ? near.block : near.list.kind === "items" ? near.list.block : lists.length) : lists.length;
  const order = [...lists].sort((x, y) => {
    const bx = x.kind === "items" ? x.block : lists.length;
    const by = y.kind === "items" ? y.block : lists.length;
    return Math.abs(bx - home) - Math.abs(by - home) || by - bx;
  });
  for (const list of order) {
    const b = list.kind === "items" ? list.block : lists.length;
    const r = addPointAt(s, list, b > home ? 0 : pointsIn(s, list).length, text);
    if (r) return r.slide;
  }
  // A new block, where the layout's blocks carry points and there is room for one.
  const spec = PRIMARY_ARRAY[s.layoutId];
  if (holdsPoints(s) && spec?.field === "blocks" && (s.blocks?.length ?? 0) < spec.max) {
    const block: Block = { label: "", body: "", items: [text] };
    return { ...s, blocks: [...(s.blocks ?? []), block] };
  }
  return null;
}

/** A figure as the source writes it ("-0.85", "3,523", "76%"), found by its key in a source text. */
function rawFigure(key: string, text: string): string {
  for (const m of text.matchAll(/[-−–]?\d[\d.,]*\s?%?/g)) {
    const raw = m[0].replace(/[.,\s]+$/, "");
    if (figuresIn(raw).includes(key)) return raw;
  }
  return key;
}

/** Numbers of a chart column as the chart takes them ("−5.38" is -5.38, "76%" is 76). */
const num = (v: string) => Number(v.replace(/[−–]/g, "-").replace(/[,%\s]/g, ""));

/** A chart the renderers can draw: 2 to 12 columns, one to three values each, every column complete. */
function drawable(c: SourceChart): boolean {
  if (c.columns.length < 2 || c.columns.length > 12) return false;
  const k = c.columns[0].values.length;
  return k >= 1 && k <= 3 && c.columns.every((col) => col.values.length === k && col.values.every((v) => Number.isFinite(num(v))));
}

/** A chart's columns as the source writes them: "27: -0.85, -5.48, -6.00; 28: …". */
const chartText = (c: SourceChart) => c.columns.filter((col) => col.values.length).map((col) => `${col.label}: ${col.values.join(", ")}`).join("; ");

/**
 * Set the slide's bars from the source's first chart when the slide draws a
 * chart of the same shape (as many bars as columns, a layout that holds the
 * column's values). True when it did.
 */
function fixBars(s: S, units: SourceUnits): boolean {
  const c = units.charts[0];
  if (!c || !drawable(c) || !isChartLayout(s.layoutId) || (s.bars?.length ?? 0) !== c.columns.length) return false;
  const k = c.columns[0].values.length;
  const span = SERIES_LAYOUTS[s.layoutId];
  if (span ? k > span[1] : k !== 1) return false;
  s.bars = s.bars!.map((b, i) => {
    const values = c.columns[i].values.map(num);
    return span ? { ...b, value: values[0], values } : { ...b, value: values[0] };
  });
  if (span) {
    const names = (s.series ?? []).slice(0, k);
    while (names.length < Math.max(k, span[0])) names.push(`Series ${names.length + 1}`);
    s.series = names;
  }
  return true;
}

/**
 * The figures still wrong, as one point the way the source writes them: a
 * chart's columns ("27: -1.37, -8.91, -9.76; 28: …"), a line of figures
 * ("(99%)"), or the figures of a flat list that are missing.
 */
function figurePoint(r: SlideFidelity): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const w of r.figures.wrong) {
    const line = w.source.replace(/^Chart label: /, "");
    if (w.source === "Chart data") {
      parts.push(w.figure);
      continue;
    }
    if (seen.has(line)) continue;
    // A column ("27: …") or a line of figures is written whole; a flat list gives only the figures missing.
    if (/^[^,:]{1,12}: /.test(line) || !/,\s/.test(line) || !w.source.startsWith("Chart label: ")) {
      seen.add(line);
      parts.push(line);
    } else parts.push(rawFigure(w.figure, line));
  }
  return parts.join("; ");
}

/**
 * Layer 1. The slide with every missing, changed or reworded line and every
 * wrong figure put back, or null when its layout cannot take them (not a
 * modular slide, or no room left in its lists and blocks).
 */
export function putBack(slide: S, units: SourceUnits, n = 0): { slide: S; count: number } | null {
  let s: S = structuredClone(slide);
  if (!isModular(s) && DENSITY_LAYOUTS.has(s.layoutId)) s.density = "high";
  if (!isModular(s)) return null;
  const title = units.entries.find((e) => e.kind === "title")?.text;
  let count = 0;
  if (title && tokens(s.title ?? "").join(" ") !== tokens(title).join(" ")) {
    s.title = title;
    count++;
  }
  for (let pass = 0; pass < 6; pass++) {
    const r = compareSlide(n, "", units, s);
    if (isWhole(r)) return { slide: withContentDensity(s), count };
    const lines = [...r.lines.changed, ...r.lines.touched];
    if (lines.length || r.lines.missing.length) {
      const pending: string[] = [];
      for (const p of lines) {
        if (p.source === title) {
          s.title = title;
          count++;
          continue;
        }
        // In place, only when that makes the line whole and breaks no other
        // (a short stretch such as "School Connectivity" can sit inside another line).
        const trial = structuredClone(s);
        const before = identical(compareSlide(n, "", units, s), units);
        const after = replaceSpan(trial, p.deck, p.source) ? identical(compareSlide(n, "", units, trial), units) : null;
        if (after && after.has(p.source) && [...before].every((l) => after.has(l))) {
          s = trial;
          count++;
        } else pending.push(p.source);
      }
      for (const line of [...r.lines.missing, ...pending]) {
        if (line === title) {
          s.title = title;
          count++;
          continue;
        }
        const next = insertLine(s, units, line);
        if (!next) return null;
        s = next;
        count++;
      }
      continue;
    }
    // Lines whole, figures wrong: the chart's bars first, then the rest as a point.
    if (fixBars(s, units) && isWhole(compareSlide(n, "", units, s))) {
      count++;
      continue;
    }
    const again = compareSlide(n, "", units, s);
    if (!again.figures.wrong.length) continue;
    const point = figurePoint(again);
    const lists = pointLists(s);
    let placed: S | null = null;
    for (const list of [...lists].reverse()) {
      const res = addPointAt(s, list, pointsIn(s, list).length, point);
      if (res) {
        placed = res.slide;
        break;
      }
    }
    const spec = PRIMARY_ARRAY[s.layoutId];
    if (!placed && holdsPoints(s) && spec?.field === "blocks" && (s.blocks?.length ?? 0) < spec.max) placed = { ...s, blocks: [...(s.blocks ?? []), { label: "", body: "", items: [point] }] };
    if (!placed) return null;
    s = placed;
    count++;
  }
  return null;
}

// ─── Words the model added ─────────────────────────────────────────────────

/** A text with a content word the source never writes. */
const invented = (text: string, units: SourceUnits) => tokens(text).some((t) => !units.vocabulary.has(t) && !STOP.has(t));

/**
 * Remove what the model added and no source line needs: a whole point, a
 * block, a header, a band or a heading with a word the source never writes
 * (and, after a put-back, a point that only repeats what is now there word
 * for word). Each removal is kept only when every line and figure it had
 * stays as it was. Never the title.
 */
export function trimAdded(slide: S, units: SourceUnits, opts: { redundant?: boolean } = {}): { slide: S; removed: number } {
  if (!isModular(slide)) return { slide, removed: 0 };
  let s = slide;
  let removed = 0;
  const base = compareSlide(0, "", units, s);
  const holds = (r: SlideFidelity) => r.lines.same >= base.lines.same && r.figures.ok >= base.figures.ok && r.words.kept >= base.words.kept;
  const candidates = (x: S): { path: string; text: string; point: boolean }[] => {
    const out: { path: string; text: string; point: boolean }[] = [];
    for (const f of ["subtitle", "support", "takeaway"] as const) if (x[f]?.trim()) out.push({ path: f, text: x[f]!, point: false });
    (x.blocks ?? []).forEach((b, i) => {
      if (b.label?.trim()) out.push({ path: `blocks.${i}.label`, text: b.label, point: false });
      const all = [b.label, b.body, ...(b.items ?? []), ...(b.stats ?? []).flatMap((st) => [st.value, st.label])].join(" ");
      out.push({ path: `blocks.${i}`, text: all, point: false });
    });
    for (const list of pointLists(x)) {
      pointsIn(x, list).forEach((t, j) => {
        if (list.kind === "notes") return;
        const path = list.kind === "bullets" ? `bullets.${j}` : x.blocks?.[list.block]?.items?.length ? `blocks.${list.block}.items.${j}` : `blocks.${list.block}.body`;
        out.push({ path, text: t, point: true });
      });
    }
    return out.reverse();
  };
  for (let guard = 0; guard < 60; guard++) {
    let changed = false;
    for (const c of candidates(s)) {
      if (!invented(c.text, units) && !(opts.redundant && c.point)) continue;
      const next = deleteModular(s, c.path);
      if (!next || !holds(compareSlide(0, "", units, next))) continue;
      s = next;
      removed++;
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return { slide: s, removed };
}

// ─── Layers 2 and 3: rebuild and continue ──────────────────────────────────

/** A short line with no closing full stop and no figure that has something after it: a header. */
function header(e: SourceEntry | undefined, next: SourceEntry | undefined): boolean {
  return !!e && !!next && e.kind === "text" && !e.sub && words(e.text) <= 8 && !/[.;!]$/.test(e.text.trim()) && !figuresIn(e.text).length;
}

/** Cut `list` into `k` runs in order, about as many words each, a cut before a header when one is near. */
function runs<T extends SourceEntry>(list: T[], k: number): T[][] {
  if (k <= 1 || list.length <= 1) return [list];
  const total = list.reduce((n, e) => n + words(e.text) + 3, 0);
  const cuts: number[] = [];
  let acc = 0;
  let from = 0;
  const weight = list.map((e) => words(e.text) + 3);
  for (let part = 1; part < k; part++) {
    const target = (total * part) / k;
    let best = -1;
    let bestScore = Infinity;
    acc = weight.slice(0, from).reduce((a, b) => a + b, 0);
    for (let i = from + 1; i < list.length - (k - part - 1); i++) {
      acc += weight[i - 1];
      const off = Math.abs(acc - target) / total;
      // A header opens a run; a sub-point never does.
      const score = off - (header(list[i], list[i + 1]) ? 0.12 : 0) + (list[i].sub ? 0.2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    cuts.push(best);
    from = best;
  }
  const out: T[][] = [];
  let start = 0;
  for (const c of cuts) {
    out.push(list.slice(start, c));
    start = c;
  }
  out.push(list.slice(start));
  return out.filter((r) => r.length);
}

/** A run as a column: its header (when it opens with one) and its points, sub-points kept. */
function column(run: SourceEntry[], cascadeLike = false): Block {
  const [first, second] = run;
  const labelled = header(first, second) && run.length > 1;
  const rest = labelled ? run.slice(1) : run;
  return { label: labelled ? first.text : "", body: "", items: rest.map((e) => (e.sub && !cascadeLike ? `- ${e.text}` : e.text)) };
}

/** bullet-columns from a run of source lines: one to three columns, ten points a column at most; null when it cannot hold them. */
function bulletColumnsOf(title: string, list: SourceEntry[], notes?: string): S | null {
  if (!list.length) return null;
  const total = list.reduce((n, e) => n + words(e.text), 0);
  const first = total <= 60 && list.length <= 8 ? 1 : total <= 170 ? 2 : 3;
  for (let k = first; k <= 3; k++) {
    const blocks = runs(list, k).map((r) => column(r));
    if (blocks.every((b) => (b.items?.length ?? 0) <= 10 && (b.items?.length || b.label))) {
      // A column with only a header (a run of one line) shows it as its one point.
      const fixed = blocks.map((b) => (b.items?.length ? b : { label: "", body: "", items: [b.label] }));
      return { layoutId: "bullet-columns", title, blocks: fixed, ...(notes ? { notes } : {}) };
    }
  }
  return null;
}

/** chart-text: the source's chart, the lines as the explanation (a header on top as its heading); null past ten points. */
function chartTextOf(title: string, list: SourceEntry[], chart: SourceChart, notes?: string): S | null {
  const labelled = header(list[0], list[1]);
  const rest = labelled ? list.slice(1) : list;
  if (rest.length > 10 || (!rest.length && !labelled)) return null;
  const k = chart.columns[0].values.length;
  const series = chart.series?.slice(0, k) ?? [];
  while (series.length < k) series.push(`Series ${series.length + 1}`);
  return {
    layoutId: "chart-text",
    title,
    subtitle: labelled ? list[0].text : "",
    bullets: rest.map((e) => (e.sub ? `- ${e.text}` : e.text)),
    series,
    bars: chart.columns.map((c) => {
      const values = c.values.map(num);
      return { label: c.label, value: values[0], values };
    }),
    ...(notes ? { notes } : {}),
  };
}

/** figures-panel for a slide that is mostly figures: rows of up to five figures beside the lines, in order. */
function figuresPanelOf(title: string, list: SourceEntry[], figures: string[], notes?: string): S | null {
  const rows = Math.max(1, Math.ceil(figures.length / 5));
  if (rows > 4) return null;
  const chunks = runs(list, rows);
  const blocks: Block[] = [];
  for (let i = 0; i < rows; i++) {
    // No row label: which line names which figure is not in the source's text, so none is guessed.
    const rest = chunks[i] ?? [];
    if (rest.length > 10) return null;
    blocks.push({
      label: "",
      body: "",
      ...(rest.length ? { items: rest.map((e) => (e.sub ? `- ${e.text}` : e.text)) } : {}),
      stats: figures.slice(i * 5, i * 5 + 5).map((value) => ({ value, label: "" })),
    });
  }
  // Lines past the rows (more runs than rows) go to the last row.
  for (const run of chunks.slice(rows)) blocks[blocks.length - 1].items = [...(blocks[blocks.length - 1].items ?? []), ...run.map((e) => e.text)];
  if (blocks.some((b) => (b.items?.length ?? 0) > 10)) return null;
  return { layoutId: "figures-panel", title, blocks, ...(notes ? { notes } : {}) };
}

/** A footnote block this long does not fit the footer row (two lines at 17px): it becomes points. */
const NOTE_WORDS = 36;

/**
 * Layers 2 and 3. The slide built from the source alone, in as few slides as
 * hold it at 18px (`fits`): one when it can, else the source in order over
 * two, three… slides, the later ones titled "<title> (cont.)". The first
 * slide draws the source's chart when it has one it can draw (chart-text),
 * a later slide the next chart; any other chart's values are written as a
 * point, as the source writes them. Every line, figure and note of the
 * source is on one of them.
 */
export function rebuild(units: SourceUnits, title: string, fits: Fits, opts: { cont?: string } = {}): S[] {
  const cont = opts.cont ?? "(cont.)";
  const body = units.entries.filter((e) => e.kind !== "title");
  const noteEntries = body.filter((e) => e.kind === "note");
  const noteWords = noteEntries.reduce((n, e) => n + words(e.text), 0);
  const notes = noteEntries.length && noteWords <= NOTE_WORDS ? noteEntries.map((e) => e.text).join("\n") : undefined;
  const text = body.filter((e) => e.kind !== "note" || !notes);
  const charts = units.charts.filter(drawable);
  const other = units.charts.filter((c) => !drawable(c));
  const lineKeys = new Set(text.flatMap((e) => figuresIn(e.text)));
  const floating = units.floating.filter((f) => figuresIn(f).some((k) => !lineKeys.has(k)));
  // Mostly figures: six or more written apart from any line, and more of them than one per four words of text.
  const textWords = text.reduce((n, e) => n + words(e.text), 0);
  const figureHeavy = !charts.length && floating.length >= 6 && floating.length * 4 >= textWords;

  // The lines with what is written out: the charts not drawn (all but the
  // first `drawn`), and the figures written apart when they are not a panel.
  const entriesFor = (drawn: number): SourceEntry[] => [
    ...text,
    ...[...charts.slice(drawn), ...other].map((c): SourceEntry => ({ text: chartText(c), sub: false, kind: "figure" })),
    ...(!figureHeavy && floating.length ? [{ text: floating.join(", "), sub: false, kind: "figure" as const }] : []),
  ];
  const slideOf = (i: number, list: SourceEntry[], last: boolean, drawn: number, figs: string[] = []): S | null => {
    const t = i === 0 ? title : `${title} ${cont}`;
    const n = last ? notes : undefined;
    const slide = i < drawn && charts[i] ? chartTextOf(t, list, charts[i], n) : figureHeavy ? figuresPanelOf(t, list, figs, n) : bulletColumnsOf(t, list, n);
    return slide && (normalizeSlide(slide) ?? slide);
  };
  const holds = (x: S | null): x is S => !!x && !overLimits(x) && fits(x) === "ok";

  /** Equal runs over k slides (charts drawn on the first k), or null when one does not build. */
  const balanced = (k: number): S[] | null => {
    const drawn = Math.min(k, charts.length);
    const chunks = runs(entriesFor(drawn), k);
    if (chunks.length < k && k > 1) return null;
    const out: S[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const figs = figureHeavy ? floating.slice(Math.floor((floating.length * i) / chunks.length), Math.floor((floating.length * (i + 1)) / chunks.length)) : [];
      const slide = slideOf(i, chunks[i], i === chunks.length - 1, drawn, figs);
      if (!slide) return null;
      out.push(slide);
    }
    return out;
  };

  /**
   * Each slide as full as it holds at 18px, in order (the most lines that
   * fit, by halving), a cut moved before a nearby header and never before a
   * sub-point. The first slides draw the charts; a chart left without a
   * slide of its own is written out and the packing runs again.
   */
  const packed = (): S[] | null => {
    let drawn = charts.length;
    for (let round = 0; round < 3; round++) {
      let rest = entriesFor(drawn);
      const out: S[] = [];
      while (rest.length && out.length < 12) {
        const i = out.length;
        const at = (m: number) => slideOf(i, rest.slice(0, m), m === rest.length, drawn);
        let lo = 1;
        let hi = rest.length;
        let best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (holds(at(mid))) {
            best = mid;
            lo = mid + 1;
          } else hi = mid - 1;
        }
        if (!best) best = [1, 2, 3].find((m) => at(m)) ?? 1;
        if (best < rest.length) {
          const head = [best, best - 1, best - 2].find((j) => j > 0 && header(rest[j], rest[j + 1]));
          if (head) best = head;
          while (best > 1 && rest[best]?.sub) best--;
        }
        const slide = at(best);
        if (!slide) return null;
        out.push(slide);
        rest = rest.slice(best);
      }
      if (out.length >= drawn) return out;
      drawn = out.length;
    }
    return null;
  };

  const one = balanced(1);
  if (one && one.every(holds)) return one;
  if (!figureHeavy) {
    const greedy = packed();
    if (greedy) {
      // As many slides as the packing needs, the lines spread evenly over them when that holds too.
      const even = balanced(greedy.length);
      return even && even.every(holds) ? even : greedy;
    }
  }
  let fallback: S[] | null = one;
  for (let k = 2; k <= 8; k++) {
    const parts = balanced(k);
    if (!parts) continue;
    if (parts.every(holds)) return parts;
    // Past every try, the most slides that could be built: the smallest text a slide.
    fallback = parts;
  }
  if (fallback) return fallback;
  // Nothing buildable (an extreme source): ten lines a slide, one column each.
  const out: S[] = [];
  const all = [...text];
  for (let i = 0; i < Math.max(all.length, 1); i += 10) {
    out.push({ layoutId: "bullet-columns", title: i ? `${title} ${cont}` : title, blocks: [{ label: "", body: "", items: all.slice(i, i + 10).map((e) => e.text) }] });
  }
  return out;
}

/**
 * How a continuation slide is titled: the source's own convention when one
 * of its titles has one ("(continued)", "(cont'd)", "(2/2)" is not a
 * convention to copy), else "(cont.)".
 */
export function continuationLabel(titles: string[]): string {
  for (const t of titles) {
    const m = /\((cont\.?|cont'd|contd\.?|continued|continuación|continuação|suite|segue|continua)\)\s*$/i.exec(t);
    if (m) return m[0].trim();
  }
  return "(cont.)";
}

// ─── The whole guarantee for one slide ─────────────────────────────────────

/**
 * One replicated slide made whole: the model's slide when it already is,
 * else put back (layer 1), else rebuilt and, when needed, continued (layers
 * 2 and 3). `slide` null (the model failed twice) is rebuilt from the
 * source. The report is the final comparison, against every slide returned.
 */
export function restoreSlide(n: number, sourceTitle: string, units: SourceUnits, slide: S | null, fits: Fits, opts: { cont?: string } = {}): Restored {
  const title = units.entries.find((e) => e.kind === "title")?.text ?? sourceTitle;
  const done = (slides: S[], putBackCount: number, rebuilt: boolean, trimmed: number): Restored => ({
    slides,
    report: compareSlide(n, sourceTitle, units, slides.length === 1 ? slides[0] : slides),
    putBack: putBackCount,
    rebuilt,
    trimmed,
  });
  if (slide) {
    const first = compareSlide(n, sourceTitle, units, slide);
    if (isWhole(first)) {
      const t = trimAdded(slide, units);
      // A slide the model got right is kept as it is, unless text is out of sight (clipped, or footnotes shrunk under 14px): not seen is not on the slide.
      if (fits(t.slide) !== "clipped") return done([t.slide], 0, false, t.removed);
    } else {
      const back = putBack(slide, units, n);
      if (back) {
        const t = trimAdded(back.slide, units, { redundant: true });
        if (!overLimits(t.slide) && fits(t.slide) === "ok") return done([t.slide], back.count, false, t.removed);
      }
    }
  }
  const parts = rebuild(units, title, fits, opts);
  return done(parts, 0, true, 0);
}

/**
 * The cover: the title as written and the source's other lines ("Investment
 * Case", "September 2026") in the subtitle, one after the other. Past what a
 * subtitle holds, the rest is a content slide after the cover, built from
 * the source like any other (Mario's rule: nothing on the cover is lost).
 */
export function restoreCover(n: number, sourceTitle: string, units: SourceUnits, cover: S, fits: Fits): Restored {
  const title = units.entries.find((e) => e.kind === "title")?.text ?? sourceTitle;
  const first = compareSlide(n, sourceTitle, units, cover);
  if (isWhole(first)) return { slides: [cover], report: first, putBack: 0, rebuilt: false, trimmed: 0 };
  const lines = units.entries.filter((e) => e.kind !== "title" && e.kind !== "note");
  const subtitle: string[] = [];
  let i = 0;
  while (i < lines.length && words([...subtitle, lines[i].text].join(" ")) <= SUBTITLE_WORDS) subtitle.push(lines[i++].text);
  const out: S[] = [{ layoutId: "cover", title, subtitle: subtitle.join(" · ") }];
  const rest = { ...units, entries: [{ text: title, sub: false, kind: "title" as const }, ...units.entries.filter((e) => e.kind !== "title").filter((e) => !subtitle.includes(e.text))] };
  if (rest.entries.length > 1) out.push(...rebuild(rest, title, fits));
  const changed = first.lines.missing.length + first.lines.changed.length + first.lines.touched.length;
  return { slides: out, report: compareSlide(n, sourceTitle, units, out.length === 1 ? out[0] : out), putBack: changed, rebuilt: out.length > 1, trimmed: 0 };
}

/** What the cover's subtitle holds (48px on 1720px, three lines). */
const SUBTITLE_WORDS = 18;

// ─── The estimate a node run uses ──────────────────────────────────────────

/**
 * Whether a slide holds its text at 18px, estimated from characters: Open
 * Sans 500 at 18px averages about 9.4px a character, a line is 25px, a point
 * adds a gap of 8px. The browser measures instead (fit-check.ts
 * `readable`); this is for the unit tests and any run without a DOM.
 */
export function estimateFits(s: S): Fit {
  // The footer row holds about 36 words of notes at 14px or more.
  if (words(s.notes) > 60) return "clipped";
  return estimateHolds(s) ? "ok" : "small";
}

function estimateHolds(s: S): boolean {
  const px = 18;
  const charW = px * 0.52;
  const lineH = px * 1.4;
  const top = (s.title ?? "").trim().length <= 64 ? 172 : 244;
  const height = (points: string[], width: number, head?: string) => {
    let h = head?.trim() ? Math.ceil((head.length * charW * 1.25) / width) * px * 1.25 * 1.3 + px * 0.35 : 0;
    for (const p of points) {
      const w = width - (/^[-–]\s/.test(p) ? 33 : 17);
      h += Math.ceil((p.length * charW) / w) * lineH + px * 0.45;
    }
    return h;
  };
  if (s.layoutId === "bullet-columns") {
    const blocks = s.blocks ?? [];
    const { width } = columns(Math.max(blocks.length, 1));
    const budget = 900 - top - (s.support?.trim() ? 148 : 0) - 60;
    return blocks.every((b) => height(b.items?.length ? b.items : [b.body], width - 72, b.label) <= budget);
  }
  if (s.layoutId === "chart-text") return height(s.bullets ?? [], 628, s.subtitle) <= 900 - top - 60;
  if (s.layoutId === "figures-panel") {
    const h = (s.blocks ?? []).reduce((n, b) => n + Math.max(height(b.items ?? [], 580), (b.stats?.length ?? 0) * 60) + 36, 0);
    return h <= 900 - top - (s.takeaway ? 148 : 0);
  }
  const chars = slots(s).reduce((n, x) => n + x.text.length, 0);
  return chars <= 1600;
}
