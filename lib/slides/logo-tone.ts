import type { ImagePos } from "./schema";

/**
 * Contrast-aware footer logo, no AI involved: sample the pixels of the photo
 * that end up underneath the footer logo and pick the white or the dark logo
 * from their mean luminance.
 *
 * Geometry matches the three right-photo layouts (callout, section-image,
 * example-image-right): panel at x1080 w840 full height, logo anchored at
 * right:95px around y980. The sample rect is padded so DID's taller lockup
 * and every brand's width are covered.
 */

export type LogoTone = "light" | "dark"; // same semantics as footer surface: "dark" → white logo

const PANEL = { left: 1080, width: 840, height: 1080 };
/** Slide-space area under the footer logo, padded on every side. */
const LOGO_RECT = { x: 1540, y: 925, w: 310, h: 110 };
/** Mean luminance (0-255) above which the area counts as light. */
const LIGHT_THRESHOLD = 155;

const cache = new Map<string, LogoTone>();

function cacheKey(src: string, p: ImagePos): string {
  // Data URLs are huge; head+tail+length identifies them well enough.
  return `${p.x}|${p.y}|${p.zoom}|${src.length}|${src.slice(0, 48)}|${src.slice(-24)}`;
}

/**
 * Resolve the logo tone for a photo shown in the right panel, or null when
 * the image cannot be read (keep the layout's default in that case).
 */
export async function computeLogoTone(
  image: string | undefined,
  pos?: ImagePos,
): Promise<LogoTone | null> {
  const src = image ?? "/giga-placeholder.jpg";
  const p = pos ?? { x: 50, y: 50, zoom: 1 };
  const key = cacheKey(src, p);
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const img = await loadImage(src);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return null;

    // Undo the reframe transform: screen point → pre-scale element point.
    const ox = (PANEL.width * p.x) / 100;
    const oy = (PANEL.height * p.y) / 100;
    const toElement = (sx: number, sy: number) => ({
      x: ox + (sx - ox) / p.zoom,
      y: oy + (sy - oy) / p.zoom,
    });
    // Undo object-fit:cover with object-position: element point → image pixel.
    const s0 = Math.max(PANEL.width / iw, PANEL.height / ih);
    const offX = (PANEL.width - iw * s0) * (p.x / 100);
    const offY = (PANEL.height - ih * s0) * (p.y / 100);
    const toImage = (e: { x: number; y: number }) => ({
      x: (e.x - offX) / s0,
      y: (e.y - offY) / s0,
    });

    const a = toImage(toElement(LOGO_RECT.x - PANEL.left, LOGO_RECT.y));
    const b = toImage(toElement(LOGO_RECT.x - PANEL.left + LOGO_RECT.w, LOGO_RECT.y + LOGO_RECT.h));
    const sx = Math.max(0, Math.min(a.x, b.x));
    const sy = Math.max(0, Math.min(a.y, b.y));
    const sw = Math.min(iw, Math.max(a.x, b.x)) - sx;
    const sh = Math.min(ih, Math.max(a.y, b.y)) - sy;
    if (sw < 2 || sh < 2) return null;

    const W = 32;
    const H = 12;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Perceived luminance; transparent pixels count as white (the panel bg).
      const alpha = data[i + 3] / 255;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum * alpha + 255 * (1 - alpha);
    }
    const mean = sum / (data.length / 4);
    const tone: LogoTone = mean >= LIGHT_THRESHOLD ? "light" : "dark";
    cache.set(key, tone);
    return tone;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}
