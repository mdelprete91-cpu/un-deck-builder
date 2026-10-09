import { z } from "zod";
import { toChartColor } from "./chart-colors";
import { cleanModelIcons } from "./icon-set";
import { libraryPhoto, PHOTO_LAYOUTS, photoFits, slideWords } from "./library";
import { normalizePage, PAGE_FITS, pageBlockSchema, type PageBlock, type PageFit } from "./pages/schema";
import type { ChartSource } from "./chart-import";

/** Layouts the AI is allowed to pick. */
export const AI_LAYOUT_IDS = [
  "cover",
  "agenda",
  "three-columns",
  "callout",
  "section-divider",
  "big-stat",
  "quote",
  "section-image-deep",
  "section-image-light",
  "four-cards",
  // Drawn 23 Sep 2026 for briefs that hand over a list per slide (six KRs
  // under one objective): the callout's rows, full width, up to six.
  "list",
  "steps",
  "body-copy",
  "photo",
  "icon-cards",
  "stat-grid",
  "brand-equity",
  "two-stats",
  "single-stat",
  "chart-bars",
  "donut-chart",
  // Drawn 25 Sep 2026 from chart-bars' axis, grid and tints, full width
  // under the title (Mario's approved exception to "layouts come from the
  // template"): many categories, a ranking, a trend, a comparison, a
  // composition. The last three read `series` + `bars[i].values`.
  "chart-columns-wide",
  "chart-bars-horizontal",
  "chart-line",
  "chart-columns-grouped",
  "chart-columns-stacked",
  // Drawn 6 Oct 2026 on the same axis, grid and tints (Mario): a funnel, a
  // waterfall, an area chart, 100% bars and progress towards a target, which
  // reads its two series as current and target.
  "chart-funnel",
  "chart-waterfall",
  "chart-area",
  "chart-bars-100",
  "chart-progress",
  "timeline",
  "timeline-phases",
  // Drawn 26 Sep 2026 from timeline-phases with Mario's approval: stages on a
  // progress bar, done / in progress / next (layouts/progress.ts).
  "progress",
  // Dense layouts for report-style decks, where a slide carries 150-250
  // words and every figure stays (Mario approved them 28 Sep 2026, drawn
  // for the Gambia joint investment case): layouts/dense.ts.
  "bullet-columns",
  "figures-panel",
  "scenarios",
  "matrix",
  "chart-text",
  // Policies cascading to objectives, converging on one goal (Mario approved
  // it 28 Sep 2026 from the patterns sheet): layouts/dense.ts `cascade`.
  "cascade",
  "example-image-left",
  "example-image-right",
  "partner",
  "thank-you",
] as const;

/** Manual-insert only: densely structured content the model would hallucinate. */
export const MANUAL_LAYOUT_IDS = [
  "tiers-1",
  "tiers-2",
  "photo-full",
] as const;

/**
 * Retired layouts: kept only so decks saved before the ban still validate and
 * render (the renderer maps them to brand-safe surfaces). Never offered to the
 * AI or in the insert list. "section-image-dark" violated the Giga no-black rule.
 */
// "map" is "photo" with a default world map: same geometry, one more entry
// in every list (Mario, 15 Sep 2026). Retired; a live map goes on a photo slide.
export const LEGACY_LAYOUT_IDS = ["section-image-dark", "map"] as const;

/**
 * The two-pager page. Not a slide layout: it is never offered to the AI as a
 * layoutId, never in the insert list, and its content lives in `stack` rather
 * than in the flat slide fields. It is a LayoutId only so a page can sit in
 * `state.slides` and inherit reorder, duplicate, delete, undo and persistence
 * unchanged.
 */
export const PAGE_LAYOUT_IDS = ["a4-page"] as const;

export const LAYOUT_IDS = [
  ...AI_LAYOUT_IDS,
  ...MANUAL_LAYOUT_IDS,
  ...LEGACY_LAYOUT_IDS,
  ...PAGE_LAYOUT_IDS,
] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

