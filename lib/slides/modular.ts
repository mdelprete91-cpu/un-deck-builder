import type { Block, LayoutId, SlideContent } from "./schema";
import { DENSE_LAYOUTS, DENSITY_LAYOUTS, PRIMARY_ARRAY, TAKEAWAY_LAYOUTS, isChartLayout } from "./schema";
import { newItem } from "./defaults";
import { NO_NOTES } from "./layouts/dense";

/**
 * The editing model of the high-density slides (Mario, 28 Sep 2026: "every
 * high-density slide must be totally modular"): the six dense layouts and
 * every layout drawn with `density: "high"`. Pure functions, shared by the
 * reducer (the change itself, one undo step) and the editor (what the ✕ and
 * the Element menu offer, where the caret goes next).
 *
 * - A point is a string in a list: a block's `items` (or its `body`, drawn
 *   as its one point), the explanation or conclusion `bullets`, or a
 *   chart-text note (`blocks[j].body`). "- " opens a sub-point.
 * - A block is an entry of the layout's primary array (`PRIMARY_ARRAY`).
 * - An optional part is a field that may be absent: the band, the goal, the
 *   takeaway, the headers row, the intro, a header, a stat's explanation,
 *   the heading over the explanation, the conclusion, the footnote. Its ✕
 *   removes it; the Element menu brings it back with placeholder text.
 */

type S = SlideContent;

export function isModular(s: Pick<S, "layoutId" | "density">): boolean {
  return DENSE_LAYOUTS.has(s.layoutId) || (s.density === "high" && DENSITY_LAYOUTS.has(s.layoutId));
}

const set = (...ids: LayoutId[]): ReadonlySet<LayoutId> => new Set<LayoutId>(ids);
/** Blocks with a header and points. */
const CARDS = set("four-cards", "icon-cards", "steps", "three-columns", "callout", "list", "example-image-left", "example-image-right", "bullet-columns");
/** Layouts that draw `support` as the key message band. */
const BANDED = set("four-cards", "icon-cards", "steps", "bullet-columns", "matrix");
const STAGES = set("timeline", "timeline-phases", "progress");
const STAT_LISTS = set("stat-grid", "brand-equity", "two-stats");
const ONE_STAT = set("single-stat", "big-stat");
const INTRO = set("stat-grid", "brand-equity");
/** Layouts whose blocks hold points. */
const POINT_BLOCKS = new Set<LayoutId>([...CARDS, ...STAGES, "scenarios", "figures-panel", "cascade"]);
/** A block emptied by its last ✕ goes too (approved on figures-panel and cascade; a matrix row with no cell is a bare tile). */
const EMPTY_GOES = set("figures-panel", "cascade", "matrix");
/** Fields a ✕ removes outright. */
const FIELD_ITEMS: ReadonlySet<string> = new Set(["notes", "takeaway", "support", "subtitle", "body"]);

/** The block noun in the Element menu. */
const NOUN: Partial<Record<LayoutId, string>> = {
  "four-cards": "Card",
  "icon-cards": "Card",
  steps: "Card",
  "three-columns": "Column",
  "bullet-columns": "Column",
  callout: "Row",
  list: "Row",
  "example-image-left": "Row",
  "example-image-right": "Row",
  "figures-panel": "Row",
  matrix: "Row",
  cascade: "Group",
  scenarios: "Scenario",
  "stat-grid": "Stat",
  "brand-equity": "Stat",
  "two-stats": "Stat",
  timeline: "Stage",
  "timeline-phases": "Stage",
  progress: "Stage",
};

/** Points in one list (sub-points included). */
export const MAX_POINTS = 10;
const MAX_NOTES = 3;
const itemMax = (s: S) => (s.layoutId === "cascade" ? 6 : MAX_POINTS);
const statMax = (s: S) => (s.layoutId === "cascade" ? 4 : 5);

/** A chart with its explanation card (subtitle + bullets) beside the plot. */
const explained = (s: S) => s.layoutId === "chart-text" || (isChartLayout(s.layoutId) && s.density === "high");

