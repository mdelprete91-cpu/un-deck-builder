import { tokens } from "../fidelity";
import type { SlideContent } from "../schema";
import type { PageBlock, PageItem } from "./schema";
import { undash } from "./schema";

/**
 * A two-pager replica's safety net (6 Oct 2026), the page twin of
 * lib/slides/restore.ts: the model drops whole paragraphs of a long document
 * now and then, whatever the prompt says, and a second pass does not always
 * bring them back. Every source line the fidelity check found missing goes
 * back as a paragraph, after the nearest line before it in the source that
 * the piece does carry, in the same section. No model call.
 */

/** Where a text sits in the piece: page, block, item. */
interface Spot {
  page: number;
  block: number;
  item: number;
}

const key = (text: string) => tokens(text).join(" ");

/** The section item that carries this source line, by its opening words. */
function find(pages: SlideContent[], line: string): Spot | null {
  const head = tokens(line).slice(0, 8).join(" ");
  if (!head) return null;
  for (let p = 0; p < pages.length; p++) {
    const stack = pages[p].stack ?? [];
    for (let b = 0; b < stack.length; b++) {
      const items = stack[b].items ?? [];
      for (let i = 0; i < items.length; i++) {
        if (key(`${items[i].label} ${items[i].body}`).includes(head)) return { page: p, block: b, item: i };
      }
    }
  }
  return null;
}

/** The last text item of the last section of the piece: where a line with no anchor goes. */
function lastSection(pages: SlideContent[]): Spot | null {
  for (let p = pages.length - 1; p >= 0; p--) {
    const stack = pages[p].stack ?? [];
    for (let b = stack.length - 1; b >= 0; b--) {
      if (stack[b].type === "section") return { page: p, block: b, item: (stack[b].items?.length ?? 1) - 1 };
    }
  }
  return null;
}

/**
 * Put every missing line back. `order` is the source's lines in reading
 * order (SourceUnits.lines), `missing` the ones the check did not find.
 * Returns the pages and how many lines went back.
 */
export function putBackLines(pages: SlideContent[], order: string[], missing: string[]): { pages: SlideContent[]; putBack: number } {
  const out = structuredClone(pages);
  const gone = new Set(missing);
  let putBack = 0;
  // Lines already placed by this pass become anchors for the next ones, so a
  // run of missing paragraphs comes back in its own order.
  for (let k = 0; k < order.length; k++) {
    const line = order[k];
    if (!gone.has(line)) continue;
    // Only sentences come back as paragraphs. A short line is a caption, a
    // label or a figure, and a loose one in a section reads as a bug
    // ("Countries engaged" under Why it matters): it stays reported missing.
    if (tokens(line).length < 6) continue;
    let spot: Spot | null = null;
    for (let j = k - 1; j >= 0 && !spot; j--) {
      const s = find(out, order[j]);
      // Only into a section: a stat card or a table row cannot hold a paragraph.
      if (s && out[s.page].stack![s.block].type === "section") spot = s;
    }
    spot ??= lastSection(out);
    if (!spot) continue;
    const items = (out[spot.page].stack![spot.block].items ??= []);
    const para: PageItem = { kind: "para", label: "", body: undash(line.replace(/^-\s+/, "")), extra: "" };
    if (/^-\s/.test(line)) para.kind = "bullet";
    items.splice(spot.item + 1, 0, para);
    putBack++;
  }
  return { pages: out, putBack };
}

/**
 * A replica sometimes writes the stat cards twice: as cards, and again as a
 * section of loose lines ("2.2B", "People remain offline", …), usually under
 * the source's masthead. A section line that only repeats a card's figure or
 * caption goes; a section left with nothing goes too.
 */