/** True for a two-pager page, which most slide-only machinery must skip. */
export function isPage(s: { layoutId: LayoutId }): boolean {
  return s.layoutId === "a4-page";
}

export interface Block {
  label: string;
  body: string;
  /** Dense layouts: the block's points, one string each; "- " opens a sub-point. */
  items?: string[];
  /**
   * figures-panel: the row's figures; matrix: the row's cells (label =
   * heading, value = text); cascade: the group's objectives (value = text).
   * On cascade `items` are the group's policies.
   */
  stats?: Stat[];
}
export interface Stat {
  value: string;
  label: string;
}
export interface Bar {
  label: string;
  /** A real figure, the chart scales to the largest (a share on the donut). */
  value: number;
  /** One figure per entry of the slide's `series`, on the multi-series charts; `value` is ignored there. */
  values?: number[];
  /** Hand-picked, one of CHART_COLORS; absent means the brand series decides. */
  color?: string;
}

/** The chart layouts that read `series` and `bars[i].values`, with the series they hold. */
export const SERIES_LAYOUTS: Partial<Record<LayoutId, [number, number]>> = {
  "chart-line": [1, 3],
  "chart-columns-grouped": [2, 3],
  "chart-columns-stacked": [2, 4],
  "chart-area": [1, 3],
  "chart-bars-100": [2, 4],
  // Current and target, always both.
  "chart-progress": [2, 2],
  "chart-text": [1, 3],
};

/** Every layout whose data the Data panel edits (a `bars` array, with or without series). */
export function isChartLayout(layoutId: LayoutId): boolean {
  return layoutId in ARRAY_LIMITS && ARRAY_LIMITS[layoutId]?.bars !== undefined;
}
export interface Contact {
  name: string;
  role: string;
  location: string;
  email: string;
}

/**
 * Flat slide shape: one optional field set shared by every layout.
 * Which fields are required/used is defined per layout in `catalog.ts`
 * and enforced by `normalizeSlide`.
 */
export interface SlideContent {
  layoutId: LayoutId;
  title?: string;
  subtitle?: string;
  stat?: string;
  support?: string;
  quote?: string;
  author?: string;
  body?: string;
  bullets?: string[];
  blocks?: Block[];
  stats?: Stat[];
  bars?: Bar[];
  /** Series names (legend) for the multi-series charts, see SERIES_LAYOUTS. */
  series?: string[];
  /**
   * Where a chart's data was imported from (lib/slides/chart-import.ts): the
   * file or Google Sheet, the sheet and the columns, so the Data panel can
   * update it. Metadata only, never the file; never sent to the model.
   */
  chartSource?: ChartSource;
  /** The progress slide's stage in progress, 1-based; absent is a plain sequence. */
  current?: number;
  contacts?: Contact[];
  /** Closing slide: the social row, seeded from DEFAULT_CHANNELS. */
  channels?: Channel[];
  /** Uploaded image (data URL) overriding the layout's default photo. */
  image?: string;
  /**
   * Country map slug (see country-maps.ts) shown in the image slot instead of
   * a photo. A slug, not a data URL: the file is served from /country-maps, so
   * the deck stays small and the export inlines the image once.
   */
  map?: string;
  /** Photo reframe: focal point in % (default 50/50) and zoom (1-4). */
  imagePos?: ImagePos;
  /**
   * Footer-logo contrast on right-photo layouts, computed from the pixels
   * under the logo: "dark" → white logo, "light" → dark logo. Unset = layout default.
   */
  logoTone?: "light" | "dark";
  /** Tier tables: cell overrides ("on" | "half" | text | null), row-major. */
  grid?: (string | null)[][];
  /** Partner slide: uploaded SVG logos (data URL) keyed by partner slug. */
  logos?: Record<string, string>;
  /** Icon-card slides: chosen icon slug per block (see lib/slides/icons.ts). */
  icons?: string[];
  /** The user picked an icon on this slide: an AI rewrite keeps the icons as they are. */
  iconsPinned?: boolean;
  /** Model output only: a library photo id for the slide's photo slot, turned into `image` by normalizeSlide. */
  photo?: string;
  /** "high": the layout's high-density variant (layouts/density.ts), for slides that carry a report's text. */
  density?: "high";
  /** Footnotes, printed in the footer row (layouts/dense.ts `footnote`). */
  notes?: string;
  /**
   * The takeaway: one closing sentence in an accent band with an icon, at the
   * bottom of the slide (layouts/dense.ts `takeawayBand`). Slide-level, like
   * `notes`, so any layout could take it; drawn only on TAKEAWAY_LAYOUTS.
   */
  takeaway?: string;
  /** Two-pager page ("a4-page"): the ordered block stack. */
  stack?: PageBlock[];
  /**
   * Two-pager page footer label. On the page rather than read from the theme
   * because it is editable per page ("Digital Inclusion · Songbird"); the
   * renderer falls back to the brand label while it is empty.
   */
  footerLabel?: string;
  /** Two-pager page: how tightly it is set (pages/schema.ts PAGE_FITS). Set by the fit pass. */
  pageFit?: PageFit;
  /** Two-pager first page: the date in the masthead ("October 2026"). */
  pageDate?: string;
  /**
   * Two-pager first page: a programme logo at the top right, in place of the
   * date (pages/logos.ts): a path we ship, or an uploaded image.
   */
  pageLogo?: string;
}

