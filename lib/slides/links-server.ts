import type { Attachment } from "@/lib/slides/attachments";
import { MAX_TEXT_PER_FILE } from "@/lib/slides/attachments";
import { extractUrls } from "@/lib/slides/links";

/**
 * Fetch the pages a brief links to and hand their text to the model as
 * reference material, exactly like a text attachment. Public http(s) only:
 * anything that resolves to the local machine or a private network is
 * refused, since this runs on the server. A page that fails or times out is
 * skipped, never fatal; the brief still generates without it.
 *
 * A page built by JavaScript (Giga Maps, most apps) gives a plain fetch only
 * its title. Those go through Jina Reader (r.jina.ai), which renders the page
 * in a browser and returns its readable text: the URL is public anyway, and
 * Vercel has no headless browser of its own. Read on 22 Sep 2026: 4.5k chars
 * for maps.giga.global/about in about five seconds.
 */
const TIMEOUT_MS = 8000;
const READER_TIMEOUT_MS = 20000;
const THIN_PAGE = 80;
const MAX_BYTES = 1_500_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\]|.*\.local)$/i;

export async function fetchLinkedPages(brief: string): Promise<Attachment[]> {
  const urls = extractUrls(brief);
  const pages = await Promise.all(urls.map(fetchPage));
  return pages.filter((p): p is Attachment => p !== null);
}

async function fetchPage(url: string): Promise<Attachment | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol) || PRIVATE_HOST.test(parsed.hostname)) return null;
  let text = await fetchPlain(url);
  if (text.length < THIN_PAGE) text = await fetchRendered(url);
  if (text.length < THIN_PAGE) return null;
  return {
    id: "",
    name: url,
    kind: "text",
    text: text.slice(0, MAX_TEXT_PER_FILE),
    bytes: Math.min(text.length, MAX_TEXT_PER_FILE),
    truncated: text.length > MAX_TEXT_PER_FILE,
  };
}

/** The page as the server sends it: enough for articles and documents. */
async function fetchPlain(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "GigaDeckBuilder/1.0 (+https://un-deck-builder.vercel.app)", accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (!res.ok) return "";
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return "";
    const raw = (await res.text()).slice(0, MAX_BYTES);
    return /html/.test(type) ? htmlToText(raw) : raw.trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** The page after JavaScript has run, as readable text, via Jina Reader. */
async function fetchRendered(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { accept: "text/plain", "x-return-format": "text" },
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, MAX_BYTES).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** The readable text of a page: no scripts, styles, nav chrome or tags. */
function htmlToText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const text = body
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return title ? `${title}\n\n${text}` : text;
}
