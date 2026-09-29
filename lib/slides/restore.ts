import { compareSlide, figuresIn, STOP, tokens, type SlideFidelity, type SourceChart, type SourceEntry, type SourceUnits } from "./fidelity";
import { addPointAt, deleteModular, holdsPoints, isModular, pointAt, pointLists, pointsIn, type List } from "./modular";
import { withContentDensity } from "./replicate";
import { DENSITY_LAYOUTS, PRIMARY_ARRAY, SERIES_LAYOUTS, isChartLayout, normalizeSlide, overLimits, type Block, type SlideContent } from "./schema";
import { columns } from "./layouts/shared";
import type { SourceBox } from "./pptx-source";

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
  /** The lines put back, as the source writes them. */
  lines?: string[];
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
  // Its neighbours are on the slide but their list is full: never at the end
  // of an unrelated block (the slide is rebuilt instead).
  if (prev || next) return null;
  // No neighbour on the slide (a whole group is missing): a new block, where the layout's blocks carry points and there is room for one.
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

/**
 * What of a chart the renderers can draw: its complete columns (as many
 * values as the fullest column, one to three, all numbers), two to twelve of
 * them. A column the source labels only in part (Gambia 15's second chart
 * has two of three labels over 2031) is not drawn with an invented value:
 * it stays as text (`remainder`).
 */
