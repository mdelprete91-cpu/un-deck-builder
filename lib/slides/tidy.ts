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

/**
 * A footnote about the brief instead of the material ("The brief does not
 * specify…", on most slides of a technical deck, the evaluation of 12 Oct
 * 2026). Generated slides only, never a replica, whose notes are the
 * source's own: the caller takes the dropped note for the sidebar's "Gaps in
 * the brief".
 */
export const META_NOTE = /\b(the brief|the material|not specified|does not (specify|give|provide|define|prescribe))\b/i;
export function dropMetaNotes<T extends SlideContent>(slide: T): { slide: T; dropped?: string } {
  const clean = stripMetaText(slide);
  if (!clean.notes || !META_NOTE.test(clean.notes)) return { slide: clean };
  const { notes, ...rest } = clean;
  return { slide: rest as T, dropped: notes };
}

/**
 * The same talk about the brief in the slide's own text (Mario, 13 Oct 2026:
 * a skipped question came back as "The brief does not specify what worked."
 * on the slide; 71 such texts in the QA decks of September and October,
 * "Funding gap amount not provided in the brief", "The brief identifies no
 * specific risks"). The sentence goes, the rest of the text stays; a list
 * item or a block left with nothing goes too. Titles are left alone.
 */
const META_TEXT = [
  /\b(?:the|this|your) brief\b/i,
  /\b(?:does not|doesn't|did not|do not) (?:specify|give|provide|define|prescribe|establish|say|mention|state|include)\b/i,
  /\bnot (?:specified|provided|given|stated|established|quantified)\b(?:\s+(?:in|by)\s+(?:the\s+)?[\w ]{0,24})?\s*[.;:]?\s*$/i,
  // A placeholder in place of content: "[To be defined]", "TBD".
  /^\s*\[?\s*(?:to be (?:defined|confirmed|determined|added)|tbd|tbc)\s*\]?\s*\.?\s*$/i,
  /\b(?:gives?|provides?|offers?) no (?:figures?|amounts?|details?|evidence|data|counts?|numbers?|results?|specifics?)\b/i,
];
const isMeta = (sentence: string) => META_TEXT.some((re) => re.test(sentence));
function cleanText(text: string | undefined): string | undefined {
  if (!text || !META_TEXT.some((re) => re.test(text))) return text;
  return text
    .split(/(?<=[.!?;])\s+/)
    .filter((x) => !isMeta(x))
    .join(" ")
    .trim();
}
export function stripMetaText<T extends SlideContent>(slide: T): T {
  const out: T = { ...slide };
  for (const k of ["subtitle", "body", "support", "takeaway"] as const) {
    if (typeof out[k] === "string") (out as Record<string, unknown>)[k] = cleanText(out[k] as string);
  }
  if (out.bullets) out.bullets = out.bullets.map((b) => cleanText(b) ?? "").filter((b) => b.trim());
  if (out.stats) out.stats = out.stats.filter((x) => !isMeta(x.value)).map((x) => ({ ...x, label: cleanText(x.label) ?? x.label }));
  if (out.blocks) {
    out.blocks = out.blocks
      .map((b) => {
        const had = !!(b.body?.trim() || b.items?.length || b.stats?.length);
        const c = {
          ...b,
          body: cleanText(b.body) ?? b.body,
          ...(b.items ? { items: b.items.map((x) => cleanText(x) ?? "").filter((x) => x.trim()) } : {}),
          ...(b.stats ? { stats: b.stats.filter((x) => !isMeta(x.value)).map((x) => ({ ...x, label: cleanText(x.label) ?? x.label })) } : {}),
        };
        return { c, had };
      })
      // A block emptied by the cleaning goes with its label: "Costs" over nothing reads as a hole.
      .filter(({ c, had }) => c.body?.trim() || c.items?.length || c.stats?.length || (!had && c.label?.trim() && !isMeta(c.label)))
      .map(({ c }) => c);
  }
  return out;
}