export function dropStatEchoes(pages: SlideContent[]): SlideContent[] {
  const said = new Set<string>();
  for (const p of pages)
    for (const b of p.stack ?? [])
      if (b.type === "stats") for (const it of b.items ?? []) for (const t of [it.label, it.body]) if (t.trim()) said.add(key(t));
  if (!said.size) return pages;
  return pages.map((p) => ({
    ...p,
    stack: (p.stack ?? [])
      .map((b) => {
        if (b.type !== "section") return b;
        const items = (b.items ?? [])
          .map((it) => {
            const all = `${it.label}\n${it.body}`.split("\n").filter((l) => l.trim());
            const kept = all.filter((l) => !said.has(key(l)));
            // Untouched, it keeps its bold lead-in; echoes removed, the rest is plain text.
            if (kept.length === all.length) return it;
            return kept.length ? { ...it, label: "", body: kept.join("\n") } : null;
          })
          .filter((it): it is PageItem => !!it);
        return { ...b, items };
      })
      .filter((b) => b.type !== "section" || (b.items?.length ?? 0) > 0),
  }));
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
/** Lockup words a printed piece carries in its masthead or footer. */
const LOCKUPS = new Set(["unicef", "for every child", "digital inclusion", "digital impact division", "unicef digital inclusion", "unicef digital impact division", "giga"]);

/**
 * A line of a source document's masthead or footer rather than its content:
 * a lockup, a page number on its own, a date line ("OCTOBER 2026").
 */
export function isMastheadLine(line: string): boolean {
  const t = line.replace(/[\u200b\u00a0]/g, " ").trim().toLowerCase();
  if (!t) return false;
  if (/^\d{1,2}$/.test(t)) return true;
  if (new RegExp(`^(${MONTHS})\\s+\\d{4}$`).test(t)) return true;
  return LOCKUPS.has(t);
}

/**
 * A stat card with no figure ("Countries" / "engaged") takes the next source
 * figure the piece does not carry anywhere, in source order, and its words
 * go back together as the caption. A PDF reader can set a figure apart from
 * its caption ("02, 54" on a line of its own), and the model cannot pair them.
 */
export function fillStatFigures(pages: SlideContent[], unplaced: string[], captions: string[] = []): SlideContent[] {
  const queue = [...unplaced];
  if (!queue.length) return pages;
  const filled = fillEmptyCards(pages, queue);
  // Figures still unplaced, and short source lines missing from the piece
  // ("Countries engaged"): paired in order into new cards, on the last stats
  // block that has room. The model left the whole card out.
  const caps = captions.filter((c) => tokens(c).length > 0 && tokens(c).length < 6 && !/\d/.test(c));
  const n = Math.min(queue.length, caps.length);
  if (!n) return filled;
  for (let p = filled.length - 1; p >= 0; p--) {
    const stack = filled[p].stack ?? [];
    for (let b = stack.length - 1; b >= 0; b--) {
      const block = stack[b];
      if (block.type !== "stats") continue;
      const room = 6 - (block.items?.length ?? 0);
      if (room <= 0) continue;
      const add = Array.from({ length: Math.min(n, room) }, (_, i): PageItem => ({ label: queue[i], body: caps[i], extra: "" }));
      const out = structuredClone(filled);
      out[p].stack![b].items = [...(block.items ?? []), ...add];
      return out;
    }
  }
  return filled;
}

/** The cards with no figure take the unplaced figures in order (consumes `queue`). */
function fillEmptyCards(pages: SlideContent[], queue: string[]): SlideContent[] {
  return pages.map((p) => ({
    ...p,
    stack: (p.stack ?? []).map((b) =>
      b.type !== "stats"
        ? b
        : {
            ...b,
            items: (b.items ?? []).map((it) => {
              if (/\d/.test(it.label) || !queue.length) return it;
              return { ...it, label: queue.shift()!, body: `${it.label} ${it.body}`.trim() };
            }),
          },
    ),
  }));
}

/**
 * A PDF's text comes with the page's line ends inside its sentences ("U.S." /
 * "companies", "Microsoft" / "."), and a replica kept them as breaks (US
 * partnerships piece, 7 Oct 2026). A line runs on into the next when that one
 * starts in lower case or with punctuation, or when it ends on a hyphen; a
 * bullet, a heading or a new sentence keeps its own line.
 */
export function unwrapLines(text: string): string {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const prev = out[out.length - 1];
    const t = line.trimStart();
    const continues =
      prev !== undefined &&
      prev.trim() !== "" &&
      t !== "" &&
      !/^([-•●▪◦*]|\d+[.)])\s/.test(t) &&
      (/^[a-z.,;:)\]’'"”]/.test(t) || /[a-z]-$/.test(prev));
    if (!continues) {
      out.push(line);
      continue;
    }
    out[out.length - 1] = /[a-z]-$/.test(prev) ? prev + t : /^[.,;:)\]]/.test(t) ? prev + t : `${prev} ${t}`;
  }
  return out.join("\n");
}

