import type { BrandTheme } from "../brand";

/**
 * Typography and geometry from the "Giga Slides" template (2026-07):
 * display 144px, headings 80/60px, body Open Sans 500 30px/1.36 or 32px/48px,
 * field labels Manrope 600 36px in the accent color, cards with a full
 * 4px accent border.
 */
export const MANROPE = "'Manrope',sans-serif";
export const OPEN_SANS = "'Open Sans',sans-serif";

/** Body text, 30px scale */
export const BODY30 = `font-family:${OPEN_SANS};font-weight:500;font-size:30px;line-height:1.36;letter-spacing:-.01em;`;
/** Body text, 32px scale */
export const BODY32 = `font-family:${OPEN_SANS};font-weight:500;font-size:32px;line-height:48px;`;
/** Field label (What/Give/Get…), accent */
export const LABEL36 = `font-family:${MANROPE};font-weight:600;font-size:36px;line-height:1.32;letter-spacing:-.02em;`;

export function esc(text: string | undefined): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Attribute marking a text node as inline-editable; value is the state path.
 * `fit` is the node's vertical budget in px (from the template geometry):
 * the editor shrinks the font to keep the text inside it, then clips, so
 * edited text can never overlap the elements below.
 */
export function ed(path: string, fit?: number): string {
  return `data-edit="${path}"${fit ? ` data-fit="${fit}"` : ""}`;
}

/**
 * Entrance-animation delay from centiseconds: dly(8) → "animation-delay:0.08s;".
 * Never build delays as `.${n}s` — with a single-digit n that reads as 0.8s,
 * which made first elements animate after their siblings in the HTML export.
 */
export function dly(cs: number): string {
  return `animation-delay:${cs / 100}s;`;
}

/** Attribute marking a deletable element (card, stat, bullet…); value is the array path. */
export function item(path: string): string {
  return `data-item="${path}"`;
}

/**
 * Column geometry for 1–4 items on the 1720px content width (x from 100).
 * The 3- and 4-column values match the new template exactly (gap 36).
 */
export function columns(n: number): { xs: number[]; width: number } {
  switch (Math.max(1, Math.min(4, n))) {
    case 1:
      return { xs: [100], width: 1720 };
    case 2:
      return { xs: [100, 978], width: 842 };
    case 3:
      return { xs: [100, 685, 1271], width: 549 };
    default:
      return { xs: [100, 539, 978, 1417], width: 403 };
  }
}

/**
 * Section wrapper. Sets the brand CSS variables so every renderer can use
 * var(--accent) etc. and stay brand-agnostic.
 */
export function section(
  t: BrandTheme,
  bg: string,
  color: string,
  inner: string,
): string {
  const vars =
    `--accent:${t.accent};--accent-deep:${t.deep};--accent-light:${t.light};` +
    `--accent-soft:${t.soft};--accent-soft2:${t.soft2};--panel-deep:${t.panelDeep};` +
    `--panel-light:${t.panelLight};--panel-light-stroke:${t.panelLightStroke};`;
  return (
    `<section style="position:relative;width:1920px;height:1080px;background:${bg};` +
    `font-family:${OPEN_SANS};color:${color};overflow:hidden;${vars}">` +
    `<div style="position:absolute;inset:0;">${inner}</div></section>`
  );
}

export type Surface = "light" | "dark";

/**
 * Footer: division label bottom-left + brand logo bottom-right.
 * New template geometry: label 20px at (102,966), logo 60px tall at top 950.
 * The logo is anchored right with a fixed height so the three brand lockups
 * keep their aspect ratios.
 */
export function footer(t: BrandTheme, surface: Surface): string {
  const labelColor = surface === "dark" ? "#FFFFFF" : "#000000";
  const logo = surface === "dark" ? t.logoDark : t.logoLight;
  const filter = logo.filter ? `filter:${logo.filter};` : "";
  const h = Math.round(60 * (logo.scale ?? 1));
  return (
    `<div style="position:absolute;left:102px;top:966px;width:432px;font-family:${OPEN_SANS};font-weight:500;font-size:20px;line-height:1.4;color:${labelColor};">${esc(t.footerLabel)}</div>` +
    `<img src="${logo.src}" alt="" style="position:absolute;right:95px;top:${980 - h / 2}px;height:${h}px;width:auto;${filter}">`
  );
}

/** Cover footer: accent 30px label + full-color logo, larger (450px row at top 916). */
export function coverFooter(t: BrandTheme): string {
  const filter = t.logoCover.filter ? `filter:${t.logoCover.filter};` : "";
  const h = Math.round(94 * (t.logoCover.scale ?? 1));
  return (
    `<div style="position:absolute;left:100px;top:943px;width:432px;${BODY30}color:var(--accent);">${esc(t.footerLabel)}</div>` +
    `<img src="${t.logoCover.src}" alt="" style="position:absolute;right:95px;top:${963 - h / 2}px;height:${h}px;width:auto;${filter}">`
  );
}

/** Agenda/dark footer with the large white logo (450px row), used on accent surfaces. */
export function coverFooterDark(t: BrandTheme): string {
  const filter = t.logoDark.filter ? `filter:${t.logoDark.filter};` : "";
  const h = Math.round(94 * (t.logoDark.scale ?? 1));
  return (
    `<div style="position:absolute;left:100px;top:943px;width:432px;${BODY30}color:#FFFFFF;">${esc(t.footerLabel)}</div>` +
    `<img src="${t.logoDark.src}" alt="" style="position:absolute;right:95px;top:${963 - h / 2}px;height:${h}px;width:auto;${filter}">`
  );
}

/**
 * Full-height photo panel. `image` is the slide's uploaded image (data URL)
 * or undefined for the Giga classroom placeholder; `data-image` marks the
 * node for the editor's "Change image" action.
 */
export function photoPanel(left: number, image?: string, width = 840): string {
  return `<img src="${image ?? "/giga-placeholder.jpg"}" data-image alt="" class="af" style="position:absolute;left:${left}px;top:0;width:${width}px;height:1080px;object-fit:cover;">`;
}

/** Display title, 144px (new template cover/divider scale). */
export function displayTitle(
  text: string,
  path: string,
  color: string,
  extra = "",
  fit?: number,
): string {
  return `<div class="ar" ${ed(path, fit)} style="position:absolute;left:100px;top:100px;width:1720px;font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1;letter-spacing:-.02em;color:${color};white-space:pre-line;${extra}">${esc(text)}</div>`;
}

/** Standard 80px slide heading. */
export function heading80(
  text: string,
  path: string,
  color: string,
  width = 1720,
  fit = 220,
): string {
  return `<div class="ar" ${ed(path, fit)} style="position:absolute;left:100px;top:100px;width:${width}px;font-family:${MANROPE};font-weight:500;font-size:80px;line-height:1.1;letter-spacing:-.022em;color:${color};white-space:pre-line;">${esc(text)}</div>`;
}

/** 60px heading used by callout/example/tiers layouts. */
export function heading60(
  text: string,
  path: string,
  color: string,
  left = 100,
  width = 900,
  fit = 160,
): string {
  return `<div class="ar" ${ed(path, fit)} style="position:absolute;left:${left}px;top:100px;width:${width}px;font-family:${MANROPE};font-weight:500;font-size:60px;line-height:1.2;letter-spacing:-.022em;color:${color};white-space:pre-line;">${esc(text)}</div>`;
}

/** Light→dark accent shades for charts (donut segments, bars), template order. */
export function chartShades(t: BrandTheme, n: number): string[] {
  return t.barShades.slice(0, Math.max(2, Math.min(n, t.barShades.length))).reverse();
}