function plotted(source: SourceChart): SourceChart | null {
  const k = Math.max(0, ...source.columns.map((col) => col.values.length));
  // Labels that are all zero are drawn once where the lines meet at zero: the column is zero for every series.
  const c = { ...source, columns: source.columns.map((col) => (col.values.length && col.values.length < k && col.values.every((v) => num(v) === 0) ? { ...col, values: Array(k).fill("0") } : col)) };
  if (k < 1 || k > 3) return null;
  const full = (col: SourceChart["columns"][number]) => col.values.length === k && col.values.every((v) => Number.isFinite(num(v)));
  const columns = c.columns.filter(full);
  // One run of complete columns covering most of the axis: a chart that
  // starts at its fourth year would misread the source, so it stays text.
  const first = c.columns.findIndex(full);
  const contiguous = first >= 0 && c.columns.slice(first, first + columns.length).every(full);
  return contiguous && columns.length >= Math.max(2, Math.ceil(c.columns.length * 0.6)) && columns.length <= 12 ? { ...c, columns } : null;
}
const drawable = (c: SourceChart) => !!plotted(c);
/** The columns of a drawn chart that stay text, or null. */
function remainder(c: SourceChart): SourceChart | null {
  const p = plotted(c);
  const drawn = new Set(p?.columns.map((col) => col.label));
  const rest = p ? c.columns.filter((col) => !drawn.has(col.label) && col.values.length) : [];
  return rest.length ? { ...c, columns: rest } : null;
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
export function putBack(slide: S, units: SourceUnits, n = 0): { slide: S; count: number; lines: string[] } | null {
  let s: S = structuredClone(slide);
  if (!isModular(s) && DENSITY_LAYOUTS.has(s.layoutId)) s.density = "high";
  if (!isModular(s)) return null;
  const title = units.entries.find((e) => e.kind === "title")?.text;
  let count = 0;
  // What the app wrote, for the review ("Put back by the app").
  const log: string[] = [];
  const did = (line: string) => {
    count++;
    log.push(line);
  };
  if (title && tokens(s.title ?? "").join(" ") !== tokens(title).join(" ")) {
    s.title = title;
    did(title);
  }
  for (let pass = 0; pass < 6; pass++) {
    const r = compareSlide(n, "", units, s);
    if (isWhole(r)) return { slide: withContentDensity(s), count, lines: log };
    const lines = [...r.lines.changed, ...r.lines.touched];
    if (lines.length || r.lines.missing.length) {
      const pending: string[] = [];
      for (const p of lines) {
        if (p.source === title) {
          s.title = title;
          did(title);
          continue;
        }
        // In place, only when that makes the line whole and breaks no other
        // (a short stretch such as "School Connectivity" can sit inside another line).
        const trial = structuredClone(s);
        const before = identical(compareSlide(n, "", units, s), units);
        const after = replaceSpan(trial, p.deck, p.source) ? identical(compareSlide(n, "", units, trial), units) : null;
        if (after && after.has(p.source) && [...before].every((l) => after.has(l))) {
          s = trial;
          did(p.source);
        } else pending.push(p.source);
      }
      for (const line of [...r.lines.missing, ...pending]) {
        if (line === title) {
          s.title = title;
          did(title);
          continue;
        }
        const next = insertLine(s, units, line);
        if (!next) return null;
        s = next;
        did(line);
      }
      continue;
    }
    // Lines whole, figures wrong: the chart's bars first, then the rest as a point.
    if (fixBars(s, units) && isWhole(compareSlide(n, "", units, s))) {
      did("The chart's values, as the source labels them");
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
    did(point);
  }
  return null;
}

// ─── Words the model added ─────────────────────────────────────────────────

/** A text with a content word the source never writes. */
const invented = (text: string, units: SourceUnits) => tokens(text).some((t) => !units.vocabulary.has(t) && !STOP.has(t));

/** The slide without one line of its footnotes (the field goes when it was the only one). */
function dropNote(s: S, k: number): S {
  const lines = (s.notes ?? "").split("\n");
  lines.splice(k, 1);
  const notes = lines.join("\n").trim();
  const { notes: _n, ...rest } = s;
  void _n;
  return notes ? { ...rest, notes } : (rest as S);
}

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
    // A footnote line of its own ("27 September 2026", the speaker notes' date).
    (x.notes ?? "").split("\n").forEach((line, k) => line.trim() && out.push({ path: `notes#${k}`, text: line, point: false }));
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
      const note = /^notes#(\d+)$/.exec(c.path);
      const row = /^blocks\.(\d+)\.label$/.exec(c.path);
      // A figures-panel row label the source never writes ("Context") is emptied; the row stays.
      const next = note
        ? dropNote(s, +note[1])
        : row && s.layoutId === "figures-panel"
          ? { ...s, blocks: s.blocks!.map((b, i) => (i === +row[1] ? { ...b, label: "" } : b)) }
          : deleteModular(s, c.path);
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
function chartTextOf(title: string, list: SourceEntry[], source: SourceChart, notes?: string, heading?: string): S | null {
  const chart = plotted(source);
  if (!chart) return null;
  const labelled = heading === undefined && header(list[0], list[1]);
  const rest = labelled ? list.slice(1) : list;
  if (rest.length > 10 || (!rest.length && !labelled && !heading)) return null;
  const k = chart.columns[0].values.length;
  const names = chart.series?.slice(0, k) ?? [];
  while (names.length < k) names.push(`Series ${names.length + 1}`);
  // A legend too long for its two rows over the plot: each series goes by
  // the words that set it apart ("health facilities"), and its full name
  // is its numbered note under the chart, the way the source numbers them.
  const long = names.reduce((n, x) => n + x.length * 11.5 + 62, 0) > 2 * 820;
  const series = long ? shortNames(names) : names;
  return {
    layoutId: "chart-text",
    title,
    subtitle: heading ?? (labelled ? list[0].text : ""),
    bullets: rest.map((e) => (e.sub ? `- ${e.text}` : e.text)),
    ...(long ? { blocks: names.map((body) => ({ label: "", body })) } : {}),
    series,
    bars: chart.columns.map((c) => {
      const values = c.values.map(num);
      return { label: c.label, value: values[0], values };
    }),
    ...(notes ? { notes } : {}),
  };
}

/** Series names without the words every one of them shares: "Cummulative costs schools (capex & opex) (USDm)" is "schools". */
function shortNames(names: string[]): string[] {
  const shared = names
    .map((n) => new Set(tokens(n)))
    .reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  return names.map((n) => {
    const kept = n
      .split(/\s+/)
      .filter((w) => {
        const t = tokens(w);
        return t.length && t.some((x) => !shared.has(x));
      })
      .join(" ")
      .replace(/[()]/g, "")
      .trim();
    return kept || n;
  });
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
  const charts = units.charts.filter(drawable);
  // A legend name of a chart that is drawn is its series' name, not a line.
  const named = (e: SourceEntry, drawn: number) =>
    e.kind === "legend" && e.chart !== undefined && charts.slice(0, drawn).includes(units.charts[e.chart]) && !!units.charts[e.chart].series?.includes(e.text);
  const text = body.filter((e) => e.kind !== "note" || !notes);
  const other = units.charts.filter((c) => !drawable(c));
  const lineKeys = new Set(text.flatMap((e) => figuresIn(e.text)));
  const floating = units.floating.filter((f) => figuresIn(f).some((k) => !lineKeys.has(k)));
  // Mostly figures: six or more written apart from any line, and more of them than one per four words of text.
  const textWords = text.reduce((n, e) => n + words(e.text), 0);
  const figureHeavy = !charts.length && floating.length >= 6 && floating.length * 4 >= textWords;

  // The lines with what is written out: the charts not drawn (all but the
  // first `drawn`), and the figures written apart when they are not a panel.
  const entriesFor = (drawn: number): SourceEntry[] => [
    ...text.filter((e) => !named(e, drawn)),
    ...[...charts.slice(drawn), ...other, ...charts.slice(0, drawn).map(remainder).filter((c): c is SourceChart => !!c)].map((c): SourceEntry => ({ text: chartText(c), sub: false, kind: "figure" })),
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

// ─── Rebuilding from the source's structure ─────────────────────────────────

type Line = SourceEntry;
type Box = { x: number; y: number; w: number; h: number; lines: Line[] };

/** A line as a point: "- " on a sub-point. */
const point = (l: Line) => (l.sub ? `- ${l.text}` : l.text);
const headLike = (l: Line | undefined) => !!l && !l.sub && words(l.text) <= 8 && !/[.;!]$/.test(l.text.trim()) && !figuresIn(l.text).length;

/**
 * A group of boxes as the points of one block, the source's grouping kept: a
 * box that opens on a header gives the block its label (the first box) or
 * a point with the box's other lines as its sub-points ("header" + "-
 * value"); any other box gives its lines at their own level.
 */
function blockOf(boxes: Box[]): Block {
  let label = "";
  const items: string[] = [];
  boxes.forEach((b, k) => {
    const headed = b.lines.length > 1 && headLike(b.lines[0]);
    if (headed && k === 0) {
      label = b.lines[0].text;
      // Points that are all one level under the header are the block's points.
      const under = b.lines.slice(1);
      items.push(...(under.every((l) => l.sub) ? under.map((l) => l.text) : under.map(point)));
    } else if (headed) {
      items.push(b.lines[0].text, ...b.lines.slice(1).map((l) => `- ${l.text}`));
    } else items.push(...b.lines.map(point));
  });
  return { label, body: "", items };
}

/** Boxes in source columns: a box joins the column its left edge falls in; each column top to bottom. */
function columnsOf(boxes: Box[]): Box[][] {
  const cols: { x0: number; x1: number; boxes: Box[] }[] = [];
  for (const b of [...boxes].sort((p, q) => p.x - q.x || p.y - q.y)) {
    const col = cols.find((c) => b.x < c.x1 - 0.01 && b.x + b.w > c.x0 + 0.01);
    if (col) {
      col.boxes.push(b);
      col.x1 = Math.max(col.x1, b.x + b.w);
    } else cols.push({ x0: b.x, x1: b.x + b.w, boxes: [b] });
  }
  return cols.map((c) => c.boxes.sort((p, q) => p.y - q.y || p.x - q.x));
}

/**
 * A grid of the source (the impact pathway on Gambia 10): a row of headers
 * over a row of values in the same columns, a label to the left of the pair
 * (the pathway), a caption between them. One band per pair, at most three,
 * two to five cells each; the matrix layout draws it as it is.
 */
function gridOf(boxes: Box[]): { bands: { label: Box | null; cells: { head: Box; value: Box | null }[] }[]; captions: Box[]; used: Set<Box> } | null {
  const rows: Box[][] = [];
  for (const b of [...boxes].sort((p, q) => p.y - q.y || p.x - q.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - b.y) < 0.012 && Math.abs(r[0].h - b.h) < 0.5 * Math.max(r[0].h, b.h) && Math.abs(r[0].w - b.w) < 0.4 * Math.max(r[0].w, b.w));
    if (row) row.push(b);
    else rows.push([b]);
  }
  // Three to five cells a row: two headed boxes side by side are two columns, not a grid.
  const multi = rows.filter((r) => r.length >= 3 && r.length <= 5).map((r) => r.sort((p, q) => p.x - q.x));
  const used = new Set<Box>();
  const bands: { label: Box | null; cells: { head: Box; value: Box | null }[]; top: number; bottom: number }[] = [];
  for (const head of multi) {
    if (head.some((b) => used.has(b))) continue;
    if (!head.every((b) => b.lines.length <= 2 && b.lines.every((l) => headLike(l)))) continue;
    const value = multi.find((r) => r !== head && !r.some((b) => used.has(b)) && r.every((b) => b.lines.length <= 3) && r[0].y > head[0].y && r[0].y - head[0].y < 0.35 && r.filter((v) => head.some((h) => Math.abs(h.x - v.x) < 0.02)).length >= Math.max(2, Math.ceil(head.length * 0.6)));
    if (!value) continue;
    const cells = head.map((h) => ({ head: h, value: value.find((v) => Math.abs(h.x - v.x) < 0.02) ?? null }));
    for (const b of [...head, ...value]) used.add(b);
    bands.push({ label: null, cells, top: head[0].y, bottom: Math.max(...value.map((v) => v.y + v.h)) });
  }
  if (!bands.length || bands.length > 3) return null;
  const captions: Box[] = [];
  for (const band of bands) {
    const left = Math.min(...band.cells.map((c) => c.head.x));
    const right = Math.max(...band.cells.map((c) => c.head.x + c.head.w));
    band.label =
      boxes.find((b) => !used.has(b) && b.x + b.w <= left + 0.01 && b.y < band.bottom && b.y + b.h > band.top && b.lines.length <= 2) ?? null;
    if (band.label) used.add(band.label);
    for (const b of boxes) {
      if (used.has(b) || b.y <= band.top || b.y >= band.bottom || b.x + b.w < left || b.x > right || b.w < (right - left) * 0.4) continue;
      captions.push(b);
      used.add(b);
    }
  }
  return { bands, captions, used };
}

/** A one-line header box right over another box, left edges aligned: one box, the header first ("Sustainable business models" over its points). */
function mergeHeads(boxes: Box[]): Box[] {
  const out = [...boxes].sort((p, q) => p.y - q.y || p.x - q.x);
  for (let i = 0; i < out.length; i++) {
    const h = out[i];
    if (h.lines.length !== 1 || !headLike(h.lines[0]) || h.w >= 0.6) continue;
    const j = out.findIndex((b, k) => k !== i && b.w < 0.6 && Math.abs(b.x - h.x) < 0.03 && b.y >= h.y + h.h - 0.01 && b.y - (h.y + h.h) < 0.05);
    if (j < 0) continue;
    const b = out[j];
    out[i] = { x: Math.min(h.x, b.x), y: h.y, w: Math.max(h.x + h.w, b.x + b.w) - Math.min(h.x, b.x), h: b.y + b.h - h.y, lines: [h.lines[0], ...b.lines] };
    out.splice(j, 1);
    if (j < i) i--;
  }
  return out;
}

/** Sections top to bottom: a full-width box opens one (its lead), the narrower boxes under it, down to the next. */
function sectionsOf(boxes: Box[]): { lead: Box | null; boxes: Box[] }[] {
  const sorted = [...boxes].sort((p, q) => p.y - q.y || p.x - q.x);
  const out: { lead: Box | null; boxes: Box[] }[] = [];
  for (const b of sorted) {
    if (b.w >= 0.6) out.push({ lead: b, boxes: [] });
    else {
      if (!out.length) out.push({ lead: null, boxes: [] });
      out[out.length - 1].boxes.push(b);
    }
  }
  return out;
}

/**
 * The slide rebuilt from where the source puts its text (`SourceSlide.boxes`,
 * a PowerPoint source only), so the rebuild reads like the source and not
 * like a list: a grid is a matrix (headers over their values, a band per
 * pathway), charts are drawn one a slide with the notes, heading and legend
 * that sit with each, and the rest are columns as the source sets them, a
 * header with the points under it. Null when the source has no structure
 * this reads; the caller then rebuilds from the lines, and keeps this only
 * when it holds every line (restoreSlide checks).
 */
export function rebuildFromBoxes(units: SourceUnits, title: string, source: SourceBox[], fits: Fits, cont = "(cont.)"): S[] | null {
  const holds = (x: S | null): x is S => !!x && !overLimits(x) && fits(x) === "ok";
  const clean = (x: S) => normalizeSlide(x) ?? x;
  const measured = new Set(units.entries.filter((e) => e.kind !== "title").map((e) => e.text));
  const titleLine = units.entries.find((e) => e.kind === "title")?.text ?? title;
  let boxes: Box[] = source
    .filter((b) => b.kind === "text")
    .map((b) => ({ ...b, lines: b.lines.map((l): Line => ({ text: l.replace(/^- /, ""), sub: /^- /.test(l), kind: "text" })).filter((l) => measured.has(l.text) || l.text === titleLine) }))
    .filter((b) => b.lines.length);
  const chartBoxes = source.filter((b) => b.kind === "chart");
  if (!boxes.length && !chartBoxes.length) return null;
  const out: S[] = [];
  let slideTitle = title;

  // What no box carries: footnotes, figures written apart, charts not drawn, table cells.
  const tail: Line[] = [];
  const noteLines = units.entries.filter((e) => e.kind === "note");
  const notes = noteLines.length && noteLines.reduce((n, e) => n + words(e.text), 0) <= NOTE_WORDS ? noteLines.map((e) => e.text).join("\n") : undefined;
  if (!notes) tail.push(...noteLines.map((e) => ({ ...e, sub: false })));

  // 1. A grid, as a matrix.
  const grid = gridOf(boxes);
  if (grid) {
    const labels = grid.bands.map((b) => b.label?.lines.map((l) => l.text).join(" ") ?? "");
    // The heading read as the first pathway: the line over everything is the slide's title then.
    const top = Math.min(...grid.bands.map((b) => (b.label ?? b.cells[0].head).y));
    const kicker = boxes.find((b) => !grid.used.has(b) && b.y + b.h <= top && b.lines.length === 1 && headLike(b.lines[0]));
    if (labels.includes(titleLine) && kicker) {
      slideTitle = kicker.lines[0].text;
      grid.used.add(kicker);
    }
    const captions = [...new Set(grid.captions.flatMap((c) => c.lines.map((l) => l.text)))];
    const band = captions.length && words(captions.join(" ")) <= 35 ? captions.join(" · ") : "";
    if (!band) boxes.push(...grid.captions);
    out.push(
      clean({
        layoutId: "matrix",
        title: slideTitle,
        blocks: grid.bands.map((b, i) => ({
          label: labels[i],
          body: "",
          stats: b.cells.map((c) => ({ label: c.head.lines.map((l) => l.text).join(" "), value: c.value?.lines.map((l) => l.text).join(" ") ?? "" })),
        })),
        ...(band ? { support: band } : {}),
      }),
    );
    boxes = boxes.filter((b) => !grid.used.has(b));
  }
  // The title's own box is the title, not a point.
  boxes = boxes.map((b) => ({ ...b, lines: b.lines.filter((l) => l.text !== titleLine || slideTitle !== titleLine) })).filter((b) => b.lines.length);

  // 2. Charts, one a slide, each with what sits in its column.
  const overflow: Block[] = [];
  const unplotted: Box[] = [];
  const unplottedText: string[] = [];
  if (chartBoxes.length) {
    if (chartBoxes.length !== units.charts.length) return null;
    const centre = (b: { x: number; w: number }) => b.x + b.w / 2;
    const region = (b: Box) => chartBoxes.reduce((best, c, i) => (Math.abs(centre(c) - centre(b)) < Math.abs(centre(chartBoxes[best]) - centre(b)) ? i : best), 0);
    const side = boxes.filter((b) => b.w < 0.6);
    boxes = boxes.filter((b) => b.w >= 0.6);
    chartBoxes.forEach((c, i) => {
      const chart = units.charts[i];
      const mine = side.filter((b) => region(b) === i).sort((p, q) => p.y - q.y || p.x - q.x);
      // Its heading: the lines over the chart in its column ("(20 km fiber scenario)").
      const over = mine.filter((b) => b.y + b.h <= c.y + 0.02 && b.lines.length === 1);
      const heading = over.map((b) => b.lines[0].text).join(" · ");
      const rest = mine.filter((b) => !over.includes(b));
      const lines: Line[] = rest.flatMap((b) => {
        const k = blockOf([{ ...b, lines: b.lines }]);
        return [...(k.label ? [{ text: k.label, sub: false, kind: "text" as const }] : []), ...(k.items ?? []).map((t) => ({ text: t.replace(/^- /, ""), sub: /^- /.test(t), kind: "text" as const }))];
      });
      const legend = units.entries.filter((e) => e.kind === "legend" && e.chart === i);
      const named = !!plotted(chart) && legend.every((e) => chart.series?.includes(e.text));
      if (!named) lines.push(...legend.map((e) => ({ ...e, kind: "text" as const })));
      const extra = plotted(chart) ? remainder(chart) : chart;
      if (extra) lines.push({ text: chartText(extra), sub: false, kind: "figure" });
      const t = out.length === 0 ? slideTitle : `${slideTitle} ${cont}`;
      // A chart that cannot be drawn: its column joins the rest as text, its values written out.
      if (!plotted(chart)) {
        unplotted.push(...mine);
        unplottedText.push(...legend.map((e) => e.text), chartText(chart));
        return;
      }
      // As many of its lines as hold beside the chart; the rest follow on a continuation.
      let m = lines.length;
      const at = (k: number) => {
        const x = chartTextOf(t, lines.slice(0, k), chart, undefined, heading);
        return x && clean(x);
      };
      while (m > 0 && !holds(at(m))) m--;
      const first = at(m) ?? at(0);
      if (!first) return;
      out.push(first);
      // What the last chart's slide cannot hold joins the columns below; an earlier chart's follows it at once.
      if (m < lines.length) {
        const more: Block = { label: "", body: "", items: lines.slice(m).map(point) };
        if (i === chartBoxes.length - 1) overflow.push(more);
        else out.push(...columnsSlides(`${slideTitle} ${cont}`, [more], holds, clean, `${slideTitle} ${cont}`));
      }
    });
    boxes.push(...unplotted);
  }

  // 3. Everything else as the source sets it: a full-width line opens a
  // section (Gambia 38: a lead over two panels, then another lead over three
  // boxes), each section its columns, a header box joined to the box under it.
  const sections = sectionsOf(mergeHeads(boxes));
  const sectionBlocks = sections.map((sec) => {
    const cols = columnsOf(sec.boxes);
    // A column of several headed boxes (Scope, then "Why schools…?") is several blocks when three columns take them.
    const groups = cols.flatMap((col) => {
      const g: Box[][] = [];
      for (const b of col) {
        if (!g.length || (b.lines.length > 1 && headLike(b.lines[0]))) g.push([b]);
        else g[g.length - 1].push(b);
      }
      return g;
    });
    const blocks = (groups.length <= 3 ? groups : cols).map(blockOf);
    const lead = sec.lead?.lines ?? [];
    // The band takes a lead of up to 60 words (it shrinks to 18px at most, `holds` checks).
    if (!blocks.length) return { blocks, band: lead.length === 1 && words(lead[0].text) <= 60 ? lead[0].text : "" };
    const band = lead.length === 1 && words(lead[0].text) <= 60 ? lead[0].text : "";
    if (lead.length && !band) blocks.unshift(blockOf([sec.lead!]));
    // More than three source columns: neighbours merge, the fewer points first.
    while (blocks.length > 3) {
      let k = 0;
      for (let i = 0; i < blocks.length - 1; i++) if ((blocks[i].items?.length ?? 0) + (blocks[i + 1].items?.length ?? 0) < (blocks[k].items?.length ?? 0) + (blocks[k + 1].items?.length ?? 0)) k = i;
      const [a, b] = [blocks[k], blocks[k + 1]];
      blocks.splice(k, 2, { label: a.label, body: "", items: [...(a.items ?? []), ...(b.label ? [b.label] : []), ...(b.items ?? [])] });
    }
    return { blocks, band };
  });
  // A lead with nothing under it (a closing line at the foot of the slide) belongs to the section above: its band, or a point.
  for (let i = sectionBlocks.length - 1; i > 0; i--) {
    const sec = sectionBlocks[i];
    if (sec.blocks.length) continue;
    const text = sections[i].lead?.lines.map((l) => l.text) ?? [];
    const prev = sectionBlocks[i - 1];
    if (sec.band && !prev.band) prev.band = sec.band;
    else prev.blocks.push({ label: "", body: "", items: sec.band ? [sec.band] : text });
    sectionBlocks.splice(i, 1);
  }
  if (overflow.length) sectionBlocks.unshift({ blocks: overflow, band: "" });
  const allBlocks = sectionBlocks.flatMap((x) => x.blocks);
  // What is on a slide already, as runs of words: a line inside a joined cell counts.
  const written = [...out, ...allBlocks.map((b): S => ({ layoutId: "bullet-columns", blocks: [b] })), ...sectionBlocks.map((x): S => ({ layoutId: "bullet-columns", support: x.band }))].flatMap((x) => [
    x.title,
    x.subtitle,
    x.support,
    ...(x.bullets ?? []),
    ...(x.series ?? []),
    ...(x.blocks ?? []).flatMap((b) => [b.label, b.body, ...(b.items ?? []), ...(b.stats ?? []).flatMap((st) => [st.label, st.value])]),
  ]).map((t) => tokens(t ?? ""));
  const placed = { has: (line: string) => written.some((w) => indexOfSeq(w, tokens(line)) >= 0) };
  // Lines no box holds (a table's cells, a line the reader kept apart), then the tail, at the end.
  const loose = units.entries.filter((e) => e.kind !== "title" && e.kind !== "note" && e.kind !== "legend" && e.kind !== "figure" && !placed.has(e.text));
  const figuresLeft = units.entries.filter((e) => e.kind === "figure" && !placed.has(e.text));
  const floatingLeft = units.floating.filter((f) => !placed.has(f));
  const end: string[] = [...loose, ...figuresLeft, ...tail].map(point);
  if (floatingLeft.length) end.push(floatingLeft.join(", "));
  for (const c of units.charts) if (!chartBoxes.length && c.columns.length) end.push(chartText(c));
  end.push(...unplottedText.filter((x) => !placed.has(x)));
  // After a chart with nothing else to follow, what is left joins its explanation when it holds there.
  const last = out[out.length - 1];
  if (end.length && !allBlocks.length && last?.layoutId === "chart-text") {
    const joined = clean({ ...last, bullets: [...(last.bullets ?? []), ...end] });
    if ((joined.bullets?.length ?? 0) <= 10 && holds(joined)) {
      out[out.length - 1] = joined;
      end.length = 0;
    }
  }
  if (end.length) {
    if (!sectionBlocks.length) sectionBlocks.push({ blocks: [], band: "" });
    sectionBlocks[sectionBlocks.length - 1].blocks.push({ label: "", body: "", items: end });
  }
  for (const sec of sectionBlocks) {
    if (!sec.blocks.some((b) => b.items?.length || b.label)) continue;
    const t = out.length ? `${slideTitle} ${cont}` : slideTitle;
    out.push(...columnsSlides(t, sec.blocks, holds, clean, `${slideTitle} ${cont}`, sec.band));
  }
  if (!out.length) return null;
  // Footnotes that fit the footer row go on the last slide, or as its points when the row cannot take them.
  if (notes) {
    const final = out[out.length - 1];
    const withNotes = { ...final, notes };
    if (holds(withNotes)) out[out.length - 1] = withNotes;
    else out.push(...columnsSlides(`${slideTitle} ${cont}`, [{ label: "", body: "", items: noteLines.map((e) => e.text) }], holds, clean, `${slideTitle} ${cont}`));
  }
  return out;
}

/**
 * Blocks over as few bullet-columns slides as hold them at 18px, in order:
 * up to three a slide, a block past ten points or past its column's height
 * split in two (its label on the first half).
 */
function columnsSlides(title: string, input: Block[], holds: (x: S | null) => boolean, clean: (x: S) => S, contTitle: string, band = ""): S[] {
  const blocks: Block[] = [];
  for (const b of input) {
    const items = b.items ?? [];
    if (!items.length && !b.label) continue;
    for (let i = 0; i < Math.max(items.length, 1); i += 10) blocks.push({ label: i ? "" : b.label, body: "", items: items.slice(i, i + 10) });
  }
  // A block alone on its slide is two columns (a full-width line of 24px text is hard to read), split in order.
  const pair = (bs: Block[]): Block[] => {
    const items = bs[0]?.items ?? [];
    if (bs.length !== 1 || items.length < 2) return bs;
    let cut = 1;
    const total = items.reduce((n, x) => n + x.length, 0);
    for (let acc = items[0].length; cut < items.length - 1 && acc + items[cut].length <= total / 2; cut++) acc += items[cut].length;
    while (cut > 1 && /^-\s/.test(items[cut])) cut--;
    return [
      { label: bs[0].label, body: "", items: items.slice(0, cut) },
      { label: "", body: "", items: items.slice(cut) },
    ];
  };
  const build = (t: string, bs: Block[], withBand: boolean): S =>
    clean({ layoutId: "bullet-columns", title: t, blocks: pair(bs).map((b) => (b.items?.length ? b : { label: "", body: "", items: [b.label] })), ...(withBand && band ? { support: band } : {}) });
  const out: S[] = [];
  let rest = blocks;
  let guard = 0;
  // A band that leaves no room even for one block is the first point instead.
  if (band && rest.length && !holds(build(title, rest.slice(0, 1), true))) {
    rest = [{ ...rest[0], items: [band, ...(rest[0].items ?? [])] }, ...rest.slice(1)];
    band = "";
  }
  while (rest.length && guard++ < 40) {
    const t = out.length ? contTitle : title;
    const withBand = !out.length;
    let k = Math.min(3, rest.length);
    while (k > 1 && !holds(build(t, rest.slice(0, k), withBand))) k--;
    if (k === 1 && !holds(build(t, rest.slice(0, 1), withBand)) && (rest[0].items?.length ?? 0) > 1) {
      // One block too tall for a column: its points split over two columns.
      const items = rest[0].items!;
      const half = Math.ceil(items.length / 2);
      rest = [{ label: rest[0].label, body: "", items: items.slice(0, half) }, { label: "", body: "", items: items.slice(half) }, ...rest.slice(1)];
      continue;
    }
    out.push(build(t, rest.slice(0, k), withBand));
    rest = rest.slice(k);
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
export function restoreSlide(n: number, sourceTitle: string, units: SourceUnits, slide: S | null, fits: Fits, opts: { cont?: string; boxes?: SourceBox[] } = {}): Restored {
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
        if (!overLimits(t.slide) && fits(t.slide) === "ok") return { ...done([t.slide], back.count, false, t.removed), lines: back.lines };
      }
    }
  }
  // The source's own structure first; the lines in order when that does not hold every one of them.
  if (opts.boxes?.length) {
    try {
      const shaped = rebuildFromBoxes(units, title, opts.boxes, fits, opts.cont);
      if (shaped && isWhole(compareSlide(n, sourceTitle, units, shaped.length === 1 ? shaped[0] : shaped))) return done(shaped, 0, true, 0);
    } catch {
      // A structure this does not read: the lines below.
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
