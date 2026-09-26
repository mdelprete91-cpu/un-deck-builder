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

/**
 * A series chart whose series are the categories themselves: every bar
 * carries one figure and no series is used twice (Luna drew "Primaria,
 * Secundaria, Unknown" as four stacked columns of one segment each, with a
 * legend repeating the x labels, 25 Sep 2026). It is one distribution, and
 * becomes the single-series chart of its size: the x labels stay, the
 * legend goes.
 */
function fixDiagonalSeries(content: SlideContent): SlideContent {
  if (content.layoutId !== "chart-columns-grouped" && content.layoutId !== "chart-columns-stacked" && content.layoutId !== "chart-line") return content;
  const bars = content.bars ?? [];
  if (bars.length < 2 || !bars.every((b) => b.values && b.values.length >= 2)) return content;
  const used = new Set<number>();
  for (const b of bars) {
    const hot = b.values!.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    if (hot.length !== 1 || used.has(hot[0])) return content;
    used.add(hot[0]);
  }
  const { series: _s, ...rest } = content;
  void _s;
  return {
    ...rest,
    layoutId: bars.length <= 5 ? "chart-bars" : "chart-columns-wide",
    bars: bars.map(({ values, ...b }) => ({ ...b, value: values!.find((v) => v > 0) ?? 0 })),
  };
}

/**
 * What a slide says, for the repeat check: its title and its items (block
 * labels, stat values, bullets, the hero figure). A slide that says the same
 * as an earlier one is the model repeating itself: "Key risks" twice with
 * the same two blocks, "Schools mapped" as a big stat and then as a chart of
 * one bar (26 Sep 2026, use-case QA), and it goes.
 */
function signatureOf(content: SlideContent): string {
  const title = (content.title ?? "").trim().toLowerCase();
  const items = [
    ...(content.blocks ?? []).map((b) => b.label.trim().toLowerCase()),
    ...(content.stats ?? []).map((x) => x.value.trim().toLowerCase()),
    ...(content.bullets ?? []).map((b) => b.trim().toLowerCase()),
    ...(content.bars ?? []).map((b) => b.label.trim().toLowerCase()),
    (content.stat ?? "").trim().toLowerCase(),
  ].filter(Boolean);
  return `${title}|${items.join(",")}`;
}

/**
 * "Same layout for all" once the whole series is in: the one blocks layout
 * that holds the longest slide of the series (the list past four points, else
 * the layout the series opened with when it holds them all), applied to every
 * blocks-family content slide. The streaming pass can only impose what it has
 * seen; this runs when the deck is complete (26 Sep 2026: a six-objective
 * series with two to six KRs came back in four layouts).
 */
export function unifyLayouts(slides: SlideContent[]): SlideContent[] {
  const series = slides.filter((s) => BLOCKS_FAMILY.has(s.layoutId));
  if (series.length < 2) return slides;
  const points = Math.max(...series.map((s) => s.blocks?.length ?? 0));
  const first = series[0].layoutId;
  const target: LayoutId = points >= 5 ? "list" : holdsAll(first, points) && first !== "list" ? first : alternativesFor(points)[0];
  return slides.map((s) => (BLOCKS_FAMILY.has(s.layoutId) && s.layoutId !== target ? { ...s, layoutId: target } : s));
}

/**
 * A "continued" slide folded back: two consecutive blocks-family slides with
 * the same title are one item the model split (Objective 1 with KR1-3, then
 * Objective 1 again with KR5-6, 26 Sep 2026). Their blocks join on the first
 * slide, on the list past four points, and the second goes. Runs once the
 * deck is complete, like unifyLayouts.
 */
export function mergeContinuations(slides: SlideContent[]): SlideContent[] {
  const out: SlideContent[] = [];
  for (const s of slides) {
    const prev = out[out.length - 1];
    const title = (s.title ?? "").trim().toLowerCase();
    if (
      prev &&
      title &&
      title === (prev.title ?? "").trim().toLowerCase() &&
      BLOCKS_FAMILY.has(s.layoutId) &&
      BLOCKS_FAMILY.has(prev.layoutId) &&
      (prev.blocks?.length ?? 0) + (s.blocks?.length ?? 0) <= 6
    ) {
      const blocks = [...(prev.blocks ?? []), ...(s.blocks ?? [])];
      out[out.length - 1] = { ...prev, blocks, layoutId: blocks.length > 4 ? "list" : holdsAll(prev.layoutId, blocks.length) ? prev.layoutId : alternativesFor(blocks.length)[0] };
      continue;
    }
    out.push(s);
  }
  return out;
}

/**
 * The closing slide the pipeline adds when the model left it out: the
 * brand's team as the contact, as the model is told to write it, never the
 * insert placeholder ("Name Surname", name@unicef.org, which the QA read as
 * an invented email, 26 Sep 2026). Giga's own contact only under Giga.
 */
export function closingFor(brandLabel?: string): SlideContent {
  const contact =
    brandLabel === "Giga"
      ? { name: "Giga Team", role: "Giga", location: "Geneva, Switzerland", email: "giga@unicef.org" }
      : { name: `${brandLabel ?? "UNICEF"} team`, role: "", location: "", email: "" };
  return { layoutId: "thank-you", title: "Thanks", contacts: [contact] };
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
  /** What each accepted content slide said, for the repeat check. */
  const said = new Set<string>();
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
      // A new chapter starts a new run: three parallel country slides in the
      // same layout, each behind its divider, are structure, not monotony.
      if (content.layoutId === "section-divider") {
        last = null;
        run = 0;
      }
      return content;
    }
    const fixed = fixEmptySection(fixHeroWithoutFigure(fixNonNumericStats(fixLonelyTimeline(fixDiagonalSeries(content)))));
    // A dropped slide never counts against the cap.
    if (!fixed || isRepeatChart(fixed, lastChart)) return null;
    const signature = signatureOf(fixed);
    if (signature.split("|")[0] && said.has(signature)) return null;
    said.add(signature);
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