type List = { kind: "items"; block: number } | { kind: "bullets" } | { kind: "notes" };

function pointsIn(s: S, list: List): string[] {
  if (list.kind === "bullets") return [...(s.bullets ?? [])];
  if (list.kind === "notes") return (s.blocks ?? []).map((b) => b.body);
  const b = s.blocks?.[list.block];
  if (!b) return [];
  return b.items?.length ? [...b.items] : b.body?.trim() ? [b.body] : [];
}

/** Write a list back (items: `body` is folded into the list, so it empties). */
function writePoints(s: S, list: List, arr: string[]): void {
  if (list.kind === "bullets") {
    s.bullets = arr;
    return;
  }
  if (list.kind === "notes") {
    const blocks = s.blocks ?? [];
    s.blocks = arr.map((body, k) => ({ ...(blocks[k] ?? { label: "" }), body }));
    if (!s.blocks.length) delete s.blocks;
    return;
  }
  const b = s.blocks![list.block];
  b.body = "";
  if (arr.length) b.items = arr;
  else delete b.items;
}

const pathOf = (list: List, k: number) =>
  list.kind === "items" ? `blocks.${list.block}.items.${k}` : list.kind === "bullets" ? `bullets.${k}` : `blocks.${k}.body`;
const maxOf = (s: S, list: List) => (list.kind === "items" ? itemMax(s) : list.kind === "notes" ? MAX_NOTES : MAX_POINTS);

/** The list a text path is a point of, and its place in it; null for anything else. */
export function pointAt(s: S, path: string): { list: List; index: number } | null {
  if (!isModular(s)) return null;
  let m = /^blocks\.(\d+)\.items\.(\d+)$/.exec(path);
  if (m && POINT_BLOCKS.has(s.layoutId)) return { list: { kind: "items", block: +m[1] }, index: +m[2] };
  m = /^blocks\.(\d+)\.body$/.exec(path);
  if (m && s.layoutId === "chart-text") return { list: { kind: "notes" }, index: +m[1] };
  if (m && POINT_BLOCKS.has(s.layoutId)) return { list: { kind: "items", block: +m[1] }, index: 0 };
  m = /^bullets\.(\d+)$/.exec(path);
  if (m && (explained(s) || s.layoutId === "scenarios")) return { list: { kind: "bullets" }, index: +m[1] };
  return null;
}

/** Whether a point can be a sub-point (Tab): not a policy card, a note, or a stage's lone paragraph. */
export function nests(s: S, path: string): boolean {
  const at = pointAt(s, path);
  if (!at || at.list.kind === "notes" || s.layoutId === "cascade") return false;
  return !(STAGES.has(s.layoutId) && path.endsWith(".body"));
}

function addPointAt<T extends S>(s: T, list: List, at: number, text: string, before?: string): { slide: T; path: string } | null {
  const clone = structuredClone(s);
  if (list.kind === "notes") {
    const blocks = clone.blocks ?? [];
    if (blocks.length >= MAX_NOTES) return null;
    if (before !== undefined && blocks[at - 1]) blocks[at - 1].body = before;
    blocks.splice(at, 0, { label: "", body: text });
    clone.blocks = blocks;
    return { slide: clone, path: pathOf(list, at) };
  }
  if (list.kind === "items" && !clone.blocks?.[list.block]) return null;
  const arr = pointsIn(clone, list);
  if (arr.length >= maxOf(s, list)) return null;
  if (before !== undefined) arr[at - 1] = before;
  arr.splice(at, 0, text);
  writePoints(clone, list, arr);
  return { slide: clone, path: pathOf(list, at) };
}

/**
 * Split the point at `path` (Enter): it keeps `before` (the text left of the
 * caret, when given) and a new point with `text` follows it.
 */
export function insertPoint<T extends S>(s: T, path: string, text: string, before?: string): { slide: T; path: string } | null {
  const at = pointAt(s, path);
  return at ? addPointAt(s, at.list, at.index + 1, text, before) : null;
}

