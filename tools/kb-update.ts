/**
 * The knowledge base (Mario, 13 Oct 2026): the pages of Giga Maps, Connectivity
 * Credits, Giga Meter, Spectrum Certificates and the whole UNICEF Digital Impact
 * site, read and cleaned into kb/index.json, which the generator hands the
 * model when a brief names one of them (lib/slides/kb.ts).
 *
 *   npx tsx tools/kb-update.ts
 *
 * Runs weekly in .github/workflows/kb-update.yml, which opens a pull request
 * when anything changed. No API key: the text is cleaned here and read by the
 * model only when a deck needs it. A page keeps its `read` date until its text
 * changes, so the weekly diff shows only what the sites changed; kb/CHANGES.md
 * says it in plain words for the pull request.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fetchRendered, htmlToText } from "../lib/slides/links-server";

interface Source {
  id: string;
  name: string;
  aliases: string[];
  start: string[];
  render?: boolean;
  follow?: { prefix: string; max: number };
}
export interface KbPage {
  url: string;
  title: string;
  text: string;
  /** Sentences that carry a figure, as written. */
  figures: string[];
  /** The day this text was first read as it is (YYYY-MM-DD). */
  read: string;
}
export interface KbSource {
  id: string;
  name: string;
  aliases: string[];
  pages: KbPage[];
}

const TODAY = new Date().toISOString().slice(0, 10);
const MAX_TEXT = 8000;
const UA = "GigaDeckBuilder-KB/1.0 (+https://un-deck-builder.vercel.app)";
const SKIP = /\.(pdf|jpe?g|png|gif|svg|webp|ico|zip|docx?|xlsx?|pptx?|mp4|mp3|css|js|json|xml|woff2?)(\?|$)|\/(search|user|login|node|_next|themes|sites|cdn-cgi)\/|privacy|cookie|terms|mailto:|tel:|\/(fr|es|ar|ru|zh)\//i;

async function raw(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA, accept: "text/html" } });
    if (!res.ok) return "";
    // Not a page (a stylesheet, a script): skipped, never sent to the reader either.
    if (!/html/.test(res.headers.get("content-type") ?? "")) return null;
    return (await res.text()).slice(0, 2_000_000);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

/** The page's own links under the prefix, absolute, without query or fragment. */
function links(html: string, base: string, prefix: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      u.hash = "";
      u.search = "";
      const s = u.toString().replace(/\/$/, "");
      if (s.toLowerCase().startsWith(prefix.toLowerCase().replace(/\/$/, "")) && !SKIP.test(s)) out.add(s);
    } catch {
      /* not a URL */
    }
  }
  return [...out];
}

/** The readable text: the page's own cleaner, then nav and footer lines that repeat on every page are cut. */
const ENTITIES: Record<string, string> = { amp: "&", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", nbsp: " ", quot: '"', apos: "'", hellip: "\u2026", ndash: "-", mdash: ",", lt: "<", gt: ">" };
/** Lines every page of a site repeats (navigation, search, footer). */
const CHROME = /^(skip to main content|search( form| for result)?|clear search input|hide filters|show filters|max|toggle navigation|visit unicef global|menu|close|share|print|back to top|read more|learn more|subscribe)$/i;

function clean(text: string): string {
  return text
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => (e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m))
    .split("\n")
    .filter((l) => !CHROME.test(l.trim()))
    .join("\n")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!\[[^\]]*\]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const sentencesWithFigures = (text: string) =>
  [...new Set(text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /\d/.test(s) && s.length > 12 && s.length < 300))].slice(0, 25);

async function readPage(url: string, render: boolean): Promise<{ page: Omit<KbPage, "read"> | null; html: string }> {
  const fetched = render ? "" : await raw(url);
  if (fetched === null) return { page: null, html: "" };
  const html = fetched;
  let title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  let text = html ? clean(htmlToText(html)) : "";
  if (text.length < 300) {
    const r = await fetchRendered(url);
    text = clean(r.text.replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, ""));
    title ||= /^Title:\s*(.+)$/m.exec(r.text)?.[1]?.trim() ?? "";
  }
  if (text.length < 200) return { page: null, html };
  // htmlToText puts the title first; keep it once.
  if (title && text.startsWith(title)) text = text.slice(title.length).trim();
  return { page: { url, title: title.replace(/\s*\|\s*UNICEF.*$/i, "").trim(), text: text.slice(0, MAX_TEXT), figures: sentencesWithFigures(text) }, html };
}

async function crawl(src: Source): Promise<Omit<KbPage, "read">[]> {
  const queue = [...src.start];
  const seen = new Set<string>(queue.map((u) => u.replace(/\/$/, "")));
  const pages: Omit<KbPage, "read">[] = [];
  const max = src.follow?.max ?? src.start.length;
  while (queue.length && pages.length < max) {
    const url = queue.shift()!;
    const { page, html } = await readPage(url, !!src.render);
    if (page) pages.push(page);
    if (src.follow && html) {
      for (const l of links(html, url, src.follow.prefix)) {
        if (!seen.has(l)) {
          seen.add(l);
          queue.push(l);
        }
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return pages;
}

(async () => {
  const { sources } = JSON.parse(readFileSync("kb/sources.json", "utf8")) as { sources: Source[] };
  const before: { sources: KbSource[] } = existsSync("kb/index.json") ? JSON.parse(readFileSync("kb/index.json", "utf8")) : { sources: [] };
  const old = new Map(before.sources.flatMap((s) => s.pages.map((p) => [p.url, p] as const)));
  const changes: string[] = [];
  const out: KbSource[] = [];
  for (const src of sources) {
    const read = await crawl(src);
    // A source that read nothing this week keeps last week's pages: a site down is not a site emptied.
    if (!read.length) {
      const prev = before.sources.find((s) => s.id === src.id);
      if (prev) out.push(prev);
      changes.push(`- ${src.name}: could not be read this week, last week's pages kept.`);
      continue;
    }
    const pages = read
      .map((p) => {
        const was = old.get(p.url);
        if (!was) changes.push(`- ${src.name}: new page ${p.url}`);
        else if (was.text !== p.text) {
          const gone = was.figures.filter((f) => !p.figures.includes(f));
          const added = p.figures.filter((f) => !was.figures.includes(f));
          changes.push(`- ${src.name}: ${p.url} changed${added.length ? `; figures now: ${added.slice(0, 3).join(" | ")}` : ""}${gone.length ? `; no longer: ${gone.slice(0, 3).join(" | ")}` : ""}`);
        }
        return { ...p, read: was && was.text === p.text ? was.read : TODAY };
      })
      .sort((a, b) => a.url.localeCompare(b.url));
    const prevUrls = before.sources.find((s) => s.id === src.id)?.pages.map((p) => p.url) ?? [];
    prevUrls.filter((u) => !pages.some((p) => p.url === u)).forEach((u) => changes.push(`- ${src.name}: page gone ${u}`));
    out.push({ id: src.id, name: src.name, aliases: src.aliases, pages });
    console.log(`${src.id}: ${pages.length} pages, ${pages.reduce((a, p) => a + p.text.length, 0)} chars`);
  }
  writeFileSync("kb/index.json", JSON.stringify({ sources: out }, null, 1) + "\n");
  writeFileSync("kb/CHANGES.md", `# Knowledge base, week of ${TODAY}\n\n${changes.length ? changes.join("\n") : "No change on the sites this week."}\n`);
  console.log(`${changes.length} change(s), see kb/CHANGES.md`);
})();
