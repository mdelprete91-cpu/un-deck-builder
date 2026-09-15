import { z } from "zod";
import type { ImagePos } from "../schema";

/**
 * Two-pager pages: the block vocabulary.
 *
 * A page is a vertical stack of approved blocks, not a fixed full-page layout,
 * because that is what the ten signed-off A4 boards actually are. The blocks
 * come from those boards; nothing here is invented.
 */
export const PAGE_BLOCK_TYPES = [
  "title",
  "lede",
  "rail-prose",
  "status-callout",
  "stat-cards",
  "icon-columns",
  "photo-cards",
  "two-col-panels",
  "figure-split",
  "screens-flow",
  "table",
  "numbered-badges",
  "contacts",
  "divider",
] as const;
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

/** Blocks the AI may pick. Every one of them, steered by page-catalog.ts. */
export const AI_BLOCK_TYPES = PAGE_BLOCK_TYPES;

/**
 * Retired blocks: kept renderable so saved two-pagers still open, never
 * offered to the AI or in the block picker. The LEGACY_LAYOUT_IDS contract,
 * one level down. Empty for now — the list exists so retiring a block is a
 * one-line change instead of a migration.
 */
export const LEGACY_BLOCK_TYPES: readonly PageBlockType[] = [];

/**
 * One line inside a block's repeating array. Flat and shared by every block
 * type for the same reason SlideContent is flat: a discriminated union becomes
 * a JSON-Schema `oneOf`, which is what produced "Schema is too complex" on
 * Haiku. Which fields a type uses is defined in page-catalog.ts.
 */
export interface PageItem {
  /** rail-prose: the line's role. Ignored by every other block. */
  kind?: "para" | "bullet" | "number";
  /** stat value · card title · first cell · contact name · bold lead-in */
  label: string;
  /** caption · card subtitle · second cell · contact role · the line itself */
  body: string;
  /** third cell · contact email · second caption */
  extra: string;
  /** icon-columns: lucide slug. User-picked, never written by the model. */
  icon?: string;
  /** photo-cards / screens-flow: uploaded image (data URL). Never AI-written. */
  image?: string;
  imagePos?: ImagePos;
}

export interface PageBlock {
  type: PageBlockType;
  /** Left-rail label (x=24 w=100), 12pt SemiBold accent. */
  rail?: string;
  /** Page title for "title"; block heading elsewhere. */
  heading?: string;
  /** Secondary line: figure caption, column sub-head. */
  sub?: string;
  /** Bold inline lead-in ("Status:", a sentence opener). */
  lead?: string;
  /** Single run of body text, for blocks with no item array. */
  body?: string;
  /** The block's repeating array; meaning per type, see PageItem. */
  items?: PageItem[];
  /** figure-split: the single image slot. */
  image?: string;
  imagePos?: ImagePos;
  /** figure-split: the pill tag above the text ("Phase 1"). */
  tag?: string;
  /** stat-cards: index of the accented card. two-col-panels: filled column. -1 = none. */
  accent?: number;
  /** two-col-panels / screens-flow: draw the tinted background panel. */
  panel?: boolean;
}

/**
 * [min, max] items per block; null = the block has no item array.
 * Structural safety only, like ARRAY_LIMITS — the counts the AI should aim
 * for live in page-catalog.ts.
 */
export const PAGE_BLOCK_LIMITS: Record<PageBlockType, [number, number] | null> = {
  title: null,
  lede: null,
  divider: null,
  "status-callout": null,
  "figure-split": null,
  "rail-prose": [1, 14],
  "stat-cards": [2, 6],
  "icon-columns": [2, 3],
  "photo-cards": [1, 4],
  "two-col-panels": [2, 2],
  "screens-flow": [2, 3],
  table: [1, 12],
  "numbered-badges": [1, 6],
  contacts: [1, 4],
};

/** A page that needs more than this is two pages. */
export const MAX_BLOCKS_PER_PAGE = 14;

const imagePosSchema = z.object({
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  zoom: z.coerce.number().min(1).max(4),
});

/**
 * Every string defaults to "" rather than staying optional: `setPath` is a
 * silent no-op on a missing node, so a field the editor can write to has to
 * exist on the item even when the model left it out.
 */
export const pageItemSchema = z.object({
  kind: z.enum(["para", "bullet", "number"]).optional(),
  label: z.string().default(""),
  body: z.string().default(""),
  extra: z.string().default(""),
  icon: z.string().optional(),
  image: z.string().optional(),
  imagePos: imagePosSchema.optional(),
});

export const pageBlockSchema = z.object({
  type: z.enum(PAGE_BLOCK_TYPES),
  rail: z.string().optional(),
  heading: z.string().optional(),
  sub: z.string().optional(),
  lead: z.string().optional(),
  body: z.string().optional(),
  items: z.array(pageItemSchema).optional(),
  image: z.string().optional(),
  imagePos: imagePosSchema.optional(),
  tag: z.string().optional(),
  accent: z.coerce.number().int().min(-1).max(5).optional(),
  panel: z.boolean().optional(),
});

/** True when the block carries nothing worth printing. */
function isEmptyBlock(b: PageBlock): boolean {
  if (b.type === "divider") return false;
  if (b.image) return false;
  if (b.items?.some((i) => i.label || i.body || i.extra || i.image)) return false;
  return !(b.heading || b.body || b.lead || b.sub || b.rail);
}

/**
 * Structural sanity for a page, the twin of normalizeSlide's clamp loop:
 * drop blocks the catalog does not know, clamp their arrays, drop empties,
 * and cap the stack. Returns null when nothing usable is left, so the caller
 * discards the page exactly as it discards an unusable slide.
 */
export function normalizePage(stack: unknown): PageBlock[] | null {
  if (!Array.isArray(stack)) return null;
  const out: PageBlock[] = [];
  for (const raw of stack) {
    const parsed = pageBlockSchema.safeParse(raw);
    if (!parsed.success) continue;
    const block = parsed.data as PageBlock;
    const limits = PAGE_BLOCK_LIMITS[block.type];
    if (limits) {
      const [min, max] = limits;
      const items = block.items ?? [];
      if (items.length < min) continue;
      if (items.length > max) block.items = items.slice(0, max);
    } else {
      delete block.items;
    }
    if (isEmptyBlock(block)) continue;
    out.push(block);
    if (out.length === MAX_BLOCKS_PER_PAGE) break;
  }
  return out.length ? out : null;
}