/** Remove an empty point (Backspace): the slide, and where the caret goes (the previous point, or the one that moved up). */
export function removePoint<T extends S>(s: T, path: string): { slide: T; focus: string } | null {
  const at = pointAt(s, path);
  const slide = at ? deleteModular(s, at.list.kind === "notes" ? `blocks.${at.index}` : path) : null;
  if (!at || !slide) return null;
  return { slide, focus: pathOf(at.list, Math.max(0, at.index - 1)) };
}

/**
 * The ✕ on a high-density slide. Returns the slide without the element, or
 * null when it cannot go (the editor then draws no ✕): the last point of a
 * block (its block's ✕ removes the block), a block under the layout's
 * minimum, the last element of an explanation card.
 */
export function deleteModular<T extends S>(s: T, path: string): T | null {
  const clone = structuredClone(s);
  // Fields: the band, the goal, the takeaway, the headers row ("subtitle,support"), the intro, the footnote.
  if (/^[a-z]+(,[a-z]+)*$/i.test(path)) {
    const names = path.split(",");
    if (!names.every((n) => FIELD_ITEMS.has(n))) return null;
    if (names.includes("subtitle") && explained(s) && !(s.bullets ?? []).some((b) => b.trim())) return null;
    for (const n of names) delete (clone as Record<string, unknown>)[n];
    return clone;
  }
  // A header or a stat's explanation is emptied, never the block's last text.
  let m = /^blocks\.(\d+)\.label$/.exec(path);
  if (m) {
    const b = clone.blocks?.[+m[1]];
    if (!b || !CARDS.has(s.layoutId) || !pointsIn(s, { kind: "items", block: +m[1] }).length) return null;
    b.label = "";
    return clone;
  }
  m = /^stats\.(\d+)\.label$/.exec(path);
  if (m) {
    const st = clone.stats?.[+m[1]];
    if (!st || !st.value.trim()) return null;
    st.label = "";
    return clone;
  }
  m = /^bullets\.(\d+)$/.exec(path);
  if (m) {
    const arr = clone.bullets ?? [];
    if (+m[1] >= arr.length) return null;
    if (explained(s) && arr.length === 1 && !s.subtitle?.trim()) return null;
    arr.splice(+m[1], 1);
    clone.bullets = arr;
    return clone;
  }
  // chart-text's notes are blocks with a body, from three down to none.
  m = /^blocks\.(\d+)$/.exec(path);
  if (m && s.layoutId === "chart-text") {
    if (!clone.blocks?.[+m[1]]) return null;
    clone.blocks.splice(+m[1], 1);
    if (!clone.blocks.length) delete clone.blocks;
    return clone;
  }
  // Inside a block: a figure, objective or cell ("blocks.1.stats.0"), a
  // point or policy ("blocks.1.items.2", or "blocks.1.body" when the block
  // has only a body), a row's whole commentary ("blocks.1.items").
  const inner = /^blocks\.(\d+)\.(?:(items|stats)(?:\.(\d+))?|(body))$/.exec(path);
  if (inner) {
    const b = +inner[1];
    const block = s.blocks?.[b];
    if (!block) return null;
    if (EMPTY_GOES.has(s.layoutId)) {
      const next: Block = structuredClone(block);
      if (inner[4] || (inner[2] === "items" && inner[3] === undefined)) {
        next.body = "";
        if (!inner[4]) delete next.items;
      } else {
        const arr = next[inner[2] as "items" | "stats"];
        if (!arr || inner[3] === undefined) return null;
        arr.splice(+inner[3], 1);
        if (!arr.length) delete next[inner[2] as "items" | "stats"];
      }
      // A block left with nothing in it goes too, unless it is the last one.
      if (!next.items?.length && !next.stats?.length && !next.body.trim()) {
        if ((s.blocks?.length ?? 0) <= 1) return null;
        clone.blocks!.splice(b, 1);
      } else clone.blocks![b] = next;
      return clone;
    }
    if (inner[2] === "stats" || (inner[2] === "items" && inner[3] === undefined)) return null;
    const list: List = { kind: "items", block: b };
    const arr = pointsIn(s, list);
    const j = inner[4] ? 0 : +inner[3];
    if (arr.length <= 1 || j >= arr.length) return null;
    arr.splice(j, 1);
    writePoints(clone, list, arr);
    return clone;
  }
  // A block, a stat, a bar: down to the layout's minimum.
  const parts = path.split(".");
  const spec = PRIMARY_ARRAY[s.layoutId];
  if (!spec || parts.length !== 2 || spec.field !== parts[0] || !/^\d+$/.test(parts[1])) return null;
  const arr = s[spec.field];
  if (!Array.isArray(arr) || arr.length <= Math.max(1, spec.min) || +parts[1] >= arr.length) return null;
  (clone[spec.field] as unknown[]).splice(+parts[1], 1);
  return clone;
}

