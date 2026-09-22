import type { Slide } from "../schema";
import { channelsFor } from "../schema";
import type { BrandTheme } from "../brand";
import {
  MANROPE,
  OPEN_SANS,
  BODY30,
  BODY32,
  esc,
  ed,
  dly,
  item,
  section,
  footer,
  coverFooter,
  coverFooterDark,
  photoPanel,
  framedImage,
  displayTitle,
  heading80,
} from "./shared";

export function cover(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    displayTitle(s.title ?? "", "title", "#000000", "", 600) +
      `<div class="ar" ${ed("subtitle", 200)} style="position:absolute;left:100px;top:718px;width:1720px;font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.1;letter-spacing:-.02em;color:#000000;animation-delay:.12s;">${esc(s.subtitle)}</div>` +
      coverFooter(t),
  );
}

export function agenda(s: Slide, t: BrandTheme): string {
  const items = (s.bullets ?? [])
    .map(
      (bullet, i) =>
        `<div class="ars" ${item(`bullets.${i}`)} style="padding:10px;height:73px;box-sizing:border-box;display:flex;align-items:center;margin-bottom:8px;font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.1;letter-spacing:-.02em;color:#FFFFFF;${dly(10 + i * 6)}"><span style="white-space:pre;">0${i + 1} | </span><span ${ed(`bullets.${i}`, 63)}>${esc(bullet)}</span></div>`,
    )
    .join("");
  return section(
    t,
    "var(--accent)",
    "#FFFFFF",
    `<div class="ar" ${ed("title", 780)} style="position:absolute;left:100px;top:100px;width:770px;font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1.05;letter-spacing:-.02em;color:#FFFFFF;">${esc(s.title ?? "Agenda")}</div>` +
      `<div style="position:absolute;left:920px;top:100px;width:925px;display:flex;flex-direction:column;">${items}</div>` +
      coverFooterDark(t),
  );
}

export function sectionDivider(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "var(--accent)",
    "#FFFFFF",
    displayTitle(s.title ?? "", "title", "#FFFFFF", "", 800) + footer(t, "dark"),
  );
}

export function bigStat(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "var(--accent-deep)",
    "#FFFFFF",
    `<div class="ar" ${ed("stat", 430)} style="position:absolute;left:100px;top:100px;width:1720px;font-family:${MANROPE};font-weight:500;font-size:200px;line-height:1;letter-spacing:-.02em;color:#FFFFFF;">${esc(s.stat)}</div>` +
      `<div class="ar" ${ed("support", 400)} style="position:absolute;left:100px;top:540px;width:1725px;font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.3;letter-spacing:-.02em;color:var(--accent-soft2);animation-delay:.14s;">${esc(s.support)}</div>` +
      footer(t, "dark"),
  );
}

export function quote(s: Slide, t: BrandTheme): string {
  return section(
    t,
    t.quoteBg,
    "#FFFFFF",
    `<div class="ar" ${ed("quote", 490)} style="position:absolute;left:100px;top:300px;width:1720px;font-family:${MANROPE};font-weight:600;font-size:75px;line-height:1.18;letter-spacing:-.02em;color:#FFFFFF;">“${esc(s.quote)}”</div>` +
      `<div class="ar" ${ed("author", 150)} style="position:absolute;left:102px;top:806px;width:1718px;font-family:${MANROPE};font-weight:600;font-size:43px;color:${t.quoteAuthor};animation-delay:.14s;">${esc(s.author)}</div>` +
      footer(t, "dark"),
  );
}

type ImageVariant = "deep" | "light" | "dark";

/**
 * The colored variant travels with the brand (`t.sectionImage`) because
 * Digital Impact Division runs these slides on white. "dark" is legacy: black
 * surfaces are banned (Giga no-black rule), so it renders like "deep".
 */
function imageVariant(
  variant: ImageVariant,
  t: BrandTheme,
): { bg: string; titleColor: string; bodyColor: string; surface: "light" | "dark" } {
  if (variant === "light") {
    return {
      bg: "var(--accent-light)",
      titleColor: "var(--accent-deep)",
      bodyColor: "#161616",
      surface: "light",
    };
  }
  const v = t.sectionImage;
  return { bg: v.bg, titleColor: v.title, bodyColor: v.body, surface: v.surface };
}

export function sectionImage(variant: ImageVariant) {
  return (s: Slide, t: BrandTheme): string => {
    const v = imageVariant(variant, t);
    return section(
      t,
      v.bg,
      v.bodyColor,
      photoPanel(1080, s.image, 840, s.imagePos, s.map) +
        // Title zone capped at 3 lines (3 × 88px); the body starts 8px below it
        // and owns all remaining height down to the footer.
        `<div class="ar" ${ed("title", 264)} style="position:absolute;left:100px;top:100px;width:880px;font-family:${MANROPE};font-weight:500;font-size:80px;line-height:1.1;letter-spacing:-.022em;color:${v.titleColor};">${esc(s.title)}</div>` +
        `<div class="ar" ${ed("body", 560)} style="position:absolute;left:102px;top:372px;width:880px;${BODY30}color:${v.bodyColor};animation-delay:.14s;">${esc(s.body)}</div>` +
        footer(t, v.surface, s.logoTone),
    );
  };
}

