import { autofitAll } from "./autofit";
import type { BrandTheme } from "./brand";
import { waitForImages, withTimeout } from "./export-pptx";
import { renderSlide } from "./layouts";
import type { SourceSlide } from "./pptx-source";
import { rasterizeSlide } from "./rasterize";
import { isPage, type Slide } from "./schema";
import { chapterAt } from "./chapters";

/**
 * The two contact sheets of a replica's visual check (replica-check.ts):
 * the source's pages and the replica's slides, each a grid of small tiles
 * numbered in red in the corner, as one JPEG. Drawn in the browser, no
 * model call.
 *
 * A PDF source is drawn as it is (pdf.js). A PowerPoint file is not kept
 * after it is read and no browser can draw one, so its sheet is a plan of
 * each slide drawn from where the reader found things (`SourceSlide.boxes`):
 * the title, each text box with its first words, tables as rows, charts,
 * and every picture as a hatched block. That is the shape the replica must
 * keep, which is what the check compares.
 */

const TILE_W = 360;

type Tile = HTMLCanvasElement;

function tile(w: number, h: number): { c: Tile; x: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  if (!x) throw new Error("no 2d canvas context");
  return { c, x };
}

/** The tiles in a numbered grid, as a JPEG data URL. */
export function composeSheet(tiles: Tile[]): string {
  if (!tiles.length) return "";
  const cols = tiles.length > 6 ? 4 : 3;
  const gap = 14;
  const h = Math.max(...tiles.map((t) => t.height));
  const rows = Math.ceil(tiles.length / cols);
  const { c, x } = tile(cols * (TILE_W + gap) + gap, rows * (h + gap) + gap);
  x.fillStyle = "#c8c8c8";
  x.fillRect(0, 0, c.width, c.height);
  tiles.forEach((t, i) => {
    const px = gap + (i % cols) * (TILE_W + gap);
    const py = gap + Math.floor(i / cols) * (h + gap);
    x.drawImage(t, px, py, TILE_W, (t.height * TILE_W) / t.width);
    x.fillStyle = "#dc003c";
    x.fillRect(px, py, 40, 30);
    x.fillStyle = "#ffffff";
    x.font = "bold 20px Helvetica, Arial, sans-serif";
    x.fillText(String(i + 1), px + 8, py + 22);
  });
  return c.toDataURL("image/jpeg", 0.72);
}

/** A PowerPoint slide's plan, from its boxes. */
function planTile(s: SourceSlide): Tile {
  const W = TILE_W;
  const H = Math.round(W * 0.5625);
  const { c, x } = tile(W, H);
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, W, H);
  const r = (b: { x: number; y: number; w: number; h: number }) => [b.x * W, b.y * H, b.w * W, b.h * H] as const;
  const boxes = s.boxes ?? [];
  // Pictures first, under the text, hatched.
  for (const b of boxes.filter((b) => b.kind === "image")) {
    const [bx, by, bw, bh] = r(b);
    x.fillStyle = "#d9dee8";
    x.fillRect(bx, by, bw, bh);
    x.strokeStyle = "#9aa6bb";
    x.lineWidth = 1;
    x.save();
    x.beginPath();
    x.rect(bx, by, bw, bh);
    x.clip();
    for (let d = -bh; d < bw; d += 8) {
      x.beginPath();
      x.moveTo(bx + d, by + bh);
      x.lineTo(bx + d + bh, by);
      x.stroke();
    }
    x.restore();
    if (bw > 40 && bh > 16) {
      x.fillStyle = "#56607a";
      x.font = "10px Helvetica, Arial, sans-serif";
      x.fillText("image", bx + 4, by + 12);
    }
  }
  for (const b of boxes.filter((b) => b.kind !== "image")) {
    const [bx, by, bw, bh] = r(b);
    x.strokeStyle = b.kind === "chart" ? "#277aff" : "#b5b5b5";
    x.lineWidth = 1;
    x.strokeRect(bx, by, bw, bh);
    if (b.kind === "chart") {
      x.fillStyle = "#277aff";
      for (let k = 0; k < 4; k++) {
        const bar = bh * (0.3 + 0.15 * k);
        x.fillRect(bx + 6 + k * (bw / 5), by + bh - bar - 2, bw / 8, bar);
      }
      continue;
    }
    if (b.kind === "table") {
      const rows = Math.max(1, b.lines.length);
      x.strokeStyle = "#d0d0d0";
      for (let k = 1; k < rows; k++) {
        x.beginPath();
        x.moveTo(bx, by + (bh * k) / rows);
        x.lineTo(bx + bw, by + (bh * k) / rows);
        x.stroke();
      }
    }
    // The first words of the box, as many lines as fit.
    x.fillStyle = "#333333";
    x.font = "9px Helvetica, Arial, sans-serif";
    const text = b.lines.join(" · ");
    let line = "";
    let ly = by + 10;
    for (const w of text.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (x.measureText(t).width > bw - 6) {
        x.fillText(line, bx + 3, ly);
        line = w;
        ly += 10;
        if (ly > by + bh - 2) break;
      } else line = t;
    }
    if (ly <= by + bh - 2 && line) x.fillText(line, bx + 3, ly);
  }
  // A slide whose title has no box of its own: the title on top.
  if (s.title && !boxes.some((b) => b.lines.includes(s.title))) {
    x.fillStyle = "#111111";
    x.font = "bold 13px Helvetica, Arial, sans-serif";
    x.fillText(s.title.slice(0, 60), 12, 22);
  }
  return c;
}

/** The PowerPoint source as plans, one tile a slide. */
export function sourceSheetFromSlides(slides: SourceSlide[]): string {
  return composeSheet(slides.map(planTile));
}

/** A PDF source as it is, its first `limit` pages. */
export async function sourceSheetFromPdf(base64: string, limit = 40): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const tiles: Tile[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, limit); n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: TILE_W / page.getViewport({ scale: 1 }).width });
    const { c, x } = tile(Math.round(vp.width), Math.round(vp.height));
    await page.render({ canvasContext: x, viewport: vp, canvas: c } as unknown as Parameters<typeof page.render>[0]).promise;
    tiles.push(c);
  }
  return composeSheet(tiles);
}

/** The replica's slides (or A4 pages), drawn small offscreen as the export draws them. */
export async function resultSheet(slides: Slide[], theme: BrandTheme): Promise<string> {
  const pages = slides.some((s) => isPage(s));
  const [w, h] = pages ? [793, 1123] : [1920, 1080];
  const outer = document.createElement("div");
  outer.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}px;height:${h}px;overflow:hidden;pointer-events:none;`;
  const host = document.createElement("div");
  host.style.cssText = `position:relative;width:${w}px;height:${h}px;overflow:hidden;background:#fff;`;
  outer.appendChild(host);
  document.body.appendChild(outer);
  const tiles: Tile[] = [];
  try {
    await document.fonts.ready;
    for (let i = 0; i < slides.length; i++) {
      host.innerHTML = renderSlide(slides[i], theme, { index: i, total: slides.length, chapter: chapterAt(slides, i) });
      await withTimeout(waitForImages(host), 8000, "images").catch(() => undefined);
      autofitAll(host);
      const png = await withTimeout(rasterizeSlide(host, w, h, undefined, TILE_W / w), 15000, "capture");
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = png;
      });
      const { c, x } = tile(img.width, img.height);
      x.drawImage(img, 0, 0);
      tiles.push(c);
    }
  } finally {
    outer.remove();
  }
  return composeSheet(tiles);
}
