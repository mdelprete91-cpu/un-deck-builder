import type { BrandTheme } from "../brand";
import type { Slide } from "../schema";
import { PX } from "./a4";
import { renderPage } from "./render";
import type { PageBlock } from "./schema";

/**
 * Does a page fit its sheet? Measured, not estimated (6 Oct 2026): the page
 * is drawn off-screen at 1:1 and its flow compared with the content zone.
 * Browser only.
 *
 * The fit pass then works down a ladder, cheapest first: the regular setting,
 * the compact one, the tight one, and only then a model call that shortens
 * the longest block. A page that is still over after that is left clipped
 * and the editor says so (SlideFrame reads the same measure).
 */

/** Positive: pt past the bottom of the zone. Negative: pt of room left. */
export function measureFlow(root: ParentNode): number | null {
  const zone = root.querySelector<HTMLElement>("[data-page-zone]");
  const flow = root.querySelector<HTMLElement>("[data-page-flow]");
  if (!zone || !flow) return null;
  // offsetHeight is unscaled layout size, so this holds on a scaled stage too.
  return (flow.offsetHeight - zone.offsetHeight) / PX;
}

let host: HTMLDivElement | null = null;

/** Draw a page off-screen and measure it. */
export async function measurePage(slide: Slide, t: BrandTheme, index: number, total: number): Promise<number> {
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;";
    document.body.appendChild(host);
  }
  host.innerHTML = renderPage(slide, t, { index, total });
  // The type has to be loaded or every line measures in the fallback font.
  await document.fonts.ready;
  const over = measureFlow(host) ?? 0;
  host.innerHTML = "";
  return over;
}

/** Characters of text in a block, the unit the shorten call is asked in. */
function textLength(b: PageBlock): number {
  return (b.items ?? []).reduce((n, it) => n + it.body.length + it.extra.length, (b.body ?? "").length);
}

/** About how many characters a pt of overrun is worth: 15pt a line, ~85 a line. */
const CHARS_PER_PT = 85 / 15;

export interface FitResult {
  slide: Slide;
  /** pt still over after everything, 0 when it fits. */
  over: number;
}

/** The model's part of the pass (app/api/page-shorten), injected so this file stays free of fetch. */
export interface Resizer {
  shorten: (block: PageBlock, chars: number) => Promise<PageBlock | null>;
}

/** Photos, icons and maps are the library's or the user's: a rewrite keeps them by position. */
function keepAssets(fresh: PageBlock, old: PageBlock): PageBlock {
  return {
    ...fresh,
    image: old.image,
    imagePos: old.imagePos,
    map: old.map,
    items: fresh.items?.map((it, i) => ({
      ...it,
      image: old.items?.[i]?.image,
      imagePos: old.items?.[i]?.imagePos,
      icon: it.icon || old.items?.[i]?.icon,
    })),
  };
}

/**
 * Fit one page to its sheet: the regular setting, then the compact one, then
 * the longest block shortened (twice at most), and only then the tight
 * setting, whose 9pt body is under anything on the Estonia pieces.
 *
 * A page with room left is left as it is. Lengthening it by model was tried
 * (6 Oct 2026) and filled pages with sentences that said nothing: white space
 * is the honest answer to a thin brief, and the prompt asks for full pages.
 */
export async function fitPage(slide: Slide, t: BrandTheme, index: number, total: number, resize: Resizer): Promise<FitResult> {
  let current: Slide = { ...slide, pageFit: "regular" };
  let over = await measurePage(current, t, index, total);
  if (over > 0) {
    current = { ...current, pageFit: "compact" };
    over = await measurePage(current, t, index, total);
  }
  for (let round = 0; round < 2 && over > 0; round++) {
    const stack = current.stack ?? [];
    const longest = stack.reduce((best, b, i) => (textLength(b) > textLength(stack[best]) ? i : best), 0);
    // A little more than the overrun, so one round usually does it.
    const chars = Math.ceil(over * CHARS_PER_PT * 1.25) + 40;
    const shorter = await resize.shorten(stack[longest], chars).catch(() => null);
    if (!shorter || shorter.type !== stack[longest].type) break;
    current = { ...current, stack: stack.map((b, i) => (i === longest ? keepAssets(shorter, b) : b)) };
    over = await measurePage(current, t, index, total);
  }
  if (over > 0) {
    current = { ...current, pageFit: "tight" };
    over = await measurePage(current, t, index, total);
  }
  return { slide: current, over: Math.max(0, Math.round(over)) };
}

/** Room at the bottom of a page worth filling, in pt: about three lines of text. */
const ROOM = 45;

/**
 * Fill each page before the next one starts (Mario, 7 Oct 2026: "saturate
 * the first page before going to the second"). While a page has room at
 * the bottom, the next page's first block moves up when it fits whole; a
 * section that does not fit gives its paragraphs one by one, under the same
 * label (the Lunar piece carries "Background" across both pages). A page is
 * never emptied, and a banner or a title never moves: it opens its page.
 * Measured at the regular setting, before the fit pass tightens anything.
 */
