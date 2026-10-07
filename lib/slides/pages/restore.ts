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
 * Where a figure's caption is in the source: the rest of its own line
 * ("2.6B People remain offline"), else the next line when it is a short
 * caption. Null when the source does not pair it with anything: then the
 * figure gets no card. Pairing a figure with any missing line in order is
 * what wrote "44k+ / Spectrum Certificates" (7 Oct 2026).
 */
export function captionFor(figure: string, source: string): string | null {
  const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);
  const f = figure.trim();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l !== f && !l.startsWith(`${f} `)) continue;
    const rest = l.slice(f.length).trim();
    if (rest && tokens(rest).length <= 12) return rest;
    const next = lines[i + 1];
    if (!rest && next && tokens(next).length > 0 && tokens(next).length <= 12 && !/^[\d.,]+[%kKmMbB+x]*$/.test(next)) return next;
  }
  return null;
}

/** The figure written just before a caption in the source, or null. */
function figureFor(caption: string, source: string): string | null {
  const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);
  const c = key(caption);
  for (let i = 1; i < lines.length; i++) {
    if (key(lines[i]) !== c) continue;
    const prev = lines[i - 1];
    if (/^[<>~≈]?[$€£]?[\d][\d.,–-]*\s?[%kKmMbB+x]*\+?$/.test(prev)) return prev;
  }
  return null;
}

/**
 * Stat cards and the source's figures, paired only as the source pairs them:
 * a card with no figure takes the figure printed just above its caption; a
 * figure the piece left out gets a card with its own caption, on the last
 * stats block with room. Anything the source does not pair stays out.
 */
