import { PRIMARY_ARRAY, type LayoutId, type SlideContent } from "./schema";

/**
 * Deterministic passes over the slides as they stream in. None of them
 * calls the model and none touches the text: they change a layout id or
 * drop a slide that should not exist.
 *
 * Rhythm. The model does not vary layouts on request: six runs with rhythm
 * rules in the prompt gave six identical slides four times (22-23 Sep
 * 2026), and outside a series it still put four big stats or four card
 * grids in a row. So a slide that would extend a run of one layout past
 * `maxRun` (1 inside a series the brief prescribes, 2 elsewhere), or that
 * does not hold all its points, or that is a `list` under five points
 * (mostly white space), moves to another layout of the same family and
 * point count. Only layouts whose body budget holds text written for
 * `list` (30 words a point) are used for the blocks family, so nothing
 * shrinks:
 *
 *   1-2 points  example-image-left / example-image-right  (30 words, fit 230)
 *   3 points    four-cards (3 columns, fit 367) / three-columns (fit 380)
 *   4 points    four-cards (2x2, fit 196 ≈ 28 words) / list
 *   5-6 points  list, and only list
 *
 * icon-cards, steps and callout are not automatic alternatives: at four
 * columns their bodies hold about fifteen words. They stay a manual pick in
 * the layout switcher. The hero pair (big-stat / single-stat) and the
 * section pair (section-image-light / -deep) alternate the same way.
 */
const BLOCKS_FAMILY = new Set<string>([
  "four-cards",
  "icon-cards",
  "steps",
  "three-columns",
  "callout",
  "example-image-left",
  "example-image-right",
  "list",
]);

/** Same fields, so a swap costs nothing: the hero and section pairs. */
const PAIRS: Partial<Record<LayoutId, LayoutId[]>> = {
  "big-stat": ["big-stat", "single-stat"],
  "single-stat": ["big-stat", "single-stat"],
  "section-image-light": ["section-image-light", "section-image-deep"],
  "section-image-deep": ["section-image-light", "section-image-deep"],
};

/** Cover, agenda, dividers and the closing slide neither count nor change. */
const STRUCTURAL = new Set<string>(["cover", "agenda", "section-divider", "thank-you"]);

export function alternativesFor(points: number): LayoutId[] {
  if (points <= 2) return ["example-image-left", "example-image-right"];
  if (points === 3) return ["four-cards", "three-columns"];
  if (points === 4) return ["four-cards", "list"];
  return ["list"];
}

/** True when the layout shows all `points` of the slide (its renderer slices the rest). */
function holdsAll(layoutId: LayoutId, points: number): boolean {
  const primary = PRIMARY_ARRAY[layoutId];
  return !primary || primary.max >= points;
}

export interface RhythmOptions {
  /** True for a series the brief prescribes: no two identical layouts in a row. */
  series?: boolean;
  /** The brief asked for one layout throughout ("same layout for all"): runs are left alone. */
  uniform?: boolean;
  /**
   * The deck's total when the brief named one, closing slide included: a
   * content slide past it is dropped (the model delivered eleven for "dieci
   * slide", 23 Sep 2026). The closing slide always gets through.
   */
  cap?: number;
}

/**
 * A timeline with a single point is a hero slide wearing a ruler: the model
 * split "Q1, Q2, Q3, Q4" into four one-phase timelines (23 Sep 2026). The
 * point's label becomes the figure when it fits the stat's 8 characters
 * ("Q1 2027"), else the title of a section slide; the body follows.
 */
function fixLonelyTimeline(content: SlideContent): SlideContent {
  if (content.layoutId !== "timeline" && content.layoutId !== "timeline-phases") return content;
  if ((content.blocks?.length ?? 0) !== 1) return content;
  const [point] = content.blocks!;
  const { blocks: _b, ...rest } = content;
  void _b;
  if (point.label.trim().length <= 8) {
    return { ...rest, layoutId: "big-stat", stat: point.label.trim(), support: point.body };
  }
  return { ...rest, layoutId: "section-image-light", title: point.label.trim(), body: point.body };
}

/**
 * A hero slide with no figure is a statement wearing a number's clothes:
 * four decks in twenty (23 Sep 2026) had a big-stat with the stat empty and
 * the argument in `support`. It becomes the deep section slide, the
 * sentence as its body; the title stays empty for the user to write.
 */
function fixHeroWithoutFigure(content: SlideContent): SlideContent {
  if (content.layoutId !== "big-stat" && content.layoutId !== "single-stat") return content;
  if (/\d/.test(content.stat ?? "")) return content;
  const { stat: _s, support, ...rest } = content;
  void _s;
  // The statement is the heading: one sentence stands alone as the title,
  // a longer text gives its first sentence to the title and keeps the rest.
  const text = (support ?? "").trim();
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+\s*$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];
  const title = content.title?.trim() || sentences[0] || "";
  const body = content.title?.trim() ? text : sentences.slice(1).join(" ");
  return { ...rest, layoutId: "section-image-deep", title, body };
}

/**
 * A section slide is a title over a paragraph beside a photo. Without the
 * paragraph it is a photo with a caption ("Why we're here" and nothing
 * else, Mario, 25 Sep 2026, on Luna's first day): a stray sentence in
 * `support` or `subtitle` becomes the body, otherwise the slide goes and
 * the top-up fills a counted deck.
 */
function fixEmptySection(content: SlideContent): SlideContent | null {
  if (content.layoutId !== "section-image-light" && content.layoutId !== "section-image-deep") return content;
  if (content.body?.trim()) return content;
  const spare = (content.support ?? content.subtitle ?? "").trim();
  if (!spare) return null;
  const { support: _s, subtitle: _t, ...rest } = content;
  void _s;
  void _t;
  return { ...rest, body: spare };
}

