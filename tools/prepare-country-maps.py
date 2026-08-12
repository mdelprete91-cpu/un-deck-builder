#!/usr/bin/env python3
"""
Turn the raw Giga Maps country exports into slide-ready assets.

The raw exports (3092x1590 JPEGs, one per country) are screenshots at a fixed
viewport, so the country lands wherever it lands: Rwanda is centred, Anguilla
sits in the bottom-right corner with two thirds of the frame empty. Dropped
into the template's 1720x572 map slot, which is object-fit: cover, the badly
framed ones lose their country to the crop.

So: find the school dots (the only saturated pixels on a grey basemap), crop
around them, and letterbox out to the slot's exact ratio. Never upscale — the
crop is clamped to at least the slot's pixel size, so a tiny island ends up
centred in a full-resolution frame rather than blown up and soft.

    python3 tools/prepare-country-maps.py ~/Desktop/giga-country-maps/2x

Writes public/country-maps/<slug>.jpg. Re-run it when new countries arrive,
then update COUNTRY_MAPS in lib/slides/country-maps.ts to match.
"""

import sys
import unicodedata
from pathlib import Path

from PIL import Image

# The template's map slot (see worldMap/photo in lib/slides/layouts/basic.ts).
SLOT_W, SLOT_H = 1720, 572
SLOT_RATIO = SLOT_W / SLOT_H

# A dot is a pixel with actual hue on an otherwise grey basemap.
SATURATION = 28
# Breathing room around the dots, as a share of the dot cloud's size.
PADDING = 0.10
QUALITY = 82
# The widest a map is ever drawn is the 1720px slot; no point shipping more.
MAX_W = SLOT_W
THUMB_W = 420


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    out = "".join(c if c.isalnum() else "-" for c in ascii_name.lower())
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def dot_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    """Bounding box of the saturated pixels, or None on a map with no dots."""
    rgb = im.convert("RGB")
    r, g, b = rgb.split()
    # max(r,g,b) - min(r,g,b): 0 on any grey, high on the green/red/blue dots.
    from PIL import ImageChops

    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    return ImageChops.difference(hi, lo).point(lambda v: 255 if v > SATURATION else 0).getbbox()


def frame(box: tuple[int, int, int, int], w: int, h: int) -> tuple[int, int, int, int]:
    """
    Pad the dot cloud and clamp it inside the source.

    The one rule that matters: the crop always contains every dot. Forcing the
    slot's 3:1 ratio here would decapitate the tall countries (Rwanda's dots
    span 1400 of the 1590 rows, and 1400 x 3:1 is wider than the export), so
    the asset keeps the country's own shape and the slide's CSS does the
    fitting. Nothing is ever upscaled: the window is at least slot-sized.
    """
    x0, y0, x1, y1 = box
    pad_x, pad_y = (x1 - x0) * PADDING, (y1 - y0) * PADDING
    x0, y0, x1, y1 = x0 - pad_x, y0 - pad_y, x1 + pad_x, y1 + pad_y

    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box_w = min(max(x1 - x0, SLOT_W), w)
    box_h = min(max(y1 - y0, SLOT_H), h)

    # Slide the window back inside the frame rather than shrinking it.
    left = min(max(cx - box_w / 2, 0), w - box_w)
    top = min(max(cy - box_h / 2, 0), h - box_h)
    return (round(left), round(top), round(left + box_w), round(top + box_h))


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    src = Path(sys.argv[1]).expanduser()
    out = Path(__file__).resolve().parent.parent / "public" / "country-maps"
    thumbs = out / "thumbs"
    out.mkdir(parents=True, exist_ok=True)
    thumbs.mkdir(parents=True, exist_ok=True)

    files = sorted(p for p in src.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if not files:
        print(f"no images in {src}")
        return 1

    total = 0
    for path in files:
        im = Image.open(path)
        box = dot_bbox(im)
        note = ""
        if box is None:  # no schools plotted: keep the export centred as-is
            box = (0, 0, im.size[0], im.size[1])
            note = "  (no dots found, centred)"
        crop = im.crop(frame(box, *im.size)).convert("RGB")
        if crop.size[0] > MAX_W:
            crop = crop.resize((MAX_W, round(crop.size[1] * MAX_W / crop.size[0])), Image.LANCZOS)

        slug = slugify(path.stem)
        dest = out / f"{slug}.jpg"
        crop.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)

        # Thumbnail for the picker grid: 54 full maps would be megabytes on open.
        thumb = crop.copy()
        thumb.thumbnail((THUMB_W, THUMB_W), Image.LANCZOS)
        thumb.save(thumbs / f"{slug}.jpg", "JPEG", quality=72, optimize=True)

        kb = dest.stat().st_size / 1024
        total += kb + thumbs.joinpath(f"{slug}.jpg").stat().st_size / 1024
        print(f"{path.stem:<34} -> {dest.name:<34} {crop.size[0]}x{crop.size[1]} {kb:6.0f} KB{note}")

    print(f"\n{len(files)} maps + thumbnails, {total / 1024:.1f} MB total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
