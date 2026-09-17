import type PptxGenJS from "pptxgenjs";
import { rasterizeSlide } from "./rasterize";

/**
 * A slide as native PowerPoint objects, read off the rendered DOM.
 *
 * There is no second description of the template here. The walker takes the
 * slide the editor's renderer produced, measures every node after autofit,
 * and translates it: a box with a fill, border or rounded corners becomes a
 * shape; a text leaf becomes a text box; an image, an inline SVG icon, or
 * anything CSS can draw but PowerPoint cannot (a conic gradient, a filter, a
 * cropped and zoomed photo) is rasterised on its own and placed as a picture
 * of exactly its size. Change a renderer and the export follows.
 *
 * Units: 1920px = 13.333in, so 144px per inch and 1px = 0.5pt.
 */
const PX_PER_IN = 144;
const PT_PER_PX = 0.5;
const SLIDE_W = 1920;
const SLIDE_H = 1080;

const INLINE_TAGS = new Set(["SPAN", "B", "STRONG", "I", "EM", "BR", "SUP", "SUB", "U", "SMALL"]);

interface Ctx {
  pptx: PptxGenJS;
  slide: PptxGenJS.Slide;
  stage: HTMLElement;
  origin: DOMRect;
}

export async function addNativeSlide(pptx: PptxGenJS, slide: PptxGenJS.Slide, stage: HTMLElement): Promise<void> {
  const root = (stage.firstElementChild as HTMLElement | null) ?? stage;
  const ctx: Ctx = { pptx, slide, stage, origin: stage.getBoundingClientRect() };
  const rootBg = rgba(getComputedStyle(root).backgroundColor);
  if (rootBg && rootBg.a > 0) slide.background = { color: rootBg.hex };
  for (const child of Array.from(root.children)) await walk(ctx, child as HTMLElement, 1);
}

async function walk(ctx: Ctx, el: HTMLElement, opacity: number): Promise<void> {
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  const own = parseFloat(cs.opacity);
  const alpha = opacity * (Number.isNaN(own) ? 1 : own);
  if (alpha <= 0) return;
  const rect = relRect(ctx, el);
  if (rect.w < 0.5 || rect.h < 0.5) return;

  // Pictures first: an <img>, an icon, or a node CSS draws in a way
  // PowerPoint has no shape for. The framed photo's clipping box is
  // rasterised as one, so crop and zoom survive.
  if (el.tagName === "IMG") {
    const frame = photoFrame(el);
    await addRaster(ctx, frame ?? el, relRect(ctx, frame ?? el), alpha);
    return;
  }
  if (el instanceof SVGElement) {
    await addRaster(ctx, el as unknown as HTMLElement, rect, alpha);
    return;
  }
  if (needsRaster(cs)) {
    await addRaster(ctx, el, rect, alpha);
    return;
  }

  addBox(ctx, el, cs, rect, alpha);

  if (isTextLeaf(el)) {
    addText(ctx, el, cs, rect, alpha);
    return;
  }
  for (const child of Array.from(el.children)) {
    if (child instanceof HTMLElement || child instanceof SVGElement) await walk(ctx, child as HTMLElement, alpha);
  }
}

/** The overflow-hidden box that crops a framed photo, when the <img> has one. */
function photoFrame(img: HTMLElement): HTMLElement | null {
  const parent = img.parentElement;
  if (!parent || parent.children.length !== 1) return null;
  const cs = getComputedStyle(parent);
  return cs.overflow === "hidden" || cs.overflowX === "hidden" ? parent : null;
}

function needsRaster(cs: CSSStyleDeclaration): boolean {
  return (
    cs.backgroundImage !== "none" ||
    (cs.filter && cs.filter !== "none") ||
    (cs.transform !== "none" && !isRotationOnly(cs.transform)) ||
    cs.mixBlendMode !== "normal" ||
    (cs.clipPath && cs.clipPath !== "none") ||
    (cs.maskImage !== undefined && cs.maskImage !== "none")
  );
}

/** A node whose element children are all inline: its innerText is one text box. */
function isTextLeaf(el: HTMLElement): boolean {
  if (!el.innerText || !el.innerText.trim()) return false;
  const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  const allInline = Array.from(el.children).every((c) => INLINE_TAGS.has(c.tagName));
  if (!allInline) return false;
  if (hasText) return true;
  // No text of its own: a single inline child carrying the text still makes
  // this the box (it has the geometry and the font), so treat it as a leaf.
  return el.children.length > 0;
}