export async function pullForward(pages: Slide[], t: BrandTheme): Promise<Slide[]> {
  const out = pages.map((p) => ({ ...p, stack: [...(p.stack ?? [])] }));
  const total = out.length;
  const over = (p: Slide, i: number) => measurePage({ ...p, pageFit: "regular" }, t, i, total);
  for (let i = 0; i < out.length - 1; i++) {
    for (let guard = 0; guard < 12; guard++) {
      if (-(await over(out[i], i)) < ROOM) break;
      const next = out[i + 1].stack!;
      const head = next[0];
      if (!head || next.length < 2 || head.type === "banner" || head.type === "title") break;
      const whole = { ...out[i], stack: [...out[i].stack!, head] };
      if ((await over(whole, i)) <= 0) {
        out[i] = whole;
        out[i + 1] = { ...out[i + 1], stack: next.slice(1) };
        continue;
      }
      // Too long whole: a section gives its first paragraph, kept under its label.
      if (head.type !== "section" || (head.items?.length ?? 0) < 2) break;
      const last = out[i].stack![out[i].stack!.length - 1];
      const sameRun = last?.type === "section" && last.rail === head.rail;
      const moved = head.items![0];
      const here = sameRun
        ? [...out[i].stack!.slice(0, -1), { ...last, items: [...(last.items ?? []), moved] }]
        : [...out[i].stack!, { ...head, items: [moved] }];
      const tryPage = { ...out[i], stack: here };
      if ((await over(tryPage, i)) > 0) break;
      out[i] = tryPage;
      out[i + 1] = { ...out[i + 1], stack: [{ ...head, items: head.items!.slice(1) }, ...next.slice(1)] };
    }
  }
  return out;
}

/** Blocks whose rows can run on to the next page; the rest move whole. */
const SPLITS = new Set(["section", "table", "numbered", "compare", "asks", "contacts"]);

/**
 * A page that runs past its sheet carries on to the next one (Mario, 7 Oct
 * 2026: "if the table goes on, continue it on the next page"), never a
 * warning. Each page is drawn off-screen; at the first block that crosses
 * the bottom, its rows from the first one that does not fit move to the top
 * of the next page as the same block (a table keeps its header, a section
 * runs on without its label); a block that cannot split, or whose first row
 * does not fit, moves whole. No next page: one is added. Cascades to the end.
 * A page's opening block never moves, so a page is never emptied.
 * Returns null when every page already fits.
 */
export async function flowOver(pages: Slide[], t: BrandTheme): Promise<Slide[] | null> {
  if (!host) await measurePage(pages[0], t, 0, pages.length);
  const out = pages.map((p) => ({ ...p, stack: [...(p.stack ?? [])] }));
  let changed = false;
  for (let i = 0; i < out.length && i < 12; i++) {
    host!.innerHTML = renderPage(out[i], t, { index: i, total: out.length });
    await document.fonts.ready;
    const zone = host!.querySelector<HTMLElement>("[data-page-zone]");
    if (!zone || (measureFlow(host!) ?? 0) <= 1) continue;
    const limit = zone.getBoundingClientRect().bottom + 1;
    const blocks = [...host!.querySelectorAll<HTMLElement>("[data-page-flow] > [data-block]")];
    const b = blocks.findIndex((n) => n.getBoundingClientRect().bottom > limit);
    if (b < 0) continue;
    const stack = out[i].stack;
    const block = stack[b];
    let carry: PageBlock[];
    let keep: PageBlock[];
    const rows = (block.items ?? []).map((_, k) => host!.querySelector<HTMLElement>(`[data-item="stack.${b}.items.${k}"]`));
    const k = SPLITS.has(block.type) ? rows.findIndex((n) => !!n && n.getBoundingClientRect().bottom > limit) : -1;
    // Two columns compared run on by line: each column keeps the lines that
    // fit (a subhead never stays alone at the bottom), the rest continue on
    // the next page under no heads.
    const panelSplit = block.type === "panels" ? splitPanels(block, b, limit) : null;
    if (panelSplit) {
      keep = [...stack.slice(0, b), panelSplit.keep];
      carry = [panelSplit.rest, ...stack.slice(b + 1)];
    } else if (k >= 1) {
      keep = [...stack.slice(0, b), { ...block, items: block.items!.slice(0, k) }];
      const rest: PageBlock = { ...block, items: block.items!.slice(k) };
      // A section runs on under no label; a table keeps its column heads.
      if (block.type === "section" || block.type === "numbered") rest.rail = "";
      carry = [rest, ...stack.slice(b + 1)];
    } else if (b >= 1) {
      keep = stack.slice(0, b);
      carry = stack.slice(b);
    } else continue;
    out[i] = { ...out[i], stack: keep };
    if (i + 1 < out.length) out[i + 1] = { ...out[i + 1], stack: [...carry, ...(out[i + 1].stack ?? [])] };
    else out.push({ id: "", layoutId: out[i].layoutId, footerLabel: out[i].footerLabel, stack: carry });
    changed = true;
  }
  host!.innerHTML = "";
  return changed ? out : null;
}

/** Where a two-column block breaks at the bottom of the page, or null when no line fits. */
function splitPanels(block: PageBlock, b: number, limit: number): { keep: PageBlock; rest: PageBlock } | null {
  const items = block.items ?? [];
  const cut = items.map((it, i) => {
    const lines = it.body.split("\n").filter((l) => l.trim());
    let k = lines.findIndex((_, j) => {
      const n = host!.querySelector<HTMLElement>(`[data-block="${b}"] [data-line="${i}.${j}"]`);
      return !!n && n.getBoundingClientRect().bottom > limit;
    });
    if (k < 0) k = lines.length;
    // A subhead goes with what follows it.
    while (k > 0 && k < lines.length && /^#\s/.test(lines[k - 1])) k--;
    return { lines, k };
  });
  if (cut.every((c) => c.k >= c.lines.length) || cut.every((c) => c.k === 0)) return null;
  return {
    keep: { ...block, items: items.map((it, i) => ({ ...it, body: cut[i].lines.slice(0, cut[i].k).join("\n") })) },
    rest: { ...block, cont: true, items: items.map((it, i) => ({ ...it, body: cut[i].lines.slice(cut[i].k).join("\n") })) },
  };
}
