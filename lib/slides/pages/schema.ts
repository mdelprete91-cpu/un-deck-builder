import { z } from "zod";
import type { ImagePos } from "../schema";
import { isCountryMap } from "../country-maps";
import { libraryPhoto } from "../library";

/**
 * Two-pager pages: the block vocabulary (rebuilt 6 Oct 2026).
 *
 * The canon is the two A4 pieces made for Estonia (figma-to-pptx-source/
 * estonia/build.py and investment.py) plus the photo cards and the asks
 * panels of the Digital Inclusion template. A page is a vertical stack of
 * these blocks in reading order; the browser lays them out and the editor
 * measures whether the stack fits the sheet (fit.ts).
 */
export const PAGE_BLOCK_TYPES = [
  "banner",
  "title",
  "section",
  "stats",
  "figure",
  "pillars",
  "compare",
  "asks",
  "photos",
  "panels",
  "contacts",
  // From the Spectrum, Lunar and Songbird pieces (Mario, 7 Oct 2026).
  "lede",
  "callout",
  "split",
  "screens",
  "numbered",
  "table",
  // A smaller title inside a page, opening a new part (Mario, 7 Oct 2026).
  "heading",
] as const;
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

/** Blocks the AI may pick: all of them, steered by page-catalog.ts. */
export const AI_BLOCK_TYPES = PAGE_BLOCK_TYPES;

/**
 * One line inside a block's repeating array. Flat and shared by every block
 * type, like SlideContent: a discriminated union becomes a JSON-Schema
 * `oneOf`, which the structured-output grammar rejects as too complex.
 * What each field means per block is written down in page-catalog.ts.
 */
export interface PageItem {
  /** section: a paragraph, a bullet or a numbered point. Ignored elsewhere. */
  kind?: "para" | "bullet" | "number";
  /** bold lead-in · stat value · column head · row label · contact name */
  label: string;
  /** the text itself · stat caption · first table cell · contact role */
  body: string;
  /** second table cell · contact email */
  extra: string;
  /** compare: the row group ("Namibia"). A header is drawn where it changes. */
  group?: string;
  /** pillars: lucide slug. */
  icon?: string;
  /** photos: the card's photo. */
  image?: string;
  imagePos?: ImagePos;
}

export interface PageBlock {
  type: PageBlockType;
  /** The left-column label of a section, photos or contacts block. */
  rail?: string;
  /** banner / title text; the full-width head of compare and asks. */
  heading?: string;
  /** title: the phrase inside the heading set in the accent colour. */
  highlight?: string;
  /** compare: the first column's head ("2023-2024"). */
  sub?: string;
  /** compare: the second column's head ("Today"). */
  lead?: string;
  /** figure: the caption under the image. */
  body?: string;
  items?: PageItem[];
  /** banner / figure: the image slot. */
  image?: string;
  imagePos?: ImagePos;
  /** figure: a country slug, drawn as that country's map instead of a photo. */
  map?: string;
  /** stats: the highlighted card. panels: the column drawn as the ask. -1 = none. */
  accent?: number;
  /** split: the pill above the text ("Phase 1"). */
  tag?: string;
}

/**
 * [min, max] items per block; null = the block has no item array.
 * Structural safety only: the counts the AI aims for live in page-catalog.ts.
 */
export const PAGE_BLOCK_LIMITS: Record<PageBlockType, [number, number] | null> = {
  banner: null,
  title: null,
  figure: null,
  section: [1, 8],
  stats: [2, 6],
  pillars: [2, 3],
  compare: [1, 12],
  asks: [1, 5],
  photos: [2, 4],
  panels: [2, 2],
  contacts: [1, 4],
  lede: null,
  heading: null,
  callout: null,
  split: null,
  screens: [2, 2],
  numbered: [1, 6],
  table: [1, 8],
};

/** A page that needs more than this is two pages. */
export const MAX_BLOCKS_PER_PAGE = 10;

/**
 * How tightly a page is set. The fit pass (fit.ts) steps down from regular
 * until the stack fits: compact is investment.py's density, tight one notch
 * under it. Stored on the page so the editor and every export draw the same.
 */
export const PAGE_FITS = ["regular", "compact", "tight"] as const;
export type PageFit = (typeof PAGE_FITS)[number];

const imagePosSchema = z.object({
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  zoom: z.coerce.number().min(1).max(4),
});

