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
  // Contacts close the page at its foot (Mario, 14 Oct 2026: "we put the
  // contacts at the end of the page"), wherever the text above them ends.
  const footAt = stack.length > 1 && stack[stack.length - 1].type === "contacts" ? stack.length - 1 : -1;
  const draw = (block: (typeof stack)[number], i: number, gap: number) => {
    const render = BLOCKS[block.type];
    return render ? `<div data-block="${i}" style="position:relative;margin-top:${pt(gap)};">${render(block, { t, d, path: `stack.${i}` })}</div>` : "";
  };
  const flow = stack
    .map((block, i) => (i === footAt ? "" : draw(block, i, i === 0 ? 0 : spaceBefore(stack[i - 1].type, block.type, d))))
    .join("");
  const foot = footAt >= 0 ? draw(stack[footAt], footAt, 0) : "";
  const chrome =
    (first ? pageMasthead(t, slide.pageDate || pageDateNow(), slide.pageLogo) : "") +
    pageFooter(slide.footerLabel ?? "", t.footerLabel, ctx?.index ?? 0);
  return pageSection(t, first ? GRID.topFirst : GRID.topBare, chrome, flow, foot, footAt >= 0 ? spaceBefore(stack[footAt - 1].type, "contacts", d) : 0);
}
