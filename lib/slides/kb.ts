import KB from "@/kb/index.json";
import SOURCES_FILE from "@/kb/sources.json";
import type { Attachment } from "./attachments";
import { meaningful } from "./repeats";

/**
 * The knowledge base as a reserve (Mario, 13 Oct 2026): the pages of
 * giga.global, Giga Maps, Giga Meter, Connectivity Credits, Spectrum
 * Certificates and the UNICEF Digital Impact site, read weekly by
 * tools/kb-update.ts. They reach a deck only "in case": when the brief gives
 * little material (materialScore under SCARCE_MATERIAL) and pages are about
 * its subject, or, beside the user's own files, when they are very close to
 * it. They travel as background, below the brief, the answers and the files,
 * which are fresher because a person put them there.
 */
interface KbPage {
  url: string;
  title: string;
  text: string;
  read: string;
}
interface KbSource {
  id: string;
  name: string;
  aliases: string[];
  pages: KbPage[];
}

/** Characters of background handed to the model, the most relevant pages first, across sources. */
const BUDGET = 8_000;
/** Pages that say how to install, apply, contact or browse: never background for a deck. */
const NOT_CONTENT = /self-hosting|installation|privacy|cookie|jobs|contact|category\/|\/page\/\d|newsroom|media-kit|multimedia|faq|podcast|bits-and-bytes|hall-fame|featured-videos/i;
/** At most this many pages chosen by relevance after a named source's core pages. */
const MAX_RANKED = 3;
/** A page enters a scarce brief's deck at this BM25 score; beside attached files only at the higher one. */
export const KB_THRESHOLD = 6.5;
export const KB_THRESHOLD_WITH_FILES = 12;

/** Words of the request itself, not of its subject. */
const NOISE = new Set(
  "presentation presentations deck decks slide slides make create build short simple visual team meeting brief need want please using use show explain key message presentazione presentazioni fammi crea creami diapositive presentación diapositivas".split(" "),
);

const SOURCES = (KB as { sources: KbSource[] }).sources;
interface Doc {
  source: KbSource;
  page: KbPage;
  tf: Map<string, number>;
  len: number;
}
let INDEX: { docs: Doc[]; df: Map<string, number>; avg: number } | null = null;
function index() {
  if (INDEX) return INDEX;
  const docs: Doc[] = [];
  const df = new Map<string, number>();
  for (const source of SOURCES)
    for (const page of source.pages) {
      // The title counts twice: it says what the page is about.
      const words = meaningful(`${page.title} ${page.title} ${page.text}`);
      const tf = new Map<string, number>();
      for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);
      for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
      docs.push({ source, page, tf, len: words.length });
    }
  INDEX = { docs, df, avg: docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length) };
  return INDEX;
}

/** The sources a brief names, by their aliases as whole words. */
export function kbSourcesFor(brief: string): KbSource[] {
  const text = ` ${brief.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ")} `;
  return SOURCES.filter((s) => s.aliases.some((a) => text.includes(` ${a.toLowerCase()} `)));
}

/** Pages ranked by BM25 against the brief and the answers; a source the brief names counts half again. */
export function rankPages(query: string): { page: KbPage; source: KbSource; score: number }[] {
  const { docs, df, avg } = index();
  const terms = [...new Set(meaningful(query).filter((w) => !NOISE.has(w) && !/^\d+$/.test(w)))];
  if (!terms.length) return [];
  const named = new Set(kbSourcesFor(query).map((s) => s.id));
  const N = docs.length;
  return docs
    .map((d) => {
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * d.len) / avg));
      }
      if (named.has(d.source.id)) score *= 1.5;
      return { page: d.page, source: d.source, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * The background for a deck, or null: scarce material and pages about the
 * subject, or the user's files and pages very close to it. Never for a
 * replica or a rewrite (the caller does not ask).
 */
/**
 * The organisations themselves: the knowledge base speaks for them, so a brief
 * that names none of them gets none of it (CONTEXT.md, "The subject comes from
 * the brief": Giga and UNICEF enter a deck only when the brief names them).
 * Within them the pages are chosen by relevance, named product or not.
 */
const OWN = /\b(giga|unicef|digital inclusion|digital impact|connectivity credits?|spectrum certificates?|giga ?maps?|giga ?meter|daily check app)\b/i;

/**
 * The knowledge base reaches decks only once it passes the quality gate
 * (CONTEXT.md): off in production, on locally with KB_LIVE_LOCAL=1 to test it.
 */
export function kbLive(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.KB_LIVE_LOCAL === "1";
}

export function kbBackground(query: string, opts: { scarce: boolean; withFiles: boolean }): Attachment | null {
  if (!opts.scarce && !opts.withFiles) return null;
  if (!OWN.test(query)) return null;
  const threshold = opts.withFiles && !opts.scarce ? KB_THRESHOLD_WITH_FILES : KB_THRESHOLD;
  // A source the brief names leads with its own core pages (what it is, what
  // it does): a thin brief about Giga needs those before any story.
  const core = kbSourcesFor(query).flatMap((source) => {
    const starts = new Set((SOURCES_FILE.sources.find((x) => x.id === source.id)?.start ?? []).map((u) => u.replace(/\/$/, "")));
    return source.pages.filter((p) => starts.has(p.url.replace(/\/$/, ""))).map((page) => ({ page, source, score: Infinity }));
  });
  const ranked = [...core.slice(0, 2), ...rankPages(query).filter((x) => x.score >= threshold && !NOT_CONTENT.test(x.page.url) && !core.some((c) => c.page === x.page)).slice(0, MAX_RANKED)];
  if (!ranked.length) return null;
  const seen = new Set<string>();
  let text = "";
  for (const { page, source } of ranked) {
    // One copy of a sentence: site banners repeat on every page.
    const body = page.text
      .split("\n")
      .filter((l) => {
        const k = l.trim().toLowerCase();
        if (k.length > 40 && seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .join("\n");
    const block = `# ${page.title || page.url} (${source.name}, ${page.url}, read ${page.read})\n${body}\n\n`;
    if (text.length + block.length > BUDGET) {
      if (!text) text = block.slice(0, BUDGET);
      break;
    }
    text += block;
  }
  const read = ranked.map((x) => x.page.read).sort().at(-1);
  return { id: "", name: `knowledge base, read ${read}`, kind: "text", text: text.trim(), bytes: text.length, background: true };
}