export interface Channel {
  label: string;
  value: string;
}

/**
 * The social row on the closing slide. Giga's own handles, the same on every
 * brand, so nobody has to retype them — but they live on the slide and are
 * editable, because a deck for a specific audience sometimes needs a different
 * contact. The model never writes them: they are not in the AI output schema.
 */
export const DEFAULT_CHANNELS: Channel[] = [
  { label: "Website", value: "giga.global" },
  { label: "Email", value: "info@giga.global" },
  { label: "Instagram", value: "@giga_global" },
  { label: "X", value: "@gigaglobal" },
  { label: "LinkedIn", value: "/gigaglobal" },
];

/** The UNICEF lockups close on UNICEF's channels, not Giga's (Mario, 22 Sep 2026). */
export const UNICEF_CHANNELS: Channel[] = [
  { label: "Website", value: "unicef.org" },
  { label: "Email", value: "" },
  { label: "Instagram", value: "@unicef" },
  { label: "X", value: "@unicef" },
  { label: "LinkedIn", value: "/unicef" },
];

/** The social row a closing slide is seeded with, by lockup. */
export function channelsFor(brandId?: string): Channel[] {
  return (brandId === "giga" || !brandId ? DEFAULT_CHANNELS : UNICEF_CHANNELS).map((c) => ({ ...c }));
}

export interface ImagePos {
  x: number;
  y: number;
  zoom: number;
}

export interface Slide extends SlideContent {
  id: string;
}

const statSchema = z.object({
  value: z.string().default(""),
  label: z.string().default(""),
});
const blockSchema = z.object({
  label: z.string().default(""),
  body: z.string().default(""),
  items: z
    .array(z.string())
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
  stats: z
    .array(statSchema)
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
});
const barSchema = z.object({
  label: z.string().default(""),
  // A real figure: 12,450 schools is a bar too. Until 25 Sep 2026 this
  // clamped at 100 and any larger number failed the slide silently.
  // Negative only on chart-text (costs below zero); every other chart draws
  // from zero and clamps at render (`numeric` in layouts/stats.ts).
  value: z.coerce.number().default(0),
  values: z
    .array(z.coerce.number())
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
  // A hand-picked colour, one of CHART_COLORS; anything else is dropped so
  // no colour outside the brand list can arrive through a file.
  color: z
    .string()
    .optional()
    .transform((v) => toChartColor(v)),
});
const channelSchema = z.object({
  label: z.string().default(""),
  value: z.string().default(""),
});
const contactSchema = z.object({
  name: z.string().default(""),
  role: z.string().default(""),
  location: z.string().default(""),
  email: z.string().default(""),
});

