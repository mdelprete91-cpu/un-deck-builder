import { z } from "zod";
import { isChartColor } from "./chart-colors";
import { normalizePage, pageBlockSchema, type PageBlock } from "./pages/schema";

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
  "timeline",
  "timeline-phases",
  "example-image-left",
  "example-image-right",
  "partner",
  "thank-you",
] as const;

/** Manual-insert only: densely structured content the model would hallucinate. */
export const MANUAL_LAYOUT_IDS = ["tiers-1", "tiers-2", "photo-full"] as const;

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
}
export interface Stat {
  value: string;
  label: string;
}
export interface Bar {
  label: string;
  value: number; // 0–100
  /** Hand-picked, one of CHART_COLORS; absent means the brand series decides. */
  color?: string;
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
  /** Two-pager page ("a4-page"): the ordered block stack. */
  stack?: PageBlock[];
  /**
   * Two-pager page footer label. On the page rather than read from the theme
   * because it is editable per page ("Digital Inclusion · Songbird"); the
   * renderer falls back to the brand label while it is empty.
   */
  footerLabel?: string;
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

const blockSchema = z.object({
  label: z.string().default(""),
  body: z.string().default(""),
});
const statSchema = z.object({
  value: z.string().default(""),
  label: z.string().default(""),
});
const barSchema = z.object({
  label: z.string().default(""),
  value: z.coerce.number().min(0).max(100).default(50),
  // A hand-picked colour, one of CHART_COLORS; anything else is dropped so
  // no colour outside the brand list can arrive through a file.
  color: z
    .string()
    .optional()
    .transform((v) => (isChartColor(v) ? v.toUpperCase() : undefined)),
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
  stack: z.array(pageBlockSchema).optional(),
  footerLabel: z.string().optional(),
});

export function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

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
  partner: { bullets: [1, 15] },
  timeline: { blocks: [2, 5] },
  "timeline-phases": { blocks: [1, 5] },
  "example-image-left": { blocks: [1, 2] },
  "example-image-right": { blocks: [1, 2] },
  "thank-you": { contacts: [1, 2] },
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
  const strings = [slide.title, slide.subtitle, slide.stat, slide.support, slide.quote, slide.author, slide.body, ...(slide.bullets ?? [])];
  for (const b of slide.blocks ?? []) strings.push(b.label, b.body);
  for (const x of slide.stats ?? []) strings.push(x.value, x.label);
  for (const b of slide.bars ?? []) strings.push(b.label);
  for (const c of slide.contacts ?? []) strings.push(c.name);
  return strings.some((t) => !!t?.trim());
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
  return slide;
}

export function ensureId(content: SlideContent): Slide {
  return { ...content, id: crypto.randomUUID() };
}
