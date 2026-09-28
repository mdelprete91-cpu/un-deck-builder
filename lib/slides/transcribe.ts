import { MAX_SLIDES } from "./brief";
import { classify, type Raw, type SourceSlide } from "./pptx-source";

/**
 * A PDF with no text layer (type turned into outlines on export from Figma
 * or Illustrator, or a scan) has nothing for pdf.js to read, so "replicate"
 * asks the model to transcribe its pages (Mario, 28 Sep 2026: the question
 * is asked for every PDF). `app/api/transcribe` sends the file as the same
 * document block `/api/analyze` uses and gets the text back page by page;
 * `slidesFromTranscript` turns that into the `SourceSlide`s `readPdfSlides`
 * gives, so `planReplica` and `runReplicate` run unchanged. Only when
 * Replicate is chosen and Generate pressed, never at upload.
 */

/** Pages transcribed at most: a cover and the closing slide take the other two of `MAX_SLIDES`. */
export const MAX_TRANSCRIBED_PAGES = MAX_SLIDES - 2;
/** A first page past this many words carries content: it is replicated as a slide, and the cover is built from the document's title. */
const COVER_WORDS = 40;

export interface Transcript {
  title: string;
  subtitle: string;
  pages: { n: number; title: string; lines: string[]; footnotes: string[] }[];
}

export const TRANSCRIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "pages"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "title", "lines", "footnotes"],
        properties: {
          n: { type: "integer" },
          title: { type: "string" },
          lines: { type: "array", items: { type: "string" } },
          footnotes: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export function transcribeInstructions(pages: number): string {
  return [
    `Transcribe the text of the attached PDF, pages 1 to ${pages}, one entry per page in page order ("n" is the page number), a page with little text included.`,
    `"title": the document's title as printed on its first page. "subtitle": the document type, date or place printed with it, "" when there is none.`,
    `For each page, "title" is the page's own heading as written ("" when it has none), and "lines" is every other piece of text on the page in reading order: one line per paragraph, point, table row or label. A sub-point starts with "- ". A table row is its cells joined by " | ", the header row first. A chart is one line per category with its values, as labelled on the chart ("2024: 3.10, 0.44"); a figure with its caption is one line ("245,405 Schools created").`,
    `"footnotes": the page's footnotes and source notes, as written, with their numbers.`,
    `Copy every word, number, unit and date exactly as printed, digit by digit. Never summarise, translate, reorder or add anything. Leave out the running header and footer and the page number that repeat on every page. Keep the document's language.`,
  ].join("\n");
}

const clip = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What the model returned, trimmed to the pages asked for, in order, one entry per page. */
export function normalizeTranscript(raw: unknown, pages: number): Transcript | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const seen = new Set<number>();
  const out: Transcript["pages"] = [];
  for (const p of Array.isArray(r.pages) ? r.pages : []) {
    if (typeof p !== "object" || p === null) continue;
    const page = p as Record<string, unknown>;
    const n = typeof page.n === "number" ? Math.round(page.n) : out.length + 1;
    if (n < 1 || n > pages || seen.has(n)) continue;
    seen.add(n);
    const list = (v: unknown) => (Array.isArray(v) ? v.map((l) => clip(l, 800)).filter(Boolean).slice(0, 80) : []);
    out.push({ n, title: clip(page.title, 300), lines: list(page.lines), footnotes: list(page.footnotes) });
  }
  out.sort((a, b) => a.n - b.n);
  if (!out.some((p) => p.title || p.lines.length)) return null;
  return { title: clip(r.title, 300), subtitle: clip(r.subtitle, 300), pages: out };
}

/**
 * The transcript as the deck `planReplica` reads: each page through the
 * shared `classify`, like a page pdf.js could read. A report's first page
 * usually carries content (the Mexico DQR opens on its figures): it is then
 * replicated as a slide of its own and the cover comes from the document's
 * title, so nothing on it is lost to the cover layout.
 */
export function slidesFromTranscript(t: Transcript): SourceSlide[] {
  const raws: Raw[] = t.pages
    .filter((p) => p.title || p.lines.length)
    .map((p) => ({
      n: p.n,
      title: p.title,
      lines: p.lines,
      figures: [],
      footnotes: p.footnotes,
      extras: [],
      paras: p.lines.map((l) => ({ text: l.replace(/^- /, ""), level: /^- /.test(l) ? 1 : 0, size: 0, colour: "" })),
    }));
  const { slides } = classify(raws);
  const first = slides[0];
  if (first?.kind === "cover" && first.words <= COVER_WORDS) return slides;
  const title = t.title || first?.title || "";
  if (!title) return slides;
  const cover: SourceSlide = {
    n: first?.n ?? 1,
    kind: "cover",
    title,
    text: [`Title: ${title}`, t.subtitle].filter(Boolean).join("\n"),
    words: `${title} ${t.subtitle}`.split(/\s+/).filter(Boolean).length,
  };
  return [cover, ...slides.map((s) => (s === first && s.kind === "cover" ? { ...s, kind: "content" as const } : s))];
}