/* ------------------------------------------------------------------ */
/*  The Element menu                                                   */
/* ------------------------------------------------------------------ */

export interface AddOption {
  id: string;
  label: string;
  /** Where it goes, or why it is off ("Up to 4"). */
  hint?: string;
  disabled?: boolean;
}
/** A change, and the text to focus (selected) once it is drawn. */
type Change<T> = { slide: T; focus?: string };
type Candidate<T> = AddOption & { apply: () => Change<T> | null };

const NEW_POINT = "New point";
const blockOf = (focus?: string | null) => {
  const m = /^blocks\.(\d+)(\.|$)/.exec(focus ?? "");
  return m ? +m[1] : null;
};
const statOf = (focus?: string | null) => {
  const m = /^stats\.(\d+)(\.|$)/.exec(focus ?? "");
  return m ? +m[1] : null;
};
const named = (b?: Block, fallback = "the selected block") => (b?.label?.trim() ? `In ${b.label.trim()}` : `In ${fallback}`);

/** A new block for the layout, placeholder text in the layout's shape. */
function newBlock(s: S): Block | { value: string; label: string } {
  const n = (s.blocks ?? []).length;
  if (STAT_LISTS.has(s.layoutId)) return { value: "00%", label: "What the figure measures, where it comes from and over which period" };
  if (s.layoutId === "matrix") {
    const cells = s.blocks?.[n - 1]?.stats ?? [{ label: "", value: "" }, { label: "", value: "" }];
    return { label: "Row", body: "", stats: cells.map((c) => ({ label: c.label.trim() || "Heading", value: "What it shows" })) };
  }
  if (s.layoutId === "scenarios") return { label: `Scenario ${n + 1}`, body: "", items: ["What the scenario assumes"] };
  // A dense stage lists its points like its neighbours (a body alone is drawn as a centred paragraph).
  if (STAGES.has(s.layoutId)) return { label: "Label", body: "", items: ["One sentence describing the point"] };
  return newItem("blocks") as Block;
}

