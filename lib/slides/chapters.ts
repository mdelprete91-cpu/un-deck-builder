import type { SlideContent } from "./schema";

/**
 * The chapters safety net (Mario, 5 Oct 2026). With Chapters on, the model
 * left them out of 15 decks in 18 on the QA set: eight, ten and twelve slides
 * never had them, and some decks had dividers but no agenda. The prompt now
 * demands them (HAS_CHAPTERS in prompt.ts); this makes the deck right when the
 * model still does not:
 *
 * - dividers but no agenda: the agenda goes in after the cover, listing them
 *   (`ensureAgenda`, no model call);
 * - no dividers: `app/api/chapters` groups the slide titles into two to four
 *   chapters, and `applyChapterPlan` puts a divider before the first slide of
 *   each, then the agenda. Slides are matched by title, not position, so the
 *   plan still lands after the deck was merged or reordered.
 *
 * Used by the editor (deckReducer, ENSURE_AGENDA / APPLY_CHAPTERS) and by
 * tools/qa-suite.ts, so the suite measures what the user sees.
 */

/** A deck shorter than this has no room for chapters to mean anything. */
const MIN_CONTENT_FOR_CHAPTERS = 4;
const STRUCTURAL = new Set(["cover", "agenda", "section-divider", "thank-you"]);

export type ChapterPlan = { title: string; start: string }[];

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/** The content slides' titles, in order: what the chapters call groups. */
export function chapterCandidates<T extends SlideContent>(slides: T[]): string[] {
  return slides.filter((s) => !STRUCTURAL.has(s.layoutId)).map((s) => (s.title ?? "").trim());
}

/** True when the deck has no dividers and enough content to group. */
export function needsChapterPlan<T extends SlideContent>(slides: T[]): boolean {
  if (slides.some((s) => s.layoutId === "section-divider")) return false;
  return chapterCandidates(slides).filter(Boolean).length >= MIN_CONTENT_FOR_CHAPTERS;
}

/** Dividers but no agenda: the agenda after the cover, its bullets the dividers' titles. */
export function ensureAgenda<T extends SlideContent>(slides: T[], make: (s: SlideContent) => T | null): T[] {
  const dividers = slides.filter((s) => s.layoutId === "section-divider");
  if (dividers.length < 2 || slides.some((s) => s.layoutId === "agenda")) return slides;
  const agenda = make({ layoutId: "agenda", title: "Agenda", bullets: dividers.map((d) => (d.title ?? "").trim()).slice(0, 9) });
  if (!agenda) return slides;
  const at = slides[0]?.layoutId === "cover" ? 1 : 0;
  return [...slides.slice(0, at), agenda, ...slides.slice(at)];
}

/**
 * A divider before the first slide of each chapter, then the agenda. A
 * chapter whose start matches no slide is skipped; fewer than two that land
 * leave the deck as it was (one chapter is no structure).
 */
export function applyChapterPlan<T extends SlideContent>(slides: T[], plan: ChapterPlan, make: (s: SlideContent) => T | null): T[] {
  if (slides.some((s) => s.layoutId === "section-divider")) return ensureAgenda(slides, make);
  const starts = new Map<number, string>();
  for (const c of plan) {
    const i = slides.findIndex((s, k) => !STRUCTURAL.has(s.layoutId) && norm(s.title) === norm(c.start) && !starts.has(k));
    if (i >= 0 && c.title.trim()) starts.set(i, c.title.trim());
  }
  if (starts.size < 2) return slides;
  const out: T[] = [];
  slides.forEach((s, i) => {
    const title = starts.get(i);
    if (title) {
      const divider = make({ layoutId: "section-divider", title });
      if (divider) out.push(divider);
    }
    out.push(s);
  });
  return ensureAgenda(out, make);
}

export const CHAPTERS_INSTRUCTIONS = `You group the slides of a finished deck into chapters for its agenda.
You get the deck brief and the titles of its content slides, numbered in order.
Return 2 to 4 chapters that follow the deck's order: each chapter is a run of consecutive slides, every slide belongs to exactly one chapter, and the first chapter starts at slide 1.
Each chapter has a "title" of at most 5 words naming what its slides are about, in the language of the brief, sentence case, no numbering, never a slide's title copied whole, and "start": the number of its first slide.`;

export const CHAPTERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["chapters"],
  properties: {
    chapters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "start"],
        properties: { title: { type: "string" }, start: { type: "integer" } },
      },
    },
  },
} as const;

/** The model's answer (1-based slide numbers) as a plan keyed by title; invalid entries dropped. */
export function planFromAnswer(titles: string[], raw: unknown): ChapterPlan {
  const list = (raw as { chapters?: unknown })?.chapters;
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => c as { title?: unknown; start?: unknown })
    .filter((c) => typeof c.title === "string" && Number.isInteger(c.start) && (c.start as number) >= 1 && (c.start as number) <= titles.length)
    .map((c) => ({ title: (c.title as string).trim().slice(0, 60), start: titles[(c.start as number) - 1] }))
    .slice(0, 4);
}