/** The chart layouts: their data is `bars` (label, value, values). */
const CHART_FAMILY = new Set<string>([
  "chart-bars",
  "donut-chart",
  "chart-columns-wide",
  "chart-bars-horizontal",
  "chart-line",
  "chart-columns-grouped",
  "chart-columns-stacked",
]);

/** Every (label, figure) pair a chart draws, as strings, for the duplicate check. */
function chartPairs(content: SlideContent): Set<string> {
  const out = new Set<string>();
  for (const b of content.bars ?? []) {
    const figures = b.values?.length ? b.values : [b.value];
    for (const v of figures) out.add(`${b.label.trim().toLowerCase()}=${v}`);
  }
  return out;
}

/**
 * A chart whose every pair is already on the previous chart is that chart
 * again: Luna drew a three-line trend and then one line per series with
 * the same figures (25 Sep 2026), four charts in a row from one table.
 */
function isRepeatChart(content: SlideContent, previous: Set<string> | null): boolean {
  if (!previous || !CHART_FAMILY.has(content.layoutId)) return false;
  const pairs = chartPairs(content);
  if (pairs.size === 0) return false;
  for (const p of pairs) if (!previous.has(p)) return false;
  return true;
}

/** Layouts whose items are a figure and a label. */
const STATS_FAMILY = new Set<string>(["stat-grid", "two-stats", "brand-equity"]);

/**
 * A stat whose value has no digit is a label wearing a number's clothes
 * ("Ericsson" / "Vodafone" as two-stats values, 23 Sep 2026). The pairs
 * become labelled blocks, value as the label, and the slide becomes a card
 * grid or, past four, a list: the same words, a layout that fits them.
 */
function fixNonNumericStats(content: SlideContent): SlideContent {
  if (!STATS_FAMILY.has(content.layoutId) || !content.stats?.length) return content;
  if (content.stats.every((x) => /\d/.test(x.value))) return content;
  const blocks = content.stats.map((x) => ({ label: x.value, body: x.label }));
  const { stats: _s, ...rest } = content;
  void _s;
  return { ...rest, layoutId: blocks.length > 4 ? "list" : "four-cards", blocks };
}

/**
 * Returns a pass to run each incoming slide through, in order. It returns
 * the slide unchanged, with a new `layoutId`, or null for a slide that
 * should not be there: one arriving after the closing slide (the model
 * padded a deck with three empty covers after "Thanks", 23 Sep 2026).
 */
export function makeRhythm(opts: RhythmOptions = {}): (content: SlideContent) => SlideContent | null {
  const maxRun = opts.uniform ? Infinity : opts.series ? 1 : 2;
  let last: LayoutId | null = null;
  let run = 0;
  let closed = false;
  let accepted = 0;
  /** The figures of the last chart that went through, for the repeat check. */
  let lastChart: Set<string> | null = null;
  /** "Same layout" in the brief: the first blocks-family layout, which every later one takes. */
  let uniformLayout: LayoutId | null = null;
  const settle = (layoutId: LayoutId) => {
    run = layoutId === last ? run + 1 : 1;
    last = layoutId;
  };
  return (content) => {
    if (closed) return null;
    if (content.layoutId === "thank-you") {
      closed = true;
      return content;
    }
    // Room for the closing slide: past cap - 1 nothing but "Thanks" lands.
    if (opts.cap && accepted >= opts.cap - 1) return null;
    if (STRUCTURAL.has(content.layoutId)) {
      accepted++;
      return content;
    }
    const fixed = fixEmptySection(fixHeroWithoutFigure(fixNonNumericStats(fixLonelyTimeline(content))));
    // A dropped slide never counts against the cap.
    if (!fixed || isRepeatChart(fixed, lastChart)) return null;
    content = fixed;
    if (CHART_FAMILY.has(content.layoutId)) lastChart = chartPairs(content);
    accepted++;
    let layoutId: LayoutId = content.layoutId;
    const wouldOverrun = layoutId === last && run >= maxRun;
    if (BLOCKS_FAMILY.has(layoutId)) {
      const points = content.blocks?.length ?? 0;
      // "Same layout for all" is a demand, not a preference: the model still
      // varied one slide in eight (25 Sep 2026), so the first blocks layout
      // is imposed on the rest whenever it holds their points.
      if (opts.uniform) {
        if (!uniformLayout) uniformLayout = layoutId;
        else if (holdsAll(uniformLayout, points)) layoutId = uniformLayout;
      }
      const options = alternativesFor(points);
      // A list of two or four rows is mostly white space (Mario, 23 Sep
      // 2026): under five points "list" is a fallback, never the pick.
      const thinList = !opts.uniform && layoutId === "list" && points <= 4;
      if (wouldOverrun || thinList || !holdsAll(layoutId, points)) {
        layoutId = options.find((id) => id !== last) ?? options[0];
      }
    } else if (wouldOverrun && PAIRS[layoutId]) {
      layoutId = PAIRS[layoutId]!.find((id) => id !== last) ?? layoutId;
    }
    settle(layoutId);
    return layoutId === content.layoutId ? content : { ...content, layoutId };
  };
}

/**
 * A year the brief never gave, in the cover's subtitle, is the model's
 * invention ("2024 objectives and key results", three times on 22-23 Sep
 * 2026 with the rule against it in the prompt). The subtitle goes.
 */
export function stripInventedYear(content: SlideContent, brief: string): SlideContent {
  if (content.layoutId !== "cover" || !content.subtitle) return content;
  const years = content.subtitle.match(/\b(?:19|20)\d{2}\b/g);
  if (!years) return content;
  if (years.every((y) => brief.includes(y))) return content;
  return { ...content, subtitle: "" };
}
