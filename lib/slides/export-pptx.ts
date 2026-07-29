import PptxGenJS from "pptxgenjs";
import { getFontEmbedCSS, toPng } from "html-to-image";
import type { Slide } from "./schema";
import type { BrandTheme } from "./brand";
import { renderSlide } from "./layouts";
import { autofitAll } from "./autofit";

/**
 * Export the deck as a real .pptx: each slide is rendered offscreen at
 * 1920x1080, captured to PNG and placed full-bleed on a 16:9 PowerPoint
 * slide. Pixel-perfect and on brand; text is not editable in PowerPoint
 * (that is the accepted v1 trade-off).
 */
export async function exportPptxDeck(
  slides: Slide[],
  theme: BrandTheme,
  title: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1920px;height:1080px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "GIGA_16_9", width: 13.333, height: 7.5 });
  pptx.layout = "GIGA_16_9";
  pptx.title = title;

  try {
    await document.fonts.ready;
    // Captures happen inside an SVG foreignObject, which does not see the
    // document's fonts: embed them once and reuse for every slide.
    host.innerHTML = renderSlide(slides[0], theme);
    const fontEmbedCSS = await getFontEmbedCSS(host);
    for (let i = 0; i < slides.length; i++) {
      host.innerHTML = renderSlide(slides[i], theme);
      await waitForImages(host);
      autofitAll(host);
      const png = await captureSlide(host, fontEmbedCSS, i, slides[i]?.title);
      pptx.addSlide().addImage({ data: png, x: 0, y: 0, w: 13.333, h: 7.5 });
      onProgress?.(i + 1, slides.length);
    }
    const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deck"}.pptx`;
    await pptx.writeFile({ fileName });
  } finally {
    host.remove();
  }
}

/**
 * html-to-image rejects with a raw DOM Event (not an Error) when a resource
 * inside the capture fails to decode; those failures are often transient, so
 * retry a couple of times and, if the slide still won't capture, throw a
 * message that names the slide instead of "[object Event]".
 */
async function captureSlide(
  host: HTMLElement,
  fontEmbedCSS: string,
  index: number,
  title: string | undefined,
): Promise<string> {
  const ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await toPng(host, { width: 1920, height: 1080, pixelRatio: 1, fontEmbedCSS });
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  const detail =
    lastErr instanceof Error
      ? lastErr.message
      : typeof Event !== "undefined" && lastErr instanceof Event
        ? "an image or font on this slide could not be rendered"
        : String(lastErr);
  const name = title?.trim() ? `"${title.trim()}"` : "";
  throw new Error(`slide ${index + 1} ${name} failed to capture (${detail}). The other slides are fine; try removing or replacing that slide's image and export again.`);
}

function waitForImages(root: HTMLElement): Promise<void> {
  const pending = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pending.length;
    const done = () => {
      if (--left === 0) resolve();
    };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  });
}