export function fillStatFigures(pages: SlideContent[], unplaced: string[], _captions: string[] = [], source = ""): SlideContent[] {
  if (!source) return pages;
  const placed = new Set<string>();
  let out = pages.map((p) => ({
    ...p,
    stack: (p.stack ?? []).map((b) =>
      b.type !== "stats"
        ? b
        : {
            ...b,
            items: (b.items ?? [])
              .map((it) => {
                if (/\d/.test(it.label)) return it;
                const cap = `${it.label} ${it.body}`.trim();
                const fig = figureFor(cap, source);
                if (!fig) return null;
                placed.add(fig);
                return { ...it, label: fig, body: cap };
              })
              .filter((it): it is PageItem => !!it),
          },
    ),
  }));
  const add = unplaced
    .filter((f) => !placed.has(f))
    .map((f) => ({ f, cap: captionFor(f, source) }))
    .filter((x): x is { f: string; cap: string } => !!x.cap)
    .map(({ f, cap }): PageItem => ({ label: f, body: cap, extra: "" }));
  if (!add.length) return out;
  for (let p = out.length - 1; p >= 0; p--) {
    const stack = out[p].stack ?? [];
    for (let b = stack.length - 1; b >= 0; b--) {
      const block = stack[b];
      if (block.type !== "stats") continue;
      const room = 6 - (block.items?.length ?? 0);
      if (room <= 0) continue;
      out = structuredClone(out);
      out[p].stack![b].items = [...(block.items ?? []), ...add.slice(0, room)];
      return out;
    }
  }
  return out;
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
  // 0. A figure set as a title ("2.3M Schools") is a stat card: it joins the
  // next stats block of the piece, or goes when there is none with room.
  const isFigureTitle = (b: PageBlock) => (b.type === "title" || b.type === "heading") && /^[$€£]?\d[\d.,]*\s?[%kKmMbB+]*\+?\s+\S/.test(b.heading?.trim() ?? "");
  let moved = pages.map((p) => ({ ...p, stack: (p.stack ?? []).map((b) => ({ ...b })) }));
  moved.forEach((p, pi) => {
    p.stack = p.stack.filter((b, bi) => {
      if (!isFigureTitle(b)) return true;
      const [, fig, cap] = /^(\S+)\s+(.+)$/.exec(b.heading!.trim())!;
      for (let q = pi; q < moved.length; q++) {
        const target = moved[q].stack.find((x, xi) => x.type === "stats" && (q > pi || xi > bi) && (x.items?.length ?? 0) < 6);
        if (target) {
          if (!(target.items ?? []).some((it) => it.label.trim() === fig)) target.items = [{ label: fig, body: cap, extra: "" }, ...(target.items ?? [])];
          return false;
        }
      }
      return false;
    });
  });
  // A card with no figure is not a stat.
  moved = moved.map((p) => ({ ...p, stack: p.stack.map((b) => (b.type === "stats" ? { ...b, items: (b.items ?? []).filter((it) => /\d/.test(it.label)) } : b)) }));
  // 1. Invented heads.
  let out = moved.map((p, pi) => ({
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

/** Blocks that give a page somewhere for the eye to land. */
const ANCHORS = new Set(["banner", "stats", "photos", "figure", "split", "screens", "pillars", "panels"]);

/**
 * How a piece reads (Mario, 7 Oct 2026: the reference is far more dynamic).
 * A page with no anchor block, three sections in a row, and blocks that do
 * not follow the plan the model wrote first. Reported in Review, not fixed:
 * a fix would mean writing text.
 */
export function checkRhythm(pages: SlideContent[], plan: { block: string; page: number }[] = []): string[] {
  const notes: string[] = [];
  pages.forEach((p, i) => {
    const stack = p.stack ?? [];
    if (stack.length && !stack.some((b) => ANCHORS.has(b.type)) && !stack.every((b) => b.cont || b.type === "panels"))
      notes.push(`Page ${i + 1} is text only: no figures, photos or table to anchor it.`);
    let run = 0;
    for (const b of stack) {
      // An opening paragraph with no label of its own (wide) is not part of a run.
      run = b.type === "section" && !b.wide && b.rail?.trim() ? run + 1 : 0;
      if (run === 3) notes.push(`Page ${i + 1} has three text sections in a row.`);
    }
  });
  if (plan.length) {
    const planned = plan.map((r) => r.block).join(" ");
    const built = pages.flatMap((p) => (p.stack ?? []).filter((b) => !b.cont).map((b) => b.type)).join(" ");
    if (planned !== built) notes.push(`The pages differ from the plan: planned ${plan.length} blocks (${planned}), built ${built.split(" ").length} (${built}).`);
  }
  return notes;
}

/**
 * Why a two-pager written from a brief reads as a report rather than a
 * two-pager (Mario, 7 Oct 2026: "too textual, too linear"): pages with no
 * anchor block, runs of three sections, sections over half the piece, too
 * few kinds of block. Empty when the layout has enough variety.
 */
export function layoutIssues(pages: SlideContent[]): string[] {
  const blocks = pages.flatMap((p) => (p.stack ?? []).filter((b) => !b.cont));
  if (!blocks.length) return [];
  const issues: string[] = [];
  pages.forEach((p, i) => {
    const stack = p.stack ?? [];
    if (stack.length && !stack.some((b) => ANCHORS.has(b.type))) issues.push(`page ${i + 1} has no figures, photos, cards or table`);
    let run = 0;
    for (const b of stack) {
      run = b.type === "section" ? run + 1 : 0;
      if (run === 3) issues.push(`page ${i + 1} has three text sections in a row`);
    }
  });
  const sections = blocks.filter((b) => b.type === "section").length;
  if (sections > 3 && sections / blocks.length > 0.5) issues.push(`${sections} of its ${blocks.length} blocks are text sections`);
  const kinds = new Set(blocks.map((b) => b.type)).size;
  if (kinds < 4) issues.push(`only ${kinds} kinds of block`);
  return issues;
}

/**
 * A two-pager written from a brief: a contacts block needs someone to write
 * to (an address), a list of asks needs more than one. Not for replicas,
 * which keep what the document has.
 */
export function tidyBriefPieces(pages: SlideContent[]): SlideContent[] {
  return pages.map((p) => ({
    ...p,
    stack: (p.stack ?? [])
      .filter((b) => b.type !== "contacts" || (b.items ?? []).some((it) => /@/.test(it.extra)))
      .map((b): PageBlock => (b.type === "numbered" && (b.items?.length ?? 0) === 1 ? { type: "section", rail: b.rail, items: [{ kind: "para", label: "", body: b.items![0].body, extra: "" }] } : b)),
  }));
}