export const slideContentSchema = z.object({
  layoutId: z.enum(LAYOUT_IDS),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  stat: z.string().optional(),
  support: z.string().optional(),
  quote: z.string().optional(),
  author: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  blocks: z.array(blockSchema).optional(),
  stats: z.array(statSchema).optional(),
  bars: z.array(barSchema).optional(),
  // An invalid link is dropped, never the slide.
  chartSource: z
    .object({
      kind: z.enum(["file", "gsheet"]),
      name: z.string().max(200),
      url: z.string().max(500).regex(/^https:\/\/docs\.google\.com\/spreadsheets\//).optional(),
      mapping: z.object({
        sheet: z.string().max(200),
        headerRow: z.number().int().min(-1).max(5000),
        labelCol: z.number().int().min(0).max(200),
        valueCols: z.array(z.number().int().min(0).max(200)).max(10),
      }),
      importedAt: z.number(),
    })
    .optional()
    .catch(undefined),
  series: z
    .array(z.string())
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
  current: z.coerce
    .number()
    .optional()
    .transform((v) => (v && v >= 1 ? Math.round(v) : undefined)),
  contacts: z.array(contactSchema).optional(),
  channels: z.array(channelSchema).optional(),
  image: z.string().optional(),
  map: z.string().optional(),
  imagePos: z
    .object({
      x: z.coerce.number().min(0).max(100),
      y: z.coerce.number().min(0).max(100),
      zoom: z.coerce.number().min(1).max(4),
    })
    .optional(),
  logoTone: z.enum(["light", "dark"]).optional(),
  grid: z.array(z.array(z.union([z.string(), z.null()]))).optional(),
  logos: z.record(z.string(), z.string()).optional(),
  icons: z.array(z.string()).optional(),
  iconsPinned: z.boolean().optional(),
  photo: z.string().optional(),
  stack: z.array(pageBlockSchema).optional(),
  footerLabel: z.string().optional(),
  pageFit: z.enum(PAGE_FITS).optional().catch(undefined),
  pageDate: z.string().optional(),
  pageLogo: z.string().optional(),
  notes: z.string().optional(),
  takeaway: z.string().optional(),
  density: z
    .string()
    .optional()
    .transform((v) => (v === "high" ? ("high" as const) : undefined)),
});

export function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

/** The layouts that have a high-density variant (layouts/density.ts `DENSE_RENDERERS`, keep the two in step). */
export const DENSITY_LAYOUTS: ReadonlySet<LayoutId> = new Set<LayoutId>([
  "four-cards", "icon-cards", "steps", "three-columns", "callout", "list", "example-image-left", "example-image-right",
  "stat-grid", "brand-equity", "two-stats", "single-stat", "big-stat",
  "chart-bars", "chart-columns-wide", "chart-columns-grouped", "chart-columns-stacked", "chart-bars-horizontal", "chart-line", "donut-chart",
  "timeline", "timeline-phases", "progress",
]);

/** The layouts drawn for report-style decks (layouts/dense.ts). */
export const DENSE_LAYOUTS: ReadonlySet<LayoutId> = new Set<LayoutId>(["bullet-columns", "figures-panel", "scenarios", "matrix", "chart-text", "cascade"]);

/** The layouts that draw `takeaway` (figures-panel only for now); `normalizeSlide` drops it elsewhere. */
export const TAKEAWAY_LAYOUTS: ReadonlySet<LayoutId> = new Set<LayoutId>(["figures-panel"]);

export type ArrayField = "bullets" | "blocks" | "stats" | "bars" | "contacts";

/**
 * Per-layout array size limits: [min, max] items kept. Renderers adapt their
 * geometry to the count, so the mins are structural safety only — the target
 * counts the AI should aim for live in catalog.ts.
 */
const ARRAY_LIMITS: Partial<Record<LayoutId, Partial<Record<ArrayField, [number, number]>>>> = {
  agenda: { bullets: [1, 9] },
  "body-copy": { blocks: [1, 2] },
  "three-columns": { blocks: [1, 3] },
  callout: { blocks: [1, 4] },
  "four-cards": { blocks: [1, 4] },
  list: { blocks: [1, 6] },
  steps: { blocks: [1, 4] },
  "icon-cards": { blocks: [1, 4] },
  "stat-grid": { stats: [1, 6] },
  "brand-equity": { stats: [1, 6] },
  "two-stats": { stats: [1, 2] },
  "chart-bars": { bars: [2, 5] },
  "donut-chart": { bars: [2, 5] },
  "chart-columns-wide": { bars: [3, 30] },
  "chart-bars-horizontal": { bars: [2, 15] },
  "chart-line": { bars: [3, 24] },
  "chart-columns-grouped": { bars: [2, 10] },
  "chart-columns-stacked": { bars: [2, 10] },
  "chart-funnel": { bars: [3, 6] },
  "chart-waterfall": { bars: [3, 10] },
  "chart-area": { bars: [3, 24] },
  "chart-bars-100": { bars: [2, 8] },
  "chart-progress": { bars: [1, 5] },
  partner: { bullets: [1, 15] },
  timeline: { blocks: [2, 6] },
  "timeline-phases": { blocks: [1, 5] },
  progress: { blocks: [2, 6] },
  "example-image-left": { blocks: [1, 2] },
  "example-image-right": { blocks: [1, 2] },
  "thank-you": { contacts: [1, 2] },
  "bullet-columns": { blocks: [1, 3] },
  "figures-panel": { blocks: [1, 4] },
  scenarios: { blocks: [1, 3] },
  matrix: { blocks: [1, 3] },
  "chart-text": { bars: [2, 12] },
  cascade: { blocks: [1, 4] },
};

/** The editable item array of each layout (for add/delete element in the editor). */
export const PRIMARY_ARRAY: Partial<Record<LayoutId, { field: ArrayField; min: number; max: number }>> =
  Object.fromEntries(
    Object.entries(ARRAY_LIMITS).map(([layoutId, fields]) => {
      const [field, [min, max]] = Object.entries(fields)[0] as [ArrayField, [number, number]];
      return [layoutId, { field, min, max }];
    }),
  );

/**
 * Validate a raw model-produced slide, clamp array sizes, and drop slides
 * that are unusable. Word-length discipline is handled by the prompt; here
 * we only guarantee structural sanity.
 */
/** Split running prose into two halves at a sentence boundary (body-copy columns). */
export function splitBodyBlocks(body: string): Block[] {
  const text = body.trim();
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+\s*$/g) ?? [text];
  let first = "";
  let i = 0;
  while (i < sentences.length - 1 && (first + sentences[i]).length < text.length / 2) {
    first += sentences[i++];
  }
  if (i === 0) first = sentences[i++];
  const second = sentences.slice(i).join("").trim();
  return second
    ? [
        { label: "", body: first.trim() },
        { label: "", body: second },
      ]
    : [{ label: "", body: first.trim() }];
}

