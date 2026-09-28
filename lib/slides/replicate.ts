import type { SourceSlide } from "./pptx-source";
import { DENSITY_LAYOUTS, type SlideContent } from "./schema";
import { MAX_SLIDES } from "./brief";

/**
 * The plan for replicating a deck (Mario, 28 Sep 2026): one step per slide
 * of the new deck, decided here and not by the model, so the length and the
 * order are the source's. The model writes the cover and each content slide
 * from its own source slide (mode "replicate", one call each); the agenda
 * and the dividers are built here from the source's structure, which
 * decides the chapters whatever the Chapters toggle says (Mario's call).
 *
 * Chapters come from the source's agenda slides: a deck that repeats its
 * agenda before each chapter, the chapter in progress in another colour
 * (the Gambia case, seven times), gets one agenda and a divider per chapter;
 * a source divider ("Schools: Cost-Benefit-Analysis", "Appendix II") is a
 * divider too. A chapter already opened is not opened twice (the appendix
 * repeats the agenda), and the source's closing slide in the middle of the
 * deck (before an appendix) moves to the end, where every deck closes.
 */

export type ReplicateStep =
  | { kind: "cover"; source: SourceSlide }
  | { kind: "content"; source: SourceSlide }
  | { kind: "fixed"; content: SlideContent };

export function planReplica(slides: SourceSlide[]): { steps: ReplicateStep[]; contentCount: number } {
  const steps: ReplicateStep[] = [];
  const opened = new Set<string>();
  const firstAgenda = slides.find((s) => s.kind === "agenda" && (s.chapters?.length ?? 0) >= 2);
  const chapters = firstAgenda?.chapters ?? [];
  let agendaPlaced = false;
  const divider = (title: string) => {
    const key = title.trim().toLowerCase();
    if (!key || opened.has(key)) return;
    opened.add(key);
    steps.push({ kind: "fixed", content: { layoutId: "section-divider", title: title.trim() } });
  };
  // A "divider" that opens nothing (the next slide that is not an agenda is
  // another divider, the closing slide or the end) is a short content slide
  // with a line of text ("Our ask: USD 2 million…", 28 Sep 2026: it was
  // dropped as an empty chapter).
  const opensNothing = (i: number) => {
    const next = slides.slice(i + 1).find((x) => x.kind !== "agenda");
    return !next || next.kind === "divider" || next.kind === "closing";
  };
  for (const [idx, s] of slides.entries()) {
    if (s.kind === "divider" && opensNothing(idx) && s.words > words(s.title)) {
      steps.push({ kind: "content", source: s });
      continue;
    }
    if (s.kind === "cover" && !steps.length) steps.push({ kind: "cover", source: s });
    else if (s.kind === "agenda") {
      if (!agendaPlaced && chapters.length >= 2) {
        steps.push({ kind: "fixed", content: { layoutId: "agenda", title: "Agenda", bullets: chapters.slice(0, 9) } });
        agendaPlaced = true;
      }
      const current = s.chapters?.[s.current ?? -1];
      if (current) divider(current);
    } else if (s.kind === "divider") divider(s.title);
    else if (s.kind === "content") steps.push({ kind: "content", source: s });
    // closing: the closing slide is added at the end (ENSURE_CLOSING)
  }
  // The deck's own ceiling: content first, the structure gives way (a
  // divider left with no content after it goes too).
  while (steps.length + 1 > MAX_SLIDES) {
    const i = steps.map((st) => st.kind).lastIndexOf("fixed");
    if (i < 0) steps.pop();
    else steps.splice(i, 1);
  }
  const cleaned = steps.filter(
    (st, i) => !(st.kind === "fixed" && st.content.layoutId === "section-divider" && (i === steps.length - 1 || (steps[i + 1].kind === "fixed" && steps[i + 1].kind === "fixed" && (steps[i + 1] as { content: SlideContent }).content.layoutId === "section-divider"))),
  );
  // The agenda lists the dividers that survived, one to one (the rule
  // syncAgenda enforces on every deck); with none left it goes.
  const bullets = agendaOf(cleaned);
  const final = cleaned
    .map((st) => (st.kind === "fixed" && st.content.layoutId === "agenda" ? { ...st, content: { ...st.content, bullets: bullets.slice(0, 9) } } : st))
    .filter((st) => !(st.kind === "fixed" && st.content.layoutId === "agenda" && bullets.length < 2));
  return { steps: final, contentCount: final.filter((st) => st.kind === "content").length };
}

