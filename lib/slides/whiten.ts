/**
 * An uploaded partner logo made white for the partner slide's cyan surface
 * (Mario, 7 Oct 2026: "a PNG is turned white automatically"). Browser only.
 *
 * A transparent PNG keeps its shape and becomes white. A PNG or JPEG on a
 * light background loses the background: each pixel's opacity comes from
 * how much darker it is than the background, so anti-aliased edges stay
 * soft. An SVG is kept as it is: the renderer's filter already draws it
 * white, at any size.
 */
export async function whitenLogo(file: File): Promise<string> {
  const url = await readAsDataUrl(file);
  if (/svg/i.test(file.type) || /\.svg$/i.test(file.name)) return url;
  const img = await load(url);
  // Long side at most 800px: a logo cell is 240x100 at 1920 wide.
  const k = Math.min(1, 800 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const lum = (i: number) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  // Transparent already when any corner is: the shape is the alpha.
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const transparent = corners.some((i) => px[i + 3] < 200);
  // The background's lightness: the brightest corner; the ink's: the darkest pixel.
  const bg = Math.max(...corners.map(lum));
  let ink = 255;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) ink = Math.min(ink, lum(i));
  const span = Math.max(24, bg - ink);
  for (let i = 0; i < px.length; i += 4) {
    const a = transparent ? px[i + 3] : Math.round(255 * Math.min(1, Math.max(0, (bg - 8 - lum(i)) / (span - 8))));
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = a;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("That image could not be read"));
    img.src = src;
  });
}
