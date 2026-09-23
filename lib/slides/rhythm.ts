import { PRIMARY_ARRAY, type LayoutId, type SlideContent } from "./schema";

/**
 * Rhythm for a series the brief prescribes ("one slide per objective").
 *
 * The model does not vary layouts inside such a series on request: six
 * runs with rhythm rules in the prompt gave six identical slides four
 * times (22-23 Sep 2026). So the variety is decided here, while the slides
 * stream in, with no model call: a slide of the blocks family that repeats
 * the previous content slide's layout is moved to another layout of its
 * point count. Only layouts whose body budget holds text written for
 * `list` (up to 30 words a point) are used, so nothing shrinks:
 *
 *   1-2 points  example-image-left / example-image-right  (30 words, fit 230)
 *   3 points    four-cards (3 columns, fit 367) / three-columns (fit 380)
 *   4 points    four-cards (2x2, fit 196 ≈ 28 words) / list
 *   5-6 points  list, and only list
 *
 * icon-cards, steps and callout are not automatic alternatives: at four
 * columns their bodies hold about fifteen words. They stay a manual pick in
 * the layout switcher.
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

/**
 * Returns a pass to run each incoming slide through, in order. It keeps
 * the last content layout it saw and returns the slide unchanged or with
 * a new `layoutId`; the text is never touched.
 */
export function makeRhythm(): (content: SlideContent) => SlideContent {
  let last: LayoutId | null = null;
  return (content) => {
    if (STRUCTURAL.has(content.layoutId)) return content;
    if (!BLOCKS_FAMILY.has(content.layoutId)) {
      last = content.layoutId;
      return content;
    }
    const points = content.blocks?.length ?? 0;
    const options = alternativesFor(points);
    let layoutId = content.layoutId;
    // A list of two or four rows is mostly white space (Mario, 23 Sep 2026):
    // under five points "list" is a fallback, never the model's pick.
    const thinList = layoutId === "list" && points <= 4;
    if (layoutId === last || thinList || !holdsAll(layoutId, points)) {
      layoutId = options.find((id) => id !== last) ?? options[0];
    }
    last = layoutId;
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
