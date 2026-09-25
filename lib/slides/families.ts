import { PRIMARY_ARRAY, type LayoutId, type SlideContent } from "./schema";
import { LAYOUTS } from "./layouts";

/**
 * Layouts grouped by the fields they read. Inside a family a slide moves
 * from one layout to another by changing `layoutId` and rendering again:
 * no model call, the text is the user's own, and the preview shows it as
 * it will be. This is what the layout switcher offers (23 Sep 2026, after
 * the model-written version cost a deck's worth of tokens per opening).
 *
 * A layout absent from this table never appears in the switcher. Add every
 * new layout here, or it can only be reached through Add slide.
 */
export type Family = "blocks" | "stats" | "bars" | "series" | "section" | "hero" | "photo";

export interface FamilyEntry {
  family: Family;
  /** What the layout does for the text, for the caption under the preview. */
  note: string;
  photo?: boolean;
  dark?: boolean;
}

export const LAYOUT_FAMILIES: Partial<Record<LayoutId, FamilyEntry>> = {
  "four-cards": { family: "blocks", note: "Labelled cards, 2x2 with four" },
  "icon-cards": { family: "blocks", note: "Cards with an icon each" },
  steps: { family: "blocks", note: "Numbered cards in a row" },
  "three-columns": { family: "blocks", note: "Up to three pillars on the dark surface", dark: true },
  callout: { family: "blocks", note: "Rows beside a full-height photo", photo: true },
  "example-image-left": { family: "blocks", note: "Text beside a photo on the left", photo: true },
  "example-image-right": { family: "blocks", note: "Text beside a photo on the right", photo: true },
  list: { family: "blocks", note: "Rows, up to six" },
  "stat-grid": { family: "stats", note: "Up to six numbers beside the title" },
  "two-stats": { family: "stats", note: "One or two numbers with explanations" },
  "brand-equity": { family: "stats", note: "An intro paragraph over the numbers" },
  "chart-bars": { family: "bars", note: "Column chart" },
  "donut-chart": { family: "bars", note: "Donut with legend" },
  "chart-columns-wide": { family: "bars", note: "Columns across the full width" },
  "chart-bars-horizontal": { family: "bars", note: "Horizontal bars, a ranking" },
  "chart-line": { family: "series", note: "Lines over time" },
  "chart-columns-grouped": { family: "series", note: "Columns side by side" },
  "chart-columns-stacked": { family: "series", note: "Stacked columns" },
  "section-image-deep": { family: "section", note: "Title and text on the deep surface, photo beside", photo: true, dark: true },
  "section-image-light": { family: "section", note: "Title and text on white, photo beside", photo: true },
  "big-stat": { family: "hero", note: "One number on the deep surface", dark: true },
  "single-stat": { family: "hero", note: "One number on white" },
  photo: { family: "photo", note: "Photo under a title", photo: true },
  "photo-full": { family: "photo", note: "Photo edge to edge", photo: true },
};

export function familyOf(layoutId: LayoutId): Family | null {
  return LAYOUT_FAMILIES[layoutId]?.family ?? null;
}

/** How many items the slide's editable array holds (0 when the layout has none). */
export function itemCount(slide: SlideContent): number {
  const primary = PRIMARY_ARRAY[slide.layoutId];
  if (!primary) return 0;
  return ((slide[primary.field] as unknown[] | undefined) ?? []).length;
}

/** How many of `n` items a layout shows (its renderer slices the rest away). */
export function capacityOf(layoutId: LayoutId, n: number): number {
  const primary = PRIMARY_ARRAY[layoutId];
  return primary ? Math.min(n, primary.max) : n;
}

export interface SwitchTarget {
  layoutId: LayoutId;
  label: string;
  note: string;
  /** Items the target shows, of `total` on the slide. */
  keeps: number;
  total: number;
  photo: boolean;
}

/**
 * The layouts this slide can move to, best first: the ones with a photo
 * that hold every item (a photo is the first thing people reach for
 * against a flat deck), then the rest that hold every item alternating
 * light and dark, then the ones that show fewer, so the loss is visible
 * before the pick, never after.
 */
export function switchTargets(slide: SlideContent): SwitchTarget[] {
  const family = familyOf(slide.layoutId);
  if (!family) return [];
  const total = itemCount(slide);
  const candidates = (Object.entries(LAYOUT_FAMILIES) as [LayoutId, FamilyEntry][])
    .filter(([id, entry]) => entry.family === family && id !== slide.layoutId)
    .map(([id, entry]) => ({
      layoutId: id,
      label: LAYOUTS[id].label,
      note: entry.note,
      keeps: capacityOf(id, total),
      total,
      photo: !!entry.photo,
      dark: !!entry.dark,
    }));
  const full = candidates.filter((c) => c.keeps >= total);
  const partial = candidates.filter((c) => c.keeps < total).sort((a, b) => b.keeps - a.keeps);
  const withPhoto = full.filter((c) => c.photo);
  const rest = full.filter((c) => !c.photo);
  // Alternate surfaces among the plain ones so the row reads with rhythm.
  const light = rest.filter((c) => !c.dark);
  const dark = rest.filter((c) => c.dark);
  const alternated: typeof rest = [];
  while (light.length || dark.length) {
    if (light.length) alternated.push(light.shift()!);
    if (dark.length) alternated.push(dark.shift()!);
  }
  return [...withPhoto, ...alternated, ...partial].map(({ dark: _d, ...t }) => {
    void _d;
    return t;
  });
}
