import type { SlideContent } from "./schema";

/**
 * The brief's contract (the evaluation of 12 Oct 2026): what the brief
 * prescribes, read once by a small side call while the deck is written and
 * checked when the deck is complete. A prescribed slide or a last slide the
 * deck missed becomes one add request; entities are only reported. The
 * generating model never sees it.
 */
export interface BriefContract {
  /** Only the slides the brief prescribes (an outline, "a slide on X"); else []. */
  slides: { order: number; title: string; mustContain: string[] }[];
  /** What the deck must end on before the closing slide; else "". */
  lastContent: string;
  /** Organisations, places and figures the brief or its linked material names as central. */
  entities: string[];
}

const STOP = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with", "from", "this", "that", "our", "your", "its", "by", "at", "vs", "il", "la", "le", "di", "e", "per", "con", "del", "della", "el", "los", "las", "de", "y", "para"]);
/** Words that carry meaning, lower-cased, accents and punctuation off. */
export function tokens(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9?]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/** A crude stem, enough for a title to match its own wording ("versioned" and "versioning", "points" and "point"). */
function stem(w: string): string {
  return w.length > 5 ? w.replace(/(ing|ed|es|s)$/, "") : w.length > 3 ? w.replace(/s$/, "") : w;
}

/** Everything a slide shows, for matching. */
export function slideText(s: SlideContent): string {
  return JSON.stringify(s, (k, v) => (k === "image" || k === "id" || k === "layoutId" || k === "icons" || k === "photo" ? undefined : v));
}

/** Share of `want`'s words found in `have`. */
const overlap = (want: string[], have: Set<string>) => (want.length ? want.filter((w) => have.has(w)).length / want.length : 1);

/** Slides that never stand for a prescribed one; a section divider does, it carries a chapter's title. */
const STRUCTURAL = new Set(["cover", "agenda", "thank-you"]);

export interface ContractGap {
  /** A prescribed slide with no match, or the last slide the deck must end on. */
  missing: { title: string; after: number; last: boolean }[];
  /** Central entities nowhere in the deck: reported, never inserted. */
  entities: string[];
  /** Items satisfied over items checked (slides, last content, entities); 1 when nothing was prescribed. */
  share: number;
}

/**
 * The deck against the contract, once it is complete. A prescribed slide is
 * there when a slide's title holds most of its title's words, or the slide
 * carries every term it must; the last content is there when the slide
 * before the closing one holds half its words (or its "?" for questions).
 * `after` is where an add request should put a missing slide (1-based, the
 * slide it follows), so the editor's INSERT_SLIDES lands it in place.
 */
export function checkContract(deck: SlideContent[], contract: BriefContract, lastContent?: string): ContractGap {
  const end = deck.findIndex((s) => s.layoutId === "thank-you");
  const body = end < 0 ? deck.length : end;
  const texts = deck.map((s) => new Set(tokens(slideText(s))));
  const titles = deck.map((s) => new Set(tokens(s.title ?? "")));
  const missing: ContractGap["missing"] = [];
  let checked = 0;
  let met = 0;
  const found = new Map<number, number>();
  const seen = new Set<string>();
  for (const p of contract.slides) {
    const want = tokens(p.title);
    if (!want.length || seen.has(want.join(" "))) continue;
    seen.add(want.join(" "));
    checked++;
    const terms = p.mustContain.flatMap(tokens);
    const at = deck.findIndex((s, i) => !STRUCTURAL.has(s.layoutId) && (overlap(want, titles[i]) >= 0.5 || (terms.length > 0 && overlap(terms, texts[i]) === 1)));
    if (at >= 0) {
      met++;
      if (p.order) found.set(p.order, at);
      continue;
    }
    // After the slide of the previous order when the deck has it, else at its own place, never past the closing slide.
    const prev = p.order ? found.get(p.order - 1) : undefined;
    const after = Math.min(prev !== undefined ? prev + 1 : p.order ? p.order - 1 : body, body);
    missing.push({ title: p.title, after, last: false });
  }
  const last = (lastContent || contract.lastContent).trim();
  if (last) {
    checked++;
    const slide = deck[body - 1];
    const have = slide && !STRUCTURAL.has(slide.layoutId) ? new Set(tokens(slideText(slide))) : new Set<string>();
    const want = tokens(last).filter((w) => w !== "?");
    const ok = /\?/.test(last) || /\bquestions?\b|domande|preguntas/i.test(last) ? !!slide && /\?/.test(slideText(slide)) : overlap(want, have) >= 0.5;
    // A prescribed slide already queued as the last one stands for it.
    const queued = missing.some((m) => m.after >= body - 1 && overlap(want, new Set(tokens(m.title))) >= 0.5);
    if (ok) met++;
    else if (!queued) missing.push({ title: last, after: body, last: true });
  }
  const all = new Set(texts.flatMap((t) => [...t]));
  const entities = contract.entities.filter((e) => {
    const want = tokens(e);
    return want.length > 0 && overlap(want, all) < 1;
  });
  checked += contract.entities.length;
  met += contract.entities.length - entities.length;
  return { missing, entities, share: checked ? met / checked : 1 };
}
