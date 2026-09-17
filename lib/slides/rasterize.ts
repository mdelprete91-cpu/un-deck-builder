import { inlineAssets, inlineFontCss } from "./export-html";

/**
 * Turn a rendered slide (a live DOM node, 1920x1080) into a PNG data URL.
 *
 * The slide markup is inline-styled by rule, so the picture only needs the
 * markup itself, the template fonts and the box-model reset that the editor
 * applies to `.slide-root`. Those go into an SVG `foreignObject`, which the
 * browser rasterises onto a canvas. Images are inlined as data URIs first:
 * an SVG drawn as an image cannot load anything from the network.
 *
 * html-to-image did the same job and stalled for twenty seconds a slide on
 * this markup; the plain path takes a few milliseconds.
 */

/** The `.slide-root` rules from globals.css that affect geometry. Keep in step. */
const SLIDE_RESET_CSS =
  ".slide-root,.slide-root *{margin:0;padding:0;box-sizing:border-box;}" +
  ".slide-root [data-icon-pick]{padding:8px;margin:-8px;}";

let fontCssPromise: Promise<string> | null = null;

/** Fonts as data URIs, fetched once per page. */
function fontCss(): Promise<string> {
  if (!fontCssPromise) fontCssPromise = inlineFontCss();
  return fontCssPromise;
}

export async function rasterizeSlide(
  stage: HTMLElement,
  width = 1920,
  height = 1080,
  /** Return only this region of the slide, as a picture of its own size. */
  crop?: { x: number; y: number; w: number; h: number },
): Promise<string> {
  const clone = stage.cloneNode(true) as HTMLElement;
  // Event-handler attributes are not XML and have no job in a picture.
  clone.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
  });
  const xhtml = await inlineAssets(new XMLSerializer().serializeToString(clone));
  const css = (await fontCss()) + SLIDE_RESET_CSS;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">` +
    `<style>${css}</style>${xhtml}</div></foreignObject></svg>`;

  // A data URL, not a blob URL: Chrome taints the canvas for an SVG with a
  // foreignObject that came from a blob, and toDataURL then throws.
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement("canvas");
  const cw = crop ? Math.max(1, Math.round(crop.w)) : width;
  const ch = crop ? Math.max(1, Math.round(crop.h)) : height;
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas context");
  if (crop) ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, cw, ch);
  else ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the slide picture could not be rendered"));
    img.src = src;
  });
}
