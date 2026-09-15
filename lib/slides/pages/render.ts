import type { BrandTheme } from "../brand";
import type { Slide } from "../schema";
import { A4, GRID, pageFooter, pageHeader, pageSection, pt } from "./a4";
import { BLOCKS, spaceBetween } from "./blocks";
import type { PageBlock } from "./schema";

export interface PageCtx {
  index: number;
  total: number;
}

/**
 * A page carries the masthead when it opens with a title. That is true of all
 * ten approved boards — the first page of each piece has the lockup and a
 * title, the continuation pages have neither — and it saves a page-level flag
 * that would only ever repeat what the first block already says.
 */
export function hasHeader(stack: PageBlock[] | undefined): boolean {
  return stack?.[0]?.type === "title";
}

/** Stack the blocks and report where the last one ends. */
function stackBlocks(stack: PageBlock[], t: BrandTheme): { html: string; bottom: number } {
  const parts: string[] = [];
  let y = hasHeader(stack) ? GRID.contentTop : GRID.contentTopBare;
  stack.forEach((block, i) => {
    const def = BLOCKS[block.type];
    if (!def) return;
    if (i > 0) y += spaceBetween(stack[i - 1].type, block.type);
    const { html, height } = def.render(block, { t, path: `stack.${i}` });
    parts.push(
      `<div data-block="${i}" style="position:absolute;left:0;top:${pt(y)};width:${pt(A4.w)};height:${pt(height)};">${html}</div>`,
    );
    y += height;
  });
  return { html: parts.join(""), bottom: y };
}

/**
 * The two-pager page renderer: header (when the page opens with a title), the
 * block stack, the footer.
 *
 * Block heights are estimated from the text, not measured, so a page can run
 * past the content zone. It is clipped rather than reflowed — the editor reads
 * `data-page-overflow` off the section and tells the user to cut something,
 * because silently pushing content onto a page the user did not ask for is
 * worse than saying it does not fit.
 */
export function renderPage(slide: Slide, t: BrandTheme, ctx?: PageCtx): string {
  const stack = slide.stack ?? [];
  const { html, bottom } = stackBlocks(stack, t);
  const over = bottom > GRID.contentBottom;
  const inner =
    (hasHeader(stack) ? pageHeader() : "") +
    html +
    pageFooter(slide.footerLabel ?? "", t.footerLabel, ctx?.index ?? 0);
  const page = pageSection(t, inner);
  return over ? page.replace("<section ", `<section data-page-overflow="${Math.round(bottom - GRID.contentBottom)}" `) : page;
}