function hasText(slide: SlideContent): boolean {
  const strings = [slide.title, slide.subtitle, slide.stat, slide.support, slide.quote, slide.author, slide.body, slide.takeaway, ...(slide.bullets ?? [])];
  for (const b of slide.blocks ?? []) {
    strings.push(b.label, b.body, ...(b.items ?? []));
    for (const x of b.stats ?? []) strings.push(x.value, x.label);
  }
  for (const x of slide.stats ?? []) strings.push(x.value, x.label);
  for (const b of slide.bars ?? []) strings.push(b.label);
  for (const c of slide.contacts ?? []) strings.push(c.name);
  return strings.some((t) => !!t?.trim());
}

/**
 * The multi-series contract, made true whatever arrived: `series` holds
 * between the layout's min and max names, and every bar carries exactly one
 * figure per series (a missing one is 0, a lone `value` counts as the first).
 * A single-series layout drops both, so a slide moved from a line chart to
 * plain columns keeps its first series as `value`.
 */
export function normalizeSeries(slide: SlideContent): void {
  const span = SERIES_LAYOUTS[slide.layoutId];
  if (!span) {
    if (slide.bars?.some((b) => b.values)) {
      slide.bars = slide.bars.map(({ values, ...b }) => ({ ...b, value: values?.[0] ?? b.value }));
    }
    delete slide.series;
    return;
  }
  const [min, max] = span;
  let series = (slide.series ?? []).slice(0, max);
  const widest = Math.max(0, ...(slide.bars ?? []).map((b) => b.values?.length ?? 0));
  while (series.length < Math.max(min, Math.min(widest, max))) series.push(`Series ${series.length + 1}`);
  series = series.map((s, i) => (s.trim() ? s : `Series ${i + 1}`));
  slide.series = series;
  slide.bars = (slide.bars ?? []).map((b) => {
    const values = (b.values ?? [b.value]).slice(0, series.length);
    while (values.length < series.length) values.push(0);
    return { ...b, value: values[0], values };
  });
}