/** Past this many words a source slide is rebuilt at high density. */
export const DENSE_WORDS = 70;
/** The line the model reads about a source slide's density. */
export function densityHint(source: SourceSlide): string {
  return source.words > DENSE_WORDS
    ? ` The source slide has ${source.words} words. Keep all of it: first try the layout's standard version within its word limits ("density" ""); set "density" to "high" only when the text does not fit them.`
    : "";
}

/**
 * What the standard version of each layout holds, from the catalog's word
 * limits (catalog.ts): words in one block's body, in one stat's label, in the
 * single `support`. A slide over these needs the high-density variant.
 */
const STANDARD_LIMITS: Partial<Record<string, { block?: number; stat?: number; support?: number }>> = {
  "four-cards": { block: 16 },
  "icon-cards": { block: 12 },
  steps: { block: 8 },
  "three-columns": { block: 20 },
  callout: { block: 16 },
  list: { block: 45 },
  "example-image-left": { block: 30 },
  "example-image-right": { block: 30 },
  "stat-grid": { stat: 5 },
  "brand-equity": { stat: 14, support: 35 },
  "two-stats": { stat: 15 },
  "single-stat": { support: 30 },
  "big-stat": { support: 35 },
  timeline: { block: 12 },
  "timeline-phases": { block: 7 },
  progress: { block: 12 },
};
const words = (t?: string) => (t ?? "").split(/\s+/).filter(Boolean).length;

/**
 * Whether a slide needs its high-density variant: its text runs past what
 * the standard version holds (a margin of a fifth over the catalog limit,
 * which the fit budgets absorb), its blocks carry points (`items`, which
 * the standard renderers do not draw), or a chart carries an explanation
 * (`bullets`), which only the dense chart shows.
 */
export function needsDensity(slide: SlideContent): boolean {
  if (!DENSITY_LAYOUTS.has(slide.layoutId)) return false;
  if (slide.blocks?.some((b) => b.items?.length)) return true;
  if (slide.bars && (slide.bullets?.some((b) => b.trim()) || slide.subtitle?.trim())) return true;
  const limit = STANDARD_LIMITS[slide.layoutId];
  if (!limit) return false;
  const over = (n: number, max?: number) => max !== undefined && n > Math.ceil(max * 1.2);
  if (slide.blocks?.some((b) => over(words(b.body), limit.block))) return true;
  if (slide.stats?.some((st) => over(words(st.label), limit.stat))) return true;
  if (over(words(slide.support) + words(slide.body), limit.support)) return true;
  return false;
}

/**
 * The density a replicated slide lands at (Mario, 28 Sep 2026: "replicate
 * does not mean high density; look at the content"): high when what it
 * carries does not fit the layout's standard version, standard when it does,
 * whatever the model set. Nothing is cut either way.
 */
export function withContentDensity(slide: SlideContent): SlideContent {
  if (!DENSITY_LAYOUTS.has(slide.layoutId)) return slide;
  const dense = needsDensity(slide);
  if (dense && !slide.density) return { ...slide, density: "high" };
  if (!dense && slide.density) {
    const { density: _d, ...rest } = slide;
    void _d;
    return rest;
  }
  return slide;
}

/** The agenda must list exactly the dividers that survived (syncAgenda would do it too). */
export function agendaOf(steps: ReplicateStep[]): string[] {
  return steps.flatMap((st) => (st.kind === "fixed" && st.content.layoutId === "section-divider" ? [st.content.title ?? ""] : []));
}