function addBox(ctx: Ctx, el: HTMLElement, cs: CSSStyleDeclaration, rect: Rect, alpha: number): void {
  const bg = rgba(cs.backgroundColor);
  const hasFill = !!bg && bg.a > 0;
  const sides = (["Top", "Right", "Bottom", "Left"] as const).map((side) => {
    const width = parseFloat(cs[`border${side}Width`]) || 0;
    const color = rgba(cs[`border${side}Color`]);
    const on = width > 0 && cs[`border${side}Style`] !== "none" && !!color && color.a > 0;
    return on ? { width, color: color! } : null;
  });
  const [top, right, bottom, left] = sides;
  const uniform =
    !!top && !!right && !!bottom && !!left &&
    sides.every((b) => b!.width === top.width && b!.color.hex === top.color.hex && b!.color.a === top.color.a);
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  const circle = radius >= Math.min(rect.w, rect.h) / 2 - 0.5 && Math.abs(rect.w - rect.h) < 1;
  const shape = circle ? ctx.pptx.ShapeType.ellipse : radius > 0 ? ctx.pptx.ShapeType.roundRect : ctx.pptx.ShapeType.rect;
  if (hasFill || uniform) {
    ctx.slide.addShape(shape, {
      x: rect.x / PX_PER_IN,
      y: rect.y / PX_PER_IN,
      w: rect.w / PX_PER_IN,
      h: rect.h / PX_PER_IN,
      fill: hasFill ? { color: bg!.hex, transparency: toTransparency(bg!.a * alpha) } : { type: "none" },
      line: uniform
        ? { color: top.color.hex, width: top.width * PT_PER_PX, transparency: toTransparency(top.color.a * alpha) }
        : { type: "none" },
      // pptxgenjs takes the corner radius as a fraction of the shorter side.
      ...(shape === ctx.pptx.ShapeType.roundRect ? { rectRadius: Math.min(0.5, radius / Math.min(rect.w, rect.h)) } : {}),
    });
  }
  if (uniform) return;
  // A rule on one side (a table row, an underline on a header) is a line
  // drawn along that edge, inside the box like the browser draws it.
  const edge = (b: { width: number; color: { hex: string; a: number } }, x: number, y: number, w: number, h: number) =>
    ctx.slide.addShape(ctx.pptx.ShapeType.line, {
      x: x / PX_PER_IN,
      y: y / PX_PER_IN,
      w: w / PX_PER_IN,
      h: h / PX_PER_IN,
      line: { color: b.color.hex, width: b.width * PT_PER_PX, transparency: toTransparency(b.color.a * alpha) },
    });
  if (top) edge(top, rect.x, rect.y + top.width / 2, rect.w, 0);
  if (bottom) edge(bottom, rect.x, rect.y + rect.h - bottom.width / 2, rect.w, 0);
  if (left) edge(left, rect.x + left.width / 2, rect.y, 0, rect.h);
  if (right) edge(right, rect.x + rect.w - right.width / 2, rect.y, 0, rect.h);
}

function addText(ctx: Ctx, el: HTMLElement, cs: CSSStyleDeclaration, rect: Rect, alpha: number): void {
  const text = leafText(el, cs);
  if (!text.trim()) return;
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const padB = parseFloat(cs.paddingBottom) || 0;
  const fontSize = parseFloat(cs.fontSize);
  const lineHeight = cs.lineHeight === "normal" ? fontSize * 1.2 : parseFloat(cs.lineHeight);
  const letterSpacing = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) || 0;
  const weight = parseInt(cs.fontWeight, 10) || 400;
  const color = rgba(cs.color);
  const angle = rotationOf(cs.transform);
  // A rotated node's bounding box is the rotated one; PowerPoint wants the
  // box as laid out, plus the angle, centred on the same point.
  const w = angle ? el.offsetWidth : rect.w;
  const h = angle ? el.offsetHeight : rect.h;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const lines = text.split("\n");
  ctx.slide.addText(
    lines.map((line, i) => ({ text: line, options: { breakLine: i < lines.length - 1 } })),
    {
      x: (angle ? cx - w / 2 : rect.x + padL) / PX_PER_IN,
      y: (angle ? cy - h / 2 : rect.y + padT) / PX_PER_IN,
      // Office text engines measure a hair wider than the browser: a few px
      // of slack keep the last word on its line.
      w: Math.max(1, (angle ? w : rect.w - padL - padR) + 6) / PX_PER_IN,
      h: Math.max(1, angle ? h : rect.h - padT - padB) / PX_PER_IN,
      rotate: angle ? ((angle % 360) + 360) % 360 : undefined,
      fontFace: fontFaceOf(cs.fontFamily),
      fontSize: round2(fontSize * PT_PER_PX),
      bold: weight >= 600,
      italic: cs.fontStyle === "italic",
      color: color?.hex ?? "000000",
      transparency: color ? toTransparency(color.a * alpha) : undefined,
      align: alignOf(cs.textAlign),
      valign: "top",
      margin: 0,
      lineSpacingMultiple: round2(lineHeight / fontSize),
      charSpacing: letterSpacing ? round2(letterSpacing * PT_PER_PX) : undefined,
      autoFit: false,
      shrinkText: false,
      wrap: true,
    },
  );
}

