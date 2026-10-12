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
  let { text, published } = await fetchPlain(url);
  if (text.length < THIN_PAGE) ({ text, published } = await fetchRendered(url));
  if (text.length < THIN_PAGE) return null;
  // The date the page gives, else the one its address carries (/2025/08/28/).
  const fromUrl = /\/((?:19|20)\d{2})\/(\d{2})\/(\d{2})\//.exec(parsed.pathname);
  const date = published ?? (fromUrl ? `${fromUrl[1]}-${fromUrl[2]}-${fromUrl[3]}` : undefined);
  return {
    id: "",
    name: url,
    kind: "text",
    text: text.slice(0, MAX_TEXT_PER_FILE),
    bytes: Math.min(text.length, MAX_TEXT_PER_FILE),
    truncated: text.length > MAX_TEXT_PER_FILE,
    ...(date ? { published: date } : {}),
  };
}

/**
 * When the page says it was published: article:published_time, a JSON-LD
 * datePublished, og:updated_time, a <time datetime>, in that order. Read
 * before the markup is stripped (12 Oct 2026: an August 2025 article was
 * told in the future tense in October 2026).
 */
function publishedDate(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|datePublished|date|pubdate|publish-date|dc\.date)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|datePublished)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+property=["']og:updated_time["'][^>]*content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const d = re.exec(html)?.[1].match(/(?:19|20)\d{2}-\d{2}-\d{2}/)?.[0];
    if (d) return d;
  }
  return undefined;
}

/** The page as the server sends it: enough for articles and documents. */
async function fetchPlain(url: string): Promise<{ text: string; published?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "GigaDeckBuilder/1.0 (+https://un-deck-builder.vercel.app)", accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (!res.ok) return { text: "" };
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return { text: "" };
    const raw = (await res.text()).slice(0, MAX_BYTES);
    return /html/.test(type) ? { text: htmlToText(raw), published: publishedDate(raw) } : { text: raw.trim() };
  } catch {
    return { text: "" };
  } finally {
    clearTimeout(timer);
  }
}

/** The page after JavaScript has run, as readable text, via Jina Reader. */
async function fetchRendered(url: string): Promise<{ text: string; published?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { accept: "text/plain", "x-return-format": "text" },
    });
    if (!res.ok) return { text: "" };
    const text = (await res.text()).slice(0, MAX_BYTES).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
    // Jina's header block carries "Published Time: 2025-08-28T…" when the page gives one.
    const published = /^Published Time:\s*((?:19|20)\d{2}-\d{2}-\d{2})/m.exec(text)?.[1];
    return { text, published };
  } catch {
    return { text: "" };
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
