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
  for (const s of slides) {
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
    ? ` The source slide is text-dense (${source.words} words): keep all of it, with "density" set to "high" on a layout that has the variant, or on a dense layout.`
    : "";
}

/**
 * A dense source slide lands at high density whatever the model set (Mario,
 * 28 Sep 2026: "dense content, dense layouts by default"): on a layout that
 * has the variant and came back without it, density goes to "high". The
 * five dense layouts are dense already.
 */
export function withSourceDensity(slide: SlideContent, source: SourceSlide): SlideContent {
  return source.words > DENSE_WORDS && DENSITY_LAYOUTS.has(slide.layoutId) && !slide.density ? { ...slide, density: "high" } : slide;
}

/** The agenda must list exactly the dividers that survived (syncAgenda would do it too). */
export function agendaOf(steps: ReplicateStep[]): string[] {
  return steps.flatMap((st) => (st.kind === "fixed" && st.content.layoutId === "section-divider" ? [st.content.title ?? ""] : []));
}