/**
 * Every string defaults to "": `setPath` is a silent no-op on a missing node,
 * so a field the editor can write to has to exist even when the model left it
 * out.
 */
export const pageItemSchema = z.object({
  kind: z.enum(["para", "bullet", "number"]).catch("para").optional(),
  label: z.string().default(""),
  body: z.string().default(""),
  extra: z.string().default(""),
  group: z.string().optional(),
  icon: z.string().optional(),
  image: z.string().optional(),
  imagePos: imagePosSchema.optional(),
});

export const pageBlockSchema = z.object({
  type: z.enum(PAGE_BLOCK_TYPES),
  rail: z.string().optional(),
  heading: z.string().optional(),
  highlight: z.string().optional(),
  sub: z.string().optional(),
  lead: z.string().optional(),
  body: z.string().optional(),
  items: z.array(pageItemSchema).optional(),
  image: z.string().optional(),
  imagePos: imagePosSchema.optional(),
  map: z.string().optional(),
  accent: z.coerce.number().int().min(-1).max(5).optional(),
  tag: z.string().optional(),
});

/** The text fields each block draws, so the editor always has them to write to. */
const BLOCK_FIELDS: Record<PageBlockType, (keyof PageBlock)[]> = {
  banner: ["heading"],
  title: ["heading", "highlight"],
  section: ["rail"],
  stats: [],
  figure: ["body"],
  pillars: [],
  compare: ["heading", "sub", "lead"],
  asks: ["heading"],
  photos: ["rail"],
  panels: [],
  contacts: ["rail", "lead"],
  lede: ["body"],
  heading: ["heading"],
  callout: ["lead", "body"],
  split: ["tag", "body"],
  screens: ["rail"],
  numbered: ["rail"],
  table: ["rail", "heading", "sub", "lead"],
};

/**
 * No em or en dashes on a page (Mario's rule for everything written): a range
 * keeps a hyphen ("US$110-120"), a dash between clauses becomes a comma.
 */
export function undash(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",");
}

/** Every country name the runtime knows, and the regions a two-pager names. */
const PLACES: string[] = (() => {
  const out = ["Africa", "Asia", "Europe", "America", "Latin", "Caribbean", "Pacific", "Sahel", "Sub-Saharan", "Central", "Southern", "Eastern", "Western", "Northern"];
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const A = 65;
    for (let i = 0; i < 26; i++)
      for (let j = 0; j < 26; j++) {
        const code = String.fromCharCode(A + i, A + j);
        const name = names.of(code);
        if (name && name !== code) out.push(name);
      }
  } catch {
    // No region names in this runtime: acronyms and products still keep their case.
  }
  return out;
})();

/**
 * Names that keep their capitals when an all-caps heading is set in sentence
 * case: acronyms as acronyms, products and organisations as they are written.
 * Not the ones that are also words ("WHO" / who, "US" / us, "DID", Italian
 * "UN"): a heading reads better with an acronym in lower case than with a
 * pronoun in capitals.
 */
