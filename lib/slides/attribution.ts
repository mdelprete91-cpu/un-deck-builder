import { figuresIn, spelledToDigits, type Source } from "./provenance";
import { meaningful, parseFigure } from "./repeats";

/**
 * Where each text of a slide comes from (Mario, 13 Oct 2026: right-click a
 * text, "Where does this come from?"). Worked out on the server, where the
 * request's sources are (brief, answers, files, linked pages, the knowledge
 * base, Giga's facts): for every text the editor can edit, the closest
 * passage among them, with its source, date and how close it is. The model
 * writes in its own words, so "close" is honest wording, not a promise.
 */
export interface TextSource {
  /** "giga.global", "the brief", "report.pdf": what the menu and a footnote call it. */
  label: string;
  url?: string;
  /** YYYY-MM-DD. */
  date?: string;
  /** The source's own sentence, at most 240 characters. */
  quote: string;
  /** high: most of the words are the source's; partial: some are; none: nothing close. */
  match: "high" | "partial" | "none";
  /** The user changed the text after it was generated. */
  edited?: boolean;
  /**
   * A person checked it (Mario, 13 Oct 2026: UNICEF must not say anything
   * wrong, so the editors certify the figures): when, and the source they
   * gave, if any. Editing the text drops it.
   */
  verified?: { at: string; source?: string };
}

/** The text at a data-edit path ("blocks.2.body") of a slide or a page, or "". */
export function textAt(slide: object, path: string): string {
  let node: unknown = slide;
  for (const k of path.split(".")) {
    if (node == null || typeof node !== "object") return "";
    node = Array.isArray(node) ? node[Number(k)] : (node as Record<string, unknown>)[k];
  }
  return typeof node === "string" ? node : "";
}

/** A placeholder left for the user: "[Total budget 2027]". */
export const PLACEHOLDER = /\[[^\[\]\n]{1,80}\]/g;

/** Fields that are ids, paths, colours or settings, never text a reader sees. */
const NOT_TEXT = new Set(["id", "layoutId", "image", "map", "photo", "color", "icon", "icons", "kind", "type", "density", "imagePos", "logoTone", "sources", "accent", "current", "tone", "channels", "contacts", "bars", "series", "footerLabel", "pageDate", "pageFit"]);

/** Every text of a slide or a page with the path the editor's data-edit gives it ("blocks.2.body", "stack.1.items.0.body"). */
export function textPaths(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return prefix && node.trim() ? [[prefix, node]] : [];
  if (Array.isArray(node)) return node.flatMap((v, i) => textPaths(v, prefix ? `${prefix}.${i}` : String(i)));
  if (node && typeof node === "object")
    return Object.entries(node).flatMap(([k, v]) => (NOT_TEXT.has(k) ? [] : textPaths(v, prefix ? `${prefix}.${k}` : k)));
  return [];
}

interface Sentence {
  source: Source;
  text: string;
  words: Set<string>;
  figures: Set<string>;
}

function sentencesOf(sources: Source[]): Sentence[] {
  const out: Sentence[] = [];
  for (const source of sources) {
    // Headers of the knowledge base's pages ("# title (Source, url, read date)") are not the source's words.
    const body = source.text.replace(/^# .*$/gm, " ");
    for (const raw of body.split(/(?<=[.!?])\s+|\n+/)) {
      const text = raw.trim();
      if (text.length < 12) continue;
      const words = new Set(meaningful(text));
      if (!words.size) continue;
      const figures = new Set(figuresIn(spelledToDigits(text)).map(parseFigure).filter((f): f is string => !!f));
      out.push({ source, text, words, figures });
    }
  }
  return out;
}

/** The closest source sentence for one text, or none. */
function closest(text: string, sentences: Sentence[]): { s: Sentence; score: number } | null {
  const words = meaningful(text);
  const figures = figuresIn(text).map(parseFigure).filter((f): f is string => !!f);
  if (words.length < 2 && !figures.length) return null;
  let best: { s: Sentence; score: number } | null = null;
  for (const s of sentences) {
    const shared = words.filter((w) => s.words.has(w)).length / Math.max(1, words.length);
    // A figure the sentence holds is the strongest sign it is the source.
    const fig = figures.length ? figures.filter((f) => s.figures.has(f)).length / figures.length : 0;
    const score = figures.length ? 0.5 * shared + 0.5 * fig : shared;
    // The user's own words win a tie: they know them.
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && s.source.own && !best.s.source.own)) best = { s, score };
  }
  return best;
}

/**
 * The source of every text of a slide. `unreadable` names an attached file
 * the server cannot read (a PDF, an image): a text matching nothing else is
 * said to come from there, possibly.
 */
export function attribute(slide: object, sources: Source[], opts: { unreadable?: string } = {}): Record<string, TextSource> {
  const sentences = sentencesOf(sources.filter((s) => s.text.trim()));
  const out: Record<string, TextSource> = {};
  for (const [path, text] of textPaths(slide)) {
    const hit = closest(text, sentences);
    const match = !hit || hit.score < 0.3 ? "none" : hit.score >= 0.6 ? "high" : "partial";
    if (match === "none") {
      out[path] = opts.unreadable
        ? { label: opts.unreadable, quote: "", match: "none" }
        : { label: "", quote: "", match: "none" };
      continue;
    }
    const s = hit!.s;
    out[path] = {
      label: s.source.label,
      ...(s.source.url ? { url: s.source.url } : {}),
      ...(s.source.date ? { date: s.source.date } : {}),
      quote: s.text.length > 240 ? `${s.text.slice(0, 237).trimEnd()}…` : s.text,
      match,
    };
  }
  return out;
}

/** "giga.global, October 2026, https://giga.global/": a footnote's words for a source. */
export function citation(src: TextSource): string {
  const when = src.date ? new Date(`${src.date}T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  return [src.label, when, src.url].filter(Boolean).join(", ");
}