/** Words only, lower case: how a heading is looked up in the source. */
const plain = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * The shape rules of a replica, applied after the model (US partnerships
 * piece, 7 Oct 2026, where each one failed):
 * - a title, heading or side label the document does not have goes ("The
 *   opportunity", "2.3M Schools"); a section left without its label runs
 *   the full width;
 * - a comparison is one table: two in a row (across a page break too) are
 *   merged, column by column;
 * - a page number is never a figure: a stat card reading "02" goes;
 * - a banner starts a new part of the document, so it starts a page.
 */
export function shapeReplica(pages: SlideContent[], source: string): SlideContent[] {
  const src = ` ${plain(source)} `;
  const known = (s?: string) => !s?.trim() || src.includes(` ${plain(s)} `) || src.includes(plain(s));
  // 1. Invented heads.
  let out = pages.map((p, pi) => ({
    ...p,
    stack: (p.stack ?? [])
      .filter((b, bi) => !((b.type === "title" || b.type === "heading") && !known(b.heading) && !(pi === 0 && bi === 0)))
      .map((b) => {
        if (b.rail && !known(b.rail)) return { ...b, rail: "", ...(b.type === "section" ? { wide: true } : {}) };
        if (b.type === "section" && !b.rail?.trim()) return { ...b, wide: true };
        return b;
      }),
  }));
  // 2. One comparison table.
  let prev: PageBlock | null = null;
  out = out.map((p) => {
    const stack: PageBlock[] = [];
    for (const b of p.stack) {
      if (b.type === "panels" && prev?.type === "panels" && (prev.items?.length ?? 0) === (b.items?.length ?? 0)) {
        prev.items = prev.items!.map((it, i) => ({ ...it, body: [it.body, b.items![i].body].filter((x) => x.trim()).join("\n") }));
        continue;
      }
      const copy = b.type === "panels" ? { ...b, items: b.items?.map((it) => ({ ...it })), cont: undefined } : b;
      stack.push(copy);
      prev = copy;
    }
    // Anything after the table on the same page breaks the run.
    if (stack.length && stack[stack.length - 1].type !== "panels") prev = null;
    return { ...p, stack };
  });
  // 3. Page numbers are not figures.
  out = out.map((p) => ({
    ...p,
    stack: p.stack
      .map((b) => (b.type === "stats" ? { ...b, items: (b.items ?? []).filter((it) => !/^0\d$/.test(it.label.trim())) } : b))
      .filter((b) => b.type !== "stats" || (b.items?.length ?? 0) > 0),
  }));
  // 4. A banner opens a page.
  const paged: SlideContent[] = [];
  for (const p of out) {
    let cur: PageBlock[] = [];
    p.stack.forEach((b, i) => {
      if (b.type === "banner" && i > 0 && cur.length) {
        paged.push({ ...p, stack: cur });
        cur = [];
      }
      cur.push(b);
    });
    if (cur.length) paged.push({ ...p, stack: cur });
  }
  return paged.filter((p) => (p.stack?.length ?? 0) > 0);
}