const KEEP_CASE: { re: RegExp; as: string }[] = ["UNICEF", "ITU", "UNDP", "EU", "AI", "ICT", "ISPs", "ISP", "KPIs", "KPI", "SDGs", "SDG", "NGOs", "NGO", "GDP", "USA", "UK", "GSMA", "NOFBI", "UBC", "LTAs", "LTA", "Giga Maps", "Giga Meter", "Giga"]
  .concat(PLACES)
  // Longest first, so "South Africa" wins over "Africa".
  .sort((x, y) => y.length - x.length)
  .map((name) => ({ re: new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu"), as: name }));

/**
 * Headings in sentence case (Mario, 6 Oct 2026): a heading written all in
 * capitals ("WHAT WE DO FOR CONNECTIVITY", copied from a replicated draft)
 * becomes "What we do for connectivity", known names keeping their capitals.
 * A heading with any lower-case letter is the writer's and stays as it is.
 */
export function sentenceCase(text: string): string {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3 || letters !== letters.toUpperCase()) return text;
  let lower = text.toLowerCase();
  for (const { re, as } of KEEP_CASE) lower = lower.replace(re, as);
  return lower.replace(/\p{L}/u, (c) => c.toUpperCase());
}

function undashBlock(b: PageBlock): void {
  const rec = b as unknown as Record<string, unknown>;
  for (const k of ["rail", "heading", "highlight", "sub", "lead", "body"]) if (typeof rec[k] === "string") rec[k] = undash(rec[k] as string);
  b.items?.forEach((it) => {
    it.label = undash(it.label);
    it.body = undash(it.body);
    it.extra = undash(it.extra);
    if (it.group) it.group = undash(it.group);
  });
}

/** True when the block carries nothing worth printing. */
function isEmptyBlock(b: PageBlock): boolean {
  if (b.image || b.map || b.type === "figure" || b.type === "screens" || b.type === "split") return false;
  if (b.items?.some((i) => i.label || i.body || i.extra || i.image)) return false;
  return !(b.heading || b.body || b.rail || b.sub || b.lead);
}

/**
 * Structural sanity for a page, the twin of normalizeSlide's clamp loop: drop
 * blocks the catalog does not know (a page saved before the rebuild opens with
 * only what still exists), clamp the arrays, drop empties, cap the stack.
 * Returns null when nothing usable is left, so the caller discards the page.
 */
export function normalizePage(stack: unknown): PageBlock[] | null {
  if (!Array.isArray(stack)) return null;
  const out: PageBlock[] = [];
  for (const raw of stack) {
    const parsed = pageBlockSchema.safeParse(raw);
    if (!parsed.success) continue;
    const block = parsed.data as PageBlock;
    // The model names library photos by id ("photo"); the page stores the path.
    const r = raw as { photo?: unknown; items?: { photo?: unknown }[] };
    block.image ??= libraryPhoto(r.photo);
    block.items?.forEach((it, i) => {
      it.image ??= libraryPhoto(r.items?.[i]?.photo);
      if (!it.image) delete it.image;
    });
    if (!block.image) delete block.image;
    const limits = PAGE_BLOCK_LIMITS[block.type];
    if (limits) {
      const [min, max] = limits;
      const items = (block.items ?? []).filter((i) => i.label || i.body || i.extra || i.image);
      if (items.length < min) continue;
      block.items = items.slice(0, max);
    } else {
      delete block.items;
    }
    // The model names a country ("Kenya", "Côte d'Ivoire"); the page draws a
    // map only for a country we ship one for.
    if (block.map !== undefined) {
      const slug = block.map
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (isCountryMap(slug)) block.map = slug;
      else delete block.map;
    }
    if (isEmptyBlock(block)) continue;
    // Stat cards are figures. "1", "2", "3" in a row is a numbered list
    // pretending to be data (a brief with no numbers, 6 Oct 2026): dropped.
    if (block.type === "stats") {
      // "54 Countries engaged" written whole in the caption: the figure is the label.
      for (const it of block.items ?? []) {
        // Figure and caption the wrong way round ("Countries engaged" / "54").
        if (!/\d/.test(it.label) && /\d/.test(it.body) && it.body.trim().length <= 8) {
          [it.label, it.body] = [it.body.trim(), it.label.trim()];
          continue;
        }
        // A caption that is only the figure: the figure is the label.
        if (!/\d/.test(it.label) && /^[~<>≈]?[$€£]?\d[\d.,]*\s?(?:%|[kKMB]\+?|\+|x)?(?:\s?[-–]\s?\d[\d.,]*%?)?$/.test(it.body.trim())) {
          it.label = it.body.trim();
          it.body = "";
          continue;
        }
        const m = /^\s*([~<>≈]?[$€£]?\d[\d.,]*\s?(?:%|[kKMB]\+?|\+|x)?(?:\s?[-–]\s?\d[\d.,]*%?)?)\s+(.+)$/.exec(it.body);
        if (!/\d/.test(it.label) && m) {
          it.label = m[1].trim();
          it.body = m[2].trim();
        }
      }
      const labels = (block.items ?? []).map((i) => i.label.trim());
      const counting = labels.every((l, i) => l === String(i + 1) || l === String(i + 1).padStart(2, "0"));
      if (counting || !labels.some((l) => /\d/.test(l))) continue;
    }
    undashBlock(block);
    for (const k of ["rail", "heading", "sub", "lead"] as const) if (block[k]) block[k] = sentenceCase(block[k]!);
    if (block.type !== "stats" && block.type !== "compare") block.items?.forEach((it) => (it.label = sentenceCase(it.label)));
    for (const f of BLOCK_FIELDS[block.type]) (block as unknown as Record<string, unknown>)[f] ??= "";
    if (block.type === "stats" || block.type === "panels") block.accent ??= -1;
    out.push(block);
    if (out.length === MAX_BLOCKS_PER_PAGE) break;
  }
  return out.length ? out : null;
}
