import { autofitAll } from "./autofit";
import { renderSlide } from "./layouts";
import type { BrandTheme } from "./brand";
import type { Slide } from "./schema";

/** The smallest text a high-density slide may show (the footnote's 17px is its own design). */
export const MIN_TEXT_PX = 18;

/** Every text's size after autofit, and how many budgets had to clip. Browser only. */
function measure(slide: Slide, theme: BrandTheme): { sizes: Map<string, number>; clipped: number } {
  const host = document.createElement("div");
  host.className = "slide-root";
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:1920px;height:1080px;overflow:hidden;pointer-events:none;visibility:hidden;";
  host.innerHTML = renderSlide(slide, theme);
  document.body.appendChild(host);
  try {
    autofitAll(host);
    const sizes = new Map<string, number>();
    host.querySelectorAll<HTMLElement>("[data-edit]").forEach((n) => {
      const path = n.getAttribute("data-edit")!;
      if (path === "notes") return;
      const px = parseFloat(getComputedStyle(n).fontSize);
      sizes.set(path, Math.min(px, sizes.get(path) ?? Infinity));
    });
    const clipped = [...host.querySelectorAll<HTMLElement>("[data-fit]")].filter((n) => n.style.overflow === "hidden").length;
    return { sizes, clipped };
  } finally {
    host.remove();
  }
}

/**
 * Whether `next` (the slide after an add) still fits: no text that was at
 * 18px or more drops under it, no new text lands under it, nothing clips
 * that did not clip before. Text already under 18px (a long paragraph the
 * user wrote) does not block an add that leaves it where it was.
 */
export function roomFor(current: Slide, next: Slide, theme: BrandTheme): boolean {
  const a = measure(current, theme);
  const b = measure(next, theme);
  if (b.clipped > a.clipped) return false;
  for (const [path, px] of b.sizes) {
    if (px >= MIN_TEXT_PX - 0.01) continue;
    const before = a.sizes.get(path);
    if (before === undefined || px < before - 0.1) return false;
  }
  return true;
}
