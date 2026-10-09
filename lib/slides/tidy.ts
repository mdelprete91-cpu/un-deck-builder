import type { SlideContent } from "./schema";

/**
 * Text fixes for the model's output only, after normalize and rhythm (the
 * rhythm can move a slide onto a numbered layout). A deck file or a user's
 * edit never passes through here: what the user typed stays as typed.
 * Found by the 20-generation QA of 9 Oct 2026.
 */

/** Layouts that print each item's number themselves (cards.ts, density.ts, stats.ts, progress.ts). */
const NUMBERED_BLOCKS = new Set(["steps", "three-columns", "timeline-phases", "progress"]);
/** The agenda prints "01 |" before each bullet (basic.ts). */
const NUMBERED_BULLETS = new Set(["agenda"]);

const WORD = "(?:step|phase|stage|part|fase|passo|parte|paso|etapa|étape|phase)";
/** "1", "01.", "Step 2", "Fase 3:", "IV)" and nothing else. */
const NUMBER_ONLY = new RegExp(`^\\s*(?:${WORD}\\s*)?(?:\\d{1,2}|[ivx]{1,4})\\s*[.):|]?\\s*$`, "i");
/** "1. Map", "Step 2: Verify", "03 | Connect": the number before a real label. */
const NUMBER_PREFIX = new RegExp(`^\\s*(?:${WORD}\\s*)?\\d{1,2}\\s*[.):|\\-–—]\\s+(?=\\S)|^\\s*${WORD}\\s*\\d{1,2}\\s+(?=\\S)`, "i");

/**
 * The layout already numbers its items, so a label that is only a number
 * prints it twice ("1" over "1", Mario's report of 9 Oct 2026). A short body
 * was the item's real title and becomes the label; otherwise the label goes.
 */
function unnumber(label: string, body: string): { label: string; body: string } {
  if (NUMBER_ONLY.test(label)) {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return words > 0 && words <= 6 && !/[.!?]$/.test(body.trim()) ? { label: body.trim(), body: "" } : { label: "", body };
  }
  return { label: label.replace(NUMBER_PREFIX, ""), body };
}

/**
 * No em or en dashes (the brand voice; the prompt says so and the model
 * still writes "Q4 2025—an increase", 9 Oct 2026). A range keeps a hyphen,
 * an aside becomes a comma.
 */
export function undash(text: string): string {
  if (!/[–—]/.test(text)) return text;
  return text
    .replace(/(\d)\s*[–—]\s*(?=\d)/g, "$1-")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/^,\s*/, "")
    .replace(/,\s*([.,;:!?])/g, "$1")
    .replace(/,\s*$/, "");
}

/** Fields that carry ids, paths or colours, never prose. */
const NOT_TEXT = new Set(["id", "layoutId", "image", "map", "photo", "color", "icon", "icons", "type", "kind", "href", "imagePos"]);

function undashAll<T>(v: T): T {
  if (typeof v === "string") return undash(v) as T;
  if (Array.isArray(v)) return v.map(undashAll) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = NOT_TEXT.has(k) ? x : undashAll(x);
    return out as T;
  }
  return v;
}

type PageItem = { kind?: string; label?: string; body?: string };
type PageBlock = { type: string; items?: PageItem[] };

function tidyStack(stack: PageBlock[]): PageBlock[] {
  return stack.map((b) => {
    if (!b.items?.length) return b;
    let items = b.items;
    // The numbered block draws its own 1, 2, 3 (pages/blocks.ts).
    if (b.type === "numbered") items = items.map((it) => ({ ...it, ...unnumber(it.label ?? "", it.body ?? "") }));
    // Photo cards that all say the same thing ("Connectivity Credits pilot"
    // under four countries, 9 Oct 2026): the caption carries nothing, the
    // label is the card.
    if (b.type === "photos" && items.length > 1) {
      const bodies = items.map((it) => (it.body ?? "").trim().toLowerCase());
      if (bodies[0] && bodies.every((x) => x === bodies[0])) items = items.map((it) => ({ ...it, body: "" }));
    }
    return { ...b, items };
  });
}

export function tidyModelSlide<T extends SlideContent>(content: T): T {
  const slide = undashAll(content);
  if (slide.layoutId === "a4-page") {
    const s = slide as T & { stack?: PageBlock[] };
    if (s.stack) s.stack = tidyStack(s.stack) as typeof s.stack;
    return slide;
  }
  if (NUMBERED_BLOCKS.has(slide.layoutId) && slide.blocks) {
    slide.blocks = slide.blocks.map((b) => ({ ...b, ...unnumber(b.label ?? "", b.body ?? "") }));
  }
  if (NUMBERED_BULLETS.has(slide.layoutId) && slide.bullets) {
    slide.bullets = slide.bullets.map((x) => (NUMBER_ONLY.test(x) ? x : x.replace(NUMBER_PREFIX, "")));
  }
  return slide;
}