/**
 * The words of a text leaf. `innerText` is the browser's own rendering of
 * them (text-transform applied, `<br>` and `pre-line` as newlines), with one
 * catch: a flex or grid box blockifies its inline children, so innerText puts
 * a newline between "01 | " and the agenda entry that sit on one line. Those
 * are joined from the children instead.
 */
function leafText(el: HTMLElement, cs: CSSStyleDeclaration): string {
  const flexy = /flex|grid/.test(cs.display);
  const raw = flexy
    ? Array.from(el.childNodes)
        .map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent ?? "" : (n as HTMLElement).innerText ?? ""))
        .join("")
    : el.innerText;
  return raw.replace(/\u00a0/g, " ").replace(/\s+$/g, "");
}

/**
 * One element as a picture of its own size. The whole slide is rasterised
 * with every other node hidden and the slide background cleared, then cropped
 * to the element: that keeps inherited fonts, CSS variables and the element's
 * own crop and transforms exactly as the browser draws them.
 */
async function addRaster(ctx: Ctx, el: HTMLElement, rect: Rect, alpha: number): Promise<void> {
  const clone = ctx.stage.cloneNode(true) as HTMLElement;
  const target = mirror(ctx.stage, clone, el);
  if (!target) return;
  const keep = new Set<Element>();
  for (let n: Element | null = target; n && n !== clone; n = n.parentElement) keep.add(n);
  target.querySelectorAll("*").forEach((d) => keep.add(d));
  clone.querySelectorAll("*").forEach((n) => {
    if (!keep.has(n)) (n as HTMLElement).style.visibility = "hidden";
  });
  // The export host paints white behind the slide; the picture must not.
  clone.style.background = "transparent";
  const root = clone.firstElementChild as HTMLElement | null;
  if (root) root.style.background = "transparent";
  const png = await rasterizeSlide(clone, SLIDE_W, SLIDE_H, rect);
  ctx.slide.addImage({
    data: png,
    x: rect.x / PX_PER_IN,
    y: rect.y / PX_PER_IN,
    w: rect.w / PX_PER_IN,
    h: rect.h / PX_PER_IN,
    transparency: toTransparency(alpha),
  });
}

/** The node in `clone` that sits where `el` sits in `original`. */
function mirror(original: Element, clone: Element, el: Element): HTMLElement | null {
  const path: number[] = [];
  for (let n: Element | null = el; n && n !== original; n = n.parentElement) {
    const parent = n.parentElement;
    if (!parent) return null;
    path.unshift(Array.from(parent.children).indexOf(n));
  }
  let cur: Element = clone;
  for (const i of path) {
    const next = cur.children[i];
    if (!next) return null;
    cur = next;
  }
  return cur as HTMLElement;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function relRect(ctx: Ctx, el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - ctx.origin.left, y: r.top - ctx.origin.top, w: r.width, h: r.height };
}

function rgba(color: string): { hex: string; a: number } | null {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color);
  if (!m) return null;
  const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return { hex, a: m[4] === undefined ? 1 : parseFloat(m[4]) };
}

function toTransparency(alpha: number): number {
  return Math.round((1 - Math.max(0, Math.min(1, alpha))) * 100);
}

function isRotationOnly(transform: string): boolean {
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m) return false;
  const [a, b, c, d, e, f] = m[1].split(",").map((v) => parseFloat(v));
  // A pure rotation keeps unit scale and no translation.
  return Math.abs(a * a + b * b - 1) < 0.01 && Math.abs(c * c + d * d - 1) < 0.01 && Math.abs(e) < 0.5 && Math.abs(f) < 0.5;
}

function rotationOf(transform: string): number {
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m) return 0;
  const [a, b] = m[1].split(",").map((v) => parseFloat(v));
  const deg = Math.round((Math.atan2(b, a) * 180) / Math.PI);
  return deg === 0 ? 0 : deg;
}

function fontFaceOf(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
  return first || "Open Sans";
}

function alignOf(textAlign: string): "left" | "center" | "right" {
  if (textAlign === "center") return "center";
  if (textAlign === "right" || textAlign === "end") return "right";
  return "left";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
