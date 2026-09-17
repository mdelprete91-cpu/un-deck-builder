import PptxGenJS from "pptxgenjs";
import { rasterizeSlide } from "./rasterize";
import { addNativeSlide } from "./pptx-native";
import type { Slide } from "./schema";
import type { BrandTheme } from "./brand";
import { renderSlide } from "./layouts";
import { autofitAll } from "./autofit";

/**
 * Export the deck as a .pptx with editable text.
 *
 * Each slide is rendered offscreen at 1920x1080 by the same renderer the
 * editor uses. Every editable field (`data-edit`) is measured in that DOM
 * after autofit: box, font, size, weight, colour, alignment, line height.
 * Those nodes are then hidden, the slide is captured to a PNG that becomes
 * the full-bleed background, and each field comes back as a PowerPoint text
 * box in the same place with the same type. Photos, charts, maps, logos and
 * the template geometry stay in the picture; the words are real text.
 *
 * No model call anywhere in here: the deck is already data.
 *
 * Units: the slide is 13.333in x 7.5in, so 1920px = 13.333in → 144px per inch,
 * and 1px = 0.5pt. Manrope and Open Sans are referenced by name; a machine
 * without them falls back to the office defaults.
 */
const PX_PER_IN = 144;
const PT_PER_PX = 0.5;
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;

interface TextBox {
  node: HTMLElement;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontFace: string;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineSpacingMultiple: number;
  charSpacingPt: number;
}

export async function exportPptxDeck(
  slides: Slide[],
  theme: BrandTheme,
  title: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Two layers on purpose. The outer one parks the work offscreen; the inner
  // one is what gets captured. html-to-image copies the captured node's own
  // computed style into the SVG it rasterises, so capturing the offscreen
  // node itself carries "left:-20000px" along and yields a blank picture.
  const outer = document.createElement("div");
  outer.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1920px;height:1080px;overflow:hidden;pointer-events:none;";
  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff;";
  outer.appendChild(host);
  document.body.appendChild(outer);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "GIGA_16_9", width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = "GIGA_16_9";
  pptx.title = title;

  try {
    await document.fonts.ready;
    for (let i = 0; i < slides.length; i++) {
      host.innerHTML = renderSlide(slides[i], theme, { index: i, total: slides.length });
      await withTimeout(waitForImages(host), 8000, "images");
      autofitAll(host);
      const slide = pptx.addSlide();
      try {
        // Native objects, read off the DOM. A slide the walker cannot handle
        // falls back to the picture-plus-text-boxes form below, so one odd
        // layout never stops the export.
        await withTimeout(addNativeSlide(pptx, slide, host), 30000, "native conversion");
      } catch (err) {
        console.warn(`[pptx] slide ${i + 1}: native conversion failed, using the picture`, err);
        // pptxgenjs cannot remove a slide: empty what the walker managed to add.
        (slide as unknown as { _slideObjects: unknown[] })._slideObjects = [];
        const boxes = collectTextBoxes(host);
        boxes.forEach((b) => (b.node.style.visibility = "hidden"));
        const png = await captureSlide(host, i, slides[i]?.title);
        slide.addImage({ data: png, x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN });
        for (const b of boxes) slide.addText(runsFor(b.text), textOptions(b));
      }
      onProgress?.(i + 1, slides.length);
    }
    const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deck"}.pptx`;
    await pptx.writeFile({ fileName });
  } finally {
    outer.remove();
  }
}

/**
 * Every editable field on the rendered slide, measured after autofit. A field
 * nested in another editable field belongs to its parent's text; hidden,
 * empty or zero-size fields are not text boxes.
 */
function collectTextBoxes(host: HTMLElement): TextBox[] {
  const hostRect = host.getBoundingClientRect();
  const out: TextBox[] = [];
  host.querySelectorAll<HTMLElement>("[data-edit]").forEach((node) => {
    if (node.parentElement?.closest("[data-edit]")) return;
    if (node.offsetParent === null && getComputedStyle(node).position !== "fixed") return;
    const text = node.innerText.replace(/ /g, " ").replace(/\s+$/g, "");
    if (!text.trim()) return;
    const cs = getComputedStyle(node);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return;
    const r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const fontSize = parseFloat(cs.fontSize);
    const lineHeight = cs.lineHeight === "normal" ? fontSize * 1.2 : parseFloat(cs.lineHeight);
    const letterSpacing = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) || 0;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    out.push({
      node,
      text,
      x: r.left - hostRect.left + padL,
      y: r.top - hostRect.top + padT,
      // A few px of slack on the right: office text engines measure a hair
      // wider than the browser, and a box that is too tight wraps a word.
      w: Math.max(1, r.width - padL - padR + 6),
      h: Math.max(1, r.height - padT - padB),
      fontFace: fontFaceOf(cs.fontFamily),
      fontSizePt: fontSize * PT_PER_PX,
      bold: weight >= 600,
      italic: cs.fontStyle === "italic",
      color: hexOf(cs.color),
      align: alignOf(cs.textAlign),
      lineSpacingMultiple: lineHeight / fontSize,
      charSpacingPt: letterSpacing * PT_PER_PX,
    });
  });
  return out;
}

function textOptions(b: TextBox): PptxGenJS.TextPropsOptions {
  return {
    x: b.x / PX_PER_IN,
    y: b.y / PX_PER_IN,
    w: b.w / PX_PER_IN,
    h: b.h / PX_PER_IN,
    fontFace: b.fontFace,
    fontSize: round2(b.fontSizePt),
    bold: b.bold,
    italic: b.italic,
    color: b.color,
    align: b.align,
    valign: "top",
    margin: 0,
    lineSpacingMultiple: round2(b.lineSpacingMultiple),
    charSpacing: b.charSpacingPt ? round2(b.charSpacingPt) : undefined,
    autoFit: false,
    shrinkText: false,
    wrap: true,
  };
}

/** Line breaks in the rendered text become hard breaks in the text box. */
function runsFor(text: string): PptxGenJS.TextProps[] {
  const lines = text.split("\n");
  return lines.map((line, i) => ({ text: line, options: { breakLine: i < lines.length - 1 } }));
}

function fontFaceOf(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
  return first || "Open Sans";
}

function hexOf(color: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (!m) return "000000";
  return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function alignOf(textAlign: string): "left" | "center" | "right" {
  if (textAlign === "center") return "center";
  if (textAlign === "right" || textAlign === "end") return "right";
  return "left";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One try, one timeout, and an error that names the slide. */
async function captureSlide(host: HTMLElement, index: number, title: string | undefined): Promise<string> {
  try {
    return await withTimeout(rasterizeSlide(host), 15000, "capture");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const name = title?.trim() ? `"${title.trim()}"` : "";
    throw new Error(
      `slide ${index + 1} ${name} failed to capture (${detail}). The other slides are fine; try removing or replacing that slide's image and export again.`,
    );
  }
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

/** Never hang the export on one slide: a step that stalls becomes an error. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
