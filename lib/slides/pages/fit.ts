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
