import KB from "@/kb/index.json";
import type { Attachment } from "./attachments";
import { meaningful } from "./repeats";

/**
 * The knowledge base (Mario, 13 Oct 2026): what Giga Maps, Giga Meter,
 * Connectivity Credits, Spectrum Certificates and the UNICEF Digital Impact
 * site say, read weekly by tools/kb-update.ts. A brief that names one of them
 * gets its pages as reference material, like a linked page, with the date
 * they were read; a brief that names none gets nothing (the system prompt
 * stays as it is). The facts are allowed because the brief made the deck
 * about that product.
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

/** Characters of one source handed to the model, the pages that fit the brief best first. */
const PER_SOURCE = 12_000;

const SOURCES = (KB as { sources: KbSource[] }).sources;

/** The sources a brief names, by their aliases as whole words. */
export function kbSourcesFor(brief: string): KbSource[] {
  const text = ` ${brief.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ")} `;
  return SOURCES.filter((s) => s.aliases.some((a) => text.includes(` ${a.toLowerCase()} `)));
}

/** A source's pages as one text attachment: the pages that share most words with the brief, until the budget is spent. */
export function kbAttachments(brief: string): Attachment[] {
  const want = new Set(meaningful(brief));
  return kbSourcesFor(brief).map((s) => {
    const ranked = [...s.pages].sort((a, b) => score(b, want) - score(a, want) || a.url.length - b.url.length);
    let text = "";
    for (const p of ranked) {
      const block = `# ${p.title || p.url}\n(${p.url}, read ${p.read})\n${p.text}\n\n`;
      if (text.length + block.length > PER_SOURCE) {
        if (!text) text = block.slice(0, PER_SOURCE);
        break;
      }
      text += block;
    }
    const read = s.pages.map((p) => p.read).sort().at(-1);
    return { id: "", name: `${s.name} (knowledge base, read ${read})`, kind: "text", text: text.trim(), bytes: text.length } satisfies Attachment;
  });
}

function score(p: KbPage, want: Set<string>): number {
  if (!want.size) return 0;
  const words = new Set(meaningful(`${p.title} ${p.text.slice(0, 3000)}`));
  return [...want].filter((w) => words.has(w)).length;
}