/**
 * The first array of a model slide that holds more than its layout draws
 * ("blocks 7 of 6"), or null. `normalizeSlide` cuts it silently; a replica
 * asks again instead (runReplicate), since a cut there is lost source text.
 * The dense layouts' own caps count too: ten points a column, five figures
 * a row.
 */
export function overLimits(raw: unknown): { field: string; count: number; max: number } | null {
  const parsed = slideContentSchema.safeParse(raw);
  if (!parsed.success) return null;
  const slide = parsed.data as SlideContent;
  for (const [field, [, max]] of Object.entries(ARRAY_LIMITS[slide.layoutId] ?? {}) as [ArrayField, [number, number]][]) {
    const count = (slide[field] as unknown[] | undefined)?.length ?? 0;
    if (count > max) return { field, count, max };
  }
  if (DENSE_LAYOUTS.has(slide.layoutId)) {
    for (const b of slide.blocks ?? []) {
      const points = b.items?.filter((x) => x.trim()).length ?? 0;
      const figures = b.stats?.length ?? 0;
      if (points > 10) return { field: "points in one block", count: points, max: 10 };
      if (figures > 5) return { field: "figures in one block", count: figures, max: 5 };
    }
  }
  return null;
}

export function normalizeSlide(
  raw: unknown,
  opts: { keepClosingTitle?: boolean; brandId?: string } = {},
): SlideContent | null {
  const parsed = slideContentSchema.safeParse(raw);
  if (!parsed.success) return null;
  const slide = parsed.data as SlideContent;

  // A slide with nothing written on it is not a slide: the model padded a
  // deck with three empty covers after the closing slide (23 Sep 2026).
  // photo-full has no text by design and is never the model's.
  if (!isPage(slide) && slide.layoutId !== "photo-full" && !hasText(slide)) return null;
  // A two-pager page validates its own stack and nothing else: none of the
  // slide-shaped rules below apply, and ARRAY_LIMITS has no "a4-page" entry
  // (adding one would reject every page, since `stack` is not an ArrayField).
  if (isPage(slide)) {
    const stack = normalizePage(slide.stack);
    if (!stack) return null;
    slide.stack = stack;
    // The label has to exist for the editor to write to it: setPath is a
    // silent no-op on a missing field.
    slide.footerLabel = slide.footerLabel ?? "";
    return slide;
  }

  // The closing slide is always titled "Thanks" — only the user may change
  // it by editing the slide; the model never picks the wording. A reopened
  // deck file is the user's own output, so it keeps whatever it says, as
  // long as it says something.
  if (slide.layoutId === "thank-you" && !(opts.keepClosingTitle && slide.title?.trim())) {
    slide.title = "Thanks";
  }

  // The social row is editable, so it has to exist on the slide: setPath is a
  // silent no-op on a missing array, and the model never writes this field.
  if (slide.layoutId === "thank-you" && !slide.channels?.length) {
    slide.channels = channelsFor(opts.brandId);
  }

  // body-copy moved from one `body` string to 1-2 `blocks`; convert model or
  // legacy output that still carries prose in `body`.
  if (slide.layoutId === "body-copy" && !slide.blocks?.length && slide.body) {
    slide.blocks = splitBodyBlocks(slide.body);
    delete slide.body;
  }

  const limits = ARRAY_LIMITS[slide.layoutId];
  if (limits) {
    for (const [field, [min, max]] of Object.entries(limits) as [ArrayField, [number, number]][]) {
      const arr = slide[field];
      if (!Array.isArray(arr) || arr.length < min) return null;
      if (arr.length > max) (slide[field] as unknown[]) = arr.slice(0, max);
    }
  }
  // A library photo the model picked fills the photo slot, never over an
  // image already there (the user's upload or pick); on a layout with no
  // photo slot, or with an unknown id, it is dropped and the placeholder stays.
  if (slide.photo !== undefined) {
    const src = PHOTO_LAYOUTS.has(slide.layoutId) ? libraryPhoto(slide.photo) : undefined;
    // A picture of somewhere else than the country the slide is about goes;
    // fillPhotos then gives the slot a photo that fits.
    if (src && !slide.image && !slide.map && photoFits(src, slideWords(slide))) slide.image = src;
    delete slide.photo;
  }
  // Icons: a pinned set is the user's and stays; otherwise only known names
  // from the curated list survive, and only where a layout draws them.
  if (!slide.iconsPinned) {
    slide.icons = slide.layoutId === "icon-cards" ? cleanModelIcons(slide.icons) : undefined;
    if (!slide.icons) delete slide.icons;
  }
  // Dense layouts: a column holds ten points at most, a row five figures or cells.
  if (DENSE_LAYOUTS.has(slide.layoutId) && slide.blocks) {
    slide.blocks = slide.blocks.map((b) => ({
      ...b,
      ...(b.items ? { items: b.items.filter((x) => x.trim()).slice(0, 10) } : {}),
      ...(b.stats ? { stats: b.stats.filter((x) => x.value.trim() || x.label.trim()).slice(0, 5) } : {}),
    }));
  }
  // Cascade: an objective written in `label` moves to `value`; a group with
  // neither policy nor objective is an empty header and goes (one stays).
  // Six policies and four objectives a group at most, or the columns get
  // too narrow to read.
  if (slide.layoutId === "cascade" && slide.blocks) {
    slide.blocks = slide.blocks.map((b) => ({
      ...b,
      ...(b.items ? { items: b.items.slice(0, 6) } : {}),
      ...(b.stats ? { stats: b.stats.map((st) => ({ value: st.value.trim() ? st.value : st.label, label: "" })).slice(0, 4) } : {}),
    }));
    const full = slide.blocks.filter((b) => b.items?.length || b.stats?.length || b.body.trim());
    if (full.length) slide.blocks = full;
  }
  if (slide.notes !== undefined && !slide.notes.trim()) delete slide.notes;
  if (slide.takeaway !== undefined && (!slide.takeaway.trim() || !TAKEAWAY_LAYOUTS.has(slide.layoutId))) delete slide.takeaway;
  if (!slide.density || !DENSITY_LAYOUTS.has(slide.layoutId)) delete slide.density;
  // A negative figure reads with a typographic minus ("−32.79"), not a hyphen.
  const minus = (v: string) => v.replace(/^-(?=\s?[\d$€£.]|USD|GMD|EUR)/, "\u2212");
  if (slide.stat) slide.stat = minus(slide.stat);
  if (slide.stats) slide.stats = slide.stats.map((st) => ({ ...st, value: minus(st.value) }));
  if (isChartLayout(slide.layoutId)) {
    normalizeSeries(slide);
    // A chart reads its bars and nothing else: blocks or stats the model
    // wrote beside them (a grouped chart with two empty blocks, 26 Sep 2026)
    // would only reach the editor as fields nothing renders. chart-text is
    // the exception: its explanation is `bullets`, its notes `blocks`.
    if (slide.layoutId === "chart-text" || slide.density === "high") {
      // A dense chart keeps its explanation (subtitle + bullets) beside the plot.
      slide.blocks = slide.blocks?.slice(0, 3);
      if (!slide.blocks?.length) delete slide.blocks;
    } else {
      delete slide.blocks;
      delete slide.bullets;
    }
    delete slide.stats;
  }
  return slide;
}

export function ensureId(content: SlideContent): Slide {
  return { ...content, id: crypto.randomUUID() };
}