export function bodyCopy(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 2);
  const content = blocks.length
    ? blocks
        .map((b, i) => {
          const xs = blocks.length === 2 ? [100, 978] : [100];
          const width = blocks.length === 2 ? 842 : 1720;
          return (
            `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:394px;width:${width}px;${dly(12 + i * 6)}">` +
            `<div ${ed(`blocks.${i}.body`, 540)} style="${BODY30}">${esc(b.body)}</div>` +
            `</div>`
          );
        })
        .join("")
    : // Legacy decks saved before body-copy moved to blocks
      `<div class="ar" ${ed("body", 540)} style="position:absolute;left:100px;top:394px;width:1720px;column-count:2;column-gap:80px;${BODY30}animation-delay:.12s;">${esc(s.body)}</div>`;
  return section(t, "#FFFFFF", "#000000", heading80(s.title ?? "", "title", "#000000", 1720, 280) + content + footer(t, "light"));
}

/** Full-width photo (template "09 Foto"). */
export function photo(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000") +
      framedImage(s.image, 100, 326, 1720, 572, s.imagePos, s.map) +
      footer(t, "light"),
  );
}

/**
 * Full-bleed image, nothing on it but the footer. No title, no copy: it is a
 * breath between chapters, or the picture that carries the point on its own.
 *
 * Both halves of the footer sit on the photo, so both follow `logoTone`, which
 * page.tsx computes from the pixels under the footer row (see logo-tone.ts).
 * Default "dark" — a photo is more often dark than not, and a white lockup on
 * a light photo is worse than a dark one on a dark photo.
 */
export function photoFull(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    photoPanel(0, s.image, 1920, s.imagePos, s.map) + footer(t, s.logoTone ?? "dark"),
  );
}

export function worldMap(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000") +
      framedImage(s.image ?? "/giga-map.png", 100, 326, 1720, 572, s.imagePos, s.map) +
      footer(t, "light"),
  );
}

/**
 * Partner logo wall (template "21 Partner", Figma node 0-1087): white logos
 * straight on the accent background, 3 columns. Each name maps to a logo at
 * /partners/<slug>.png (white PNGs exported from Figma); when the file is
 * missing, the name renders as white text instead — still editable.
 */
export function partners(s: Slide, t: BrandTheme): string {
  const names = (s.bullets ?? []).slice(0, 15);
  const rows = Math.ceil(names.length / 3);
  const rowStep = rows > 1 ? Math.min(190, 742 / (rows - 1)) : 0;
  const colXs = [960, 1257, 1554];
  const cells = names
    .map((n, i) => {
      const cx = colXs[i % 3];
      const cy = 114 + Math.floor(i / 3) * rowStep;
      const slug = n
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const src = s.logos?.[slug] ?? `/partners/${slug}.svg`;
      // brightness(0) invert(1) forces ANY uploaded logo to render white
      return (
        `<div class="ars" ${item(`bullets.${i}`)} data-logo="${slug}" style="position:absolute;left:${cx}px;top:${cy}px;width:266px;height:110px;display:flex;align-items:center;justify-content:center;overflow:hidden;${dly(8 + i * 4)}">` +
        `<img src="${esc(src)}" alt="${esc(n)}" style="max-width:240px;max-height:100px;object-fit:contain;filter:brightness(0) invert(1);" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">` +
        `<div ${ed(`bullets.${i}`)} style="display:none;font-family:${MANROPE};font-weight:600;font-size:30px;letter-spacing:-.02em;color:#FFFFFF;text-align:center;">${esc(n)}</div>` +
        `</div>`
      );
    })
    .join("");
  return section(
    t,
    "var(--accent)",
    "#FFFFFF",
    `<div class="ar" ${ed("title", 340)} style="position:absolute;left:100px;top:100px;width:810px;font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1;letter-spacing:-.02em;color:#FFFFFF;white-space:pre-line;">${esc(s.title ?? "Our partners")}</div>` +
      cells,
  );
}

export function thankYou(s: Slide, t: BrandTheme): string {
  const contacts = (s.contacts ?? [])
    .slice(0, 2)
    .map(
      (c, i) =>
        `<div class="ars" ${item(`contacts.${i}`)} style="position:absolute;left:${100 + i * 744}px;top:395px;width:664px;${dly(12 + i * 8)}">` +
        `<div ${ed(`contacts.${i}.name`, 120)} style="font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.15;letter-spacing:-.02em;">${esc(c.name)}</div>` +
        `<div style="margin-top:29px;font-family:${OPEN_SANS};font-weight:500;font-size:32px;line-height:1.4;letter-spacing:-.01em;">` +
        `<div ${ed(`contacts.${i}.role`)}>${esc(c.role)}</div>` +
        `<div ${ed(`contacts.${i}.location`)}>${esc(c.location)}</div>` +
        `<div ${ed(`contacts.${i}.email`)}>${esc(c.email)}</div>` +
        `</div></div>`,
    )
    .join("");
  // Decks saved before the row became editable have no `channels`, so fall
  // back to the default for rendering. normalizeSlide seeds the array itself.
  const channels = (s.channels ?? channelsFor(t.id))
    .map(
      (ch, i) =>
        `<div class="ars" style="flex:1;${BODY30}color:#FFFFFF;${dly(26 + i * 4)}">` +
        `<div ${ed(`channels.${i}.label`)}>${esc(ch.label)}</div>` +
        `<div ${ed(`channels.${i}.value`)}>${esc(ch.value)}</div>` +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "var(--accent)",
    "#FFFFFF",
    `<div class="ar" ${ed("title")} style="position:absolute;left:100px;top:100px;width:1720px;font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1;letter-spacing:-.02em;color:#FFFFFF;">${esc(s.title ?? "Thank you!")}</div>` +
      contacts +
      `<div style="position:absolute;left:100px;top:898px;width:1720px;opacity:.8;display:flex;gap:40px;">${channels}</div>`,
  );
}
