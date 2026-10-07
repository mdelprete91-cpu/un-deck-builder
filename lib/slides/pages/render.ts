import type { BrandTheme } from "../brand";
import type { Slide } from "../schema";
import { DENSITY, GRID, pageDateNow, pageFooter, pageMasthead, pageSection, pt } from "./a4";
import { BLOCKS, spaceBefore } from "./blocks";
import type { PageFit } from "./schema";

export interface PageCtx {
  index: number;
  total: number;
}

/**
 * The two-pager page renderer: the masthead on the first page, the block
 * stack in normal flow inside the content zone, the footer.
 *
 * The flow is laid out by the browser, so nothing here estimates a height.
 * Whether the stack fits is measured afterwards (fit.ts): a page that runs
 * past the zone is clipped at its bottom edge and the editor says so, rather
 * than reflowing onto a page the user did not ask for.
 */
export function renderPage(slide: Slide, t: BrandTheme, ctx?: PageCtx): string {
  const stack = slide.stack ?? [];
  const fit: PageFit = slide.pageFit ?? "regular";
  const d = DENSITY[fit];
  const first = (ctx?.index ?? 0) === 0;
  const flow = stack
    .map((block, i) => {
      const render = BLOCKS[block.type];
      if (!render) return "";
      const gap = i === 0 ? 0 : spaceBefore(stack[i - 1].type, block.type, d);
      return `<div data-block="${i}" style="position:relative;margin-top:${pt(gap)};">${render(block, { t, d, path: `stack.${i}` })}</div>`;
    })
    .join("");
  const chrome =
    (first ? pageMasthead(t, slide.pageDate || pageDateNow(), slide.pageLogo) : "") +
    pageFooter(slide.footerLabel ?? "", t.footerLabel, ctx?.index ?? 0);
  return pageSection(t, first ? GRID.topFirst : GRID.topBare, chrome, flow);
}