function candidates<T extends S>(s: T, focus?: string | null): Candidate<T>[] {
  const out: Candidate<T>[] = [];
  const blocks = s.blocks ?? [];
  const fb = s.layoutId === "chart-text" ? null : blockOf(focus);
  const withText = (mut: (c: T) => string | undefined): Change<T> => {
    const c = structuredClone(s);
    const f = mut(c);
    return { slide: c, focus: f };
  };

  // Point: after the focused point, in the focused block, else the last block or the explanation.
  const at = focus ? pointAt(s, focus) : null;
  let target: { list: List; at: number; hint: string } | null = null;
  if (at && at.list.kind !== "notes") target = { list: at.list, at: at.index + 1, hint: "After the selected point" };
  else if (fb !== null && POINT_BLOCKS.has(s.layoutId) && blocks[fb])
    target = { list: { kind: "items", block: fb }, at: pointsIn(s, { kind: "items", block: fb }).length, hint: named(blocks[fb]) };
  else if (explained(s) || (s.layoutId === "scenarios" && (focus === "subtitle" || /^bullets\./.test(focus ?? "")) && s.bullets?.some((b) => b.trim())))
    target = { list: { kind: "bullets" }, at: (s.bullets ?? []).length, hint: s.layoutId === "scenarios" ? "In the conclusion" : "In the explanation" };
  else if (POINT_BLOCKS.has(s.layoutId) && blocks.length)
    target = { list: { kind: "items", block: blocks.length - 1 }, at: pointsIn(s, { kind: "items", block: blocks.length - 1 }).length, hint: named(blocks[blocks.length - 1], "the last block") };
  if (target) {
    const t = target;
    const full = pointsIn(s, t.list).length >= maxOf(s, t.list);
    out.push({
      id: "point",
      label: s.layoutId === "cascade" ? "Policy" : "Point",
      hint: full ? `Up to ${maxOf(s, t.list)} here` : t.hint,
      disabled: full,
      apply: () => {
        const r = addPointAt(s, t.list, t.at, NEW_POINT);
        return r && { slide: r.slide, focus: r.path };
      },
    });
  }

  // The block itself.
  const spec = PRIMARY_ARRAY[s.layoutId];
  if (spec && (spec.field === "blocks" || spec.field === "stats")) {
    const n = (s[spec.field] ?? []).length;
    out.push({
      id: "block",
      label: NOUN[s.layoutId] ?? "Block",
      hint: n >= spec.max ? `Up to ${spec.max}` : undefined,
      disabled: n >= spec.max,
      apply: () =>
        n >= spec.max
          ? null
          : withText((c) => {
              ((c[spec.field] ??= [] as never) as unknown[]).push(newBlock(s));
              return spec.field === "stats" ? `stats.${n}.value` : `blocks.${n}.label`;
            }),
    });
  }

  // What a block holds besides points: figures, objectives, cells.
  const sub = ({ "figures-panel": ["figure", "Figure"], cascade: ["objective", "Objective"], matrix: ["cell", "Cell"] } as Partial<Record<LayoutId, [string, string]>>)[s.layoutId];
  if (sub && blocks.length) {
    const b = fb !== null && blocks[fb] ? fb : blocks.length - 1;
    const k = (blocks[b].stats ?? []).length;
    const full = k >= statMax(s);
    out.push({
      id: sub[0],
      label: sub[1],
      hint: full ? `Up to ${statMax(s)} here` : named(blocks[b], "the last row"),
      disabled: full,
      apply: () =>
        full
          ? null
          : withText((c) => {
              const cell = s.layoutId === "figures-panel" ? { value: "00", label: "What the figure measures" } : s.layoutId === "cascade" ? { value: "A new objective", label: "" } : { label: "Heading", value: "What it shows" };
              (c.blocks![b].stats ??= []).push(cell);
              return `blocks.${b}.stats.${k}.${s.layoutId === "matrix" ? "label" : "value"}`;
            }),
    });
  }
  if (s.layoutId === "chart-text") {
    const n = blocks.length;
    out.push({
      id: "note",
      label: "Note",
      hint: n >= MAX_NOTES ? `Up to ${MAX_NOTES}` : "Under the chart",
      disabled: n >= MAX_NOTES,
      apply: () => {
        const r = addPointAt(s, { kind: "notes" }, n, "What this line shows, and its value at the end");
        return r && { slide: r.slide, focus: r.path };
      },
    });
  }

  // Optional parts, only while they are missing.
  const field = (id: string, label: string, hint: string, key: "support" | "takeaway" | "body" | "subtitle", text: string) =>
    out.push({ id, label, hint, apply: () => withText((c) => ((c[key] = text), key)) });
  if (CARDS.has(s.layoutId) && blocks.some((b) => !b.label?.trim())) {
    const only = fb !== null && blocks[fb] && !blocks[fb].label?.trim() ? [fb] : blocks.flatMap((b, i) => (b.label?.trim() ? [] : [i]));
    out.push({
      id: "header",
      label: "Header",
      hint: only.length === 1 ? `On ${NOUN[s.layoutId]?.toLowerCase() ?? "block"} ${only[0] + 1}` : `On ${only.length} ${(NOUN[s.layoutId]?.toLowerCase() ?? "block")}s`,
      apply: () =>
        withText((c) => {
          for (const i of only) c.blocks![i].label = "Header";
          return `blocks.${only[0]}.label`;
        }),
    });
  }
  if (BANDED.has(s.layoutId) && !s.support?.trim()) field("band", "Key message", "The band under the content", "support", "The key message, in one sentence");
  if (s.layoutId === "cascade" && !s.support?.trim()) field("goal", "Goal", "The band the objectives converge on", "support", "The goal every objective converges on, in one sentence");
  if (TAKEAWAY_LAYOUTS.has(s.layoutId) && !s.takeaway?.trim()) field("takeaway", "Takeaway", "The band closing the slide", "takeaway", "The one sentence the figures add up to");
  if (s.layoutId === "figures-panel" && !s.subtitle?.trim() && !s.support?.trim())
    out.push({
      id: "headers",
      label: "Headers",
      hint: "Over the figures and the commentary",
      apply: () => withText((c) => ((c.subtitle = "In numbers"), (c.support = "Commentary"), "subtitle")),
    });
  if (INTRO.has(s.layoutId) && !s.body?.trim()) field("intro", "Intro", "A paragraph over the figures", "body", "One or two sentences that frame the figures");
  if (STAT_LISTS.has(s.layoutId) && (s.stats ?? []).some((st) => !st.label?.trim())) {
    const stats = s.stats ?? [];
    const fs = statOf(focus);
    const only = fs !== null && stats[fs] && !stats[fs].label?.trim() ? [fs] : stats.flatMap((st, i) => (st.label?.trim() ? [] : [i]));
    out.push({
      id: "explanation",
      label: "Explanation",
      hint: only.length === 1 ? `Under stat ${only[0] + 1}` : `Under ${only.length} stats`,
      apply: () =>
        withText((c) => {
          for (const i of only) c.stats![i].label = "What the figure measures, where it comes from and over which period";
          return `stats.${only[0]}.label`;
        }),
    });
  }
  if (ONE_STAT.has(s.layoutId) && !s.support?.trim()) field("explanation", "Explanation", "Beside the figure", "support", "What the figure means, where it comes from and over which period");
  if (explained(s) && !s.subtitle?.trim()) field("heading", "Heading", "Over the explanation", "subtitle", s.layoutId === "chart-text" ? "Overview" : "What the chart shows");
  if (s.layoutId === "scenarios") {
    if (!(s.bullets ?? []).some((b) => b.trim()))
      out.push({
        id: "conclusion",
        label: "Conclusion",
        hint: "A panel beside the scenarios",
        apply: () =>
          withText((c) => {
            c.bullets = ["What we recommend, and why"];
            if (!c.subtitle?.trim()) c.subtitle = "Conclusion";
            return "bullets.0";
          }),
      });
    else if (!s.subtitle?.trim()) field("heading", "Heading", "Over the conclusion", "subtitle", "Observations and recommendations");
  }
  if (!NO_NOTES.has(s.layoutId) && !s.notes?.trim())
    out.push({ id: "footnote", label: "Footnote", hint: "In the footer row", apply: () => withText((c) => ((c.notes = "1. "), "notes")) });
  return out;
}

/** What the Element menu offers on this slide, given the text that has the caret (if any). */
export function addOptions(s: S, focus?: string | null): AddOption[] {
  if (!isModular(s)) return [];
  return candidates(s, focus).map(({ id, label, hint, disabled }) => ({ id, label, hint, disabled }));
}

/** Apply one Element menu entry; null when it is off. */
export function addPart<T extends S>(s: T, id: string, focus?: string | null): Change<T> | null {
  if (!isModular(s)) return null;
  const c = candidates(s, focus).find((o) => o.id === id);
  return c && !c.disabled ? c.apply() : null;
}
