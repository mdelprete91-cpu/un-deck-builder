/**
 * Links in the brief. The composer colours them so the user sees they were
 * recognised, and the route fetches their text as reference material, the
 * way an attached file travels (Mario, 22 Sep 2026). Pure and shared by both.
 */
export const MAX_LINKS = 3;

/** http(s) URLs as they appear in prose: trailing punctuation is not part of them. */
export const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_PATTERN)) {
    const url = m[0].replace(/[.,;:!?]+$/, "");
    if (!out.includes(url)) out.push(url);
    if (out.length === MAX_LINKS) break;
  }
  return out;
}

/** The brief split into plain runs and links, for a highlighted rendering. */
export function splitLinks(text: string): { text: string; link: boolean }[] {
  const parts: { text: string; link: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_PATTERN)) {
    const start = m.index ?? 0;
    const url = m[0].replace(/[.,;:!?]+$/, "");
    if (start > last) parts.push({ text: text.slice(last, start), link: false });
    parts.push({ text: url, link: true });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), link: false });
  return parts;
}
