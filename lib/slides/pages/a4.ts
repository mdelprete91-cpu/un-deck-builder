import type { BrandTheme } from "../brand";
import { ed, esc, MANROPE, OPEN_SANS } from "../layouts/shared";
import type { PageFit } from "./schema";

/**
 * The A4 two-pager shell, rebuilt on the Estonia canon (figma-to-pptx-source/
 * estonia/build.py, 6 Oct 2026).
 *
 * Units are points, 1:1 with the printed sheet (595x842pt = A4): CSS pt is an
 * absolute unit, so `@page a4 { size: 595pt 842pt }` prints at exactly the
 * size the page is drawn at. Unlike the slide renderers, a page is laid out
 * by the browser (normal flow inside a fixed content zone) and never
 * autofitted: fit.ts measures the flow and the page steps down its density
 * instead, so the type stays on the grid.
 */

/** 1pt = 4/3 CSS px, exactly. */
export const PX = 4 / 3;

/** The page box in pt, and the same box in CSS px for the editor stage. */
export const A4 = { w: 595, h: 842 };
export const A4_PX = { w: A4.w * PX, h: A4.h * PX };

/** Trim float noise out of the markup: 141.33333 -> "141.33pt". */
export function pt(n: number): string {
  return `${Math.round(n * 100) / 100}pt`;
}

/** The grid of build.py. Do not round these: they are the design. */
export const GRID = {
  margin: 24,
  /** Labels down the left edge. */
  label: 100,
  /** Gap between the label column and the text column (24 + 100 + 12 = 136). */
  gutter: 12,
  /** The text column. */
  body: 435,
  /** Full width, 24 to 571. */
  full: 547,
  /** Gap between stat cards. */
  cardGap: 5,
  /** Where the flow starts: under the masthead on the first page, at the margin after. */
  topFirst: 80,
  topBare: 24,
  /** Content must end above this: the footer sits at 821. */
  bottom: 795,
  footerBaseline: 821.1,
} as const;

/**
 * The type of build.py and investment.py, per fit. Regular is the advocacy
 * piece (Open Sans 10/15, sections 22 apart), compact is the donor update
 * (9.5/14, 18 apart), tight one notch under it for the last resort. Line
 * heights are in pt: nothing on a page is autofitted.
 */
export interface Density {
  body: number;
  lh: number;
  para: number;
  gap: number;
  small: number;
  smallLh: number;
}
export const DENSITY: Record<PageFit, Density> = {
  regular: { body: 10, lh: 15, para: 8, gap: 22, small: 9, smallLh: 12 },
  compact: { body: 9.5, lh: 14, para: 7, gap: 18, small: 9, smallLh: 12 },
  tight: { body: 9, lh: 13.5, para: 6, gap: 14, small: 8.5, smallLh: 11.5 },
};

/** Open Sans and Manrope vertical metrics (hhea), for baseline alignment. */
const ASC = { open: 1.069, manrope: 1.066 };
const DESC = { open: 0.293, manrope: 0.3 };

/** Distance from a line box's top to its baseline, as CSS lays it out. */
export function firstBaseline(size: number, lh: number, font: "open" | "manrope" = "open"): number {
  return (lh - (ASC[font] + DESC[font]) * size) / 2 + ASC[font] * size;
}

export const PALETTE = {
  ink: "#000000",
  /** Table row labels and the "before" column head (investment.py GREY). */
  grey: "#6B6B6B",
  /** The attention hue of the printed pieces: the accented stat, the asks panel. */
  orange: "#D14807",
  orangeBorder: "#E8B8A2",
  orangeTint: "#FAEDE6",
  card: "#E6E6E6",
  panel: "#EFF2F5",
  hairline: "#E6E6E6",
  white: "#FFFFFF",
} as const;

export const FONT = { open: OPEN_SANS, manrope: MANROPE };

/** Letter-spacing of every style on the pieces. */
export const LS = "letter-spacing:-.01em;";

/** Text styles. `d` is the page's density. */
export const TYPE = {
  body: (d: Density) => `font-family:${OPEN_SANS};font-weight:400;font-size:${pt(d.body)};line-height:${pt(d.lh)};${LS}`,
  small: (d: Density) => `font-family:${OPEN_SANS};font-weight:400;font-size:${pt(d.small)};line-height:${pt(d.smallLh)};${LS}`,
  label: `font-family:${OPEN_SANS};font-weight:600;font-size:12pt;line-height:18pt;${LS}`,
  head: (d: Density) => `font-family:${OPEN_SANS};font-weight:600;font-size:${pt(d.body)};line-height:${pt(d.lh)};${LS}`,
  stat: `font-family:${MANROPE};font-weight:500;font-size:24pt;line-height:30pt;${LS}`,
  banner: `font-family:${MANROPE};font-weight:500;font-size:24pt;line-height:30pt;${LS}`,
  title: `font-family:${MANROPE};font-weight:500;font-size:30pt;line-height:39pt;${LS}`,
  footer: `font-family:${OPEN_SANS};font-weight:400;font-size:8pt;line-height:10pt;${LS}`,
  date: `font-family:${OPEN_SANS};font-weight:600;font-size:8pt;line-height:10pt;letter-spacing:.08em;text-transform:uppercase;`,
} as const;

/** `data-edit` for a page node. Pages are never autofitted, so no budget. */
export function edP(path: string): string {
  return ed(path);
}

/** The month and year a new piece is dated with ("October 2026"). */
export function pageDateNow(): string {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

/**
 * The masthead of the first page: the brand's lockup on the left (the UNICEF
 * mark, a hairline and the wordmark for Digital Inclusion, as on the Estonia
 * pieces; the unboxed lockup for the Digital Impact Division; the mark alone
 * for UNICEF), the date on the right.
 */
export function pageMasthead(t: BrandTheme, date: string, programmeLogo?: string): string {
  const m = GRID.margin;
  let logo: string;
  if (t.id === "inclusion") {
    const wordW = 88.5;
    const wordH = (wordW * 92.33) / 647.12;
    logo =
      `<img src="/logos/unicef.svg" alt="" style="position:absolute;left:${pt(m)};top:${pt(27.41)};width:${pt(66.85)};height:${pt(35.58)};filter:brightness(0);">` +
      `<div style="position:absolute;left:${pt(102.28)};top:${pt(26.53)};width:${pt(0.88)};height:${pt(36.94)};background:${PALETTE.ink};"></div>` +
      `<img src="/logos/unicef-digital-inclusion-black.svg" alt="" style="position:absolute;left:${pt(115.5)};top:${pt(26.53 + (36.94 - wordH) / 2)};width:${pt(wordW)};height:${pt(wordH)};filter:brightness(0);">`;
  } else if (t.id === "did") {
    const h = 37;
    logo = `<img src="/logos/unicef-digital-impact-unboxed.svg" alt="" style="position:absolute;left:${pt(m)};top:${pt(26.5)};width:${pt((h * 337) / 112)};height:${pt(h)};filter:brightness(0);">`;
  } else {
    logo = `<img src="${t.logoLight.src}" alt="" style="position:absolute;left:${pt(m)};top:${pt(27.41)};width:${pt(66.85)};height:${pt(35.58)};filter:brightness(0);">`;
  }
  // A programme logo takes the top right in place of the date, as on the
  // Songbird piece: 43pt high at most, right-aligned to the margin.
  const right = programmeLogo
    ? `<div data-page-logo style="position:absolute;right:${pt(m)};top:${pt(24)};width:${pt(140)};height:${pt(43)};display:flex;justify-content:flex-end;align-items:flex-start;">` +
      `<img src="${esc(programmeLogo)}" alt="" style="max-width:100%;max-height:100%;display:block;"></div>`
    : `<div ${edP("pageDate")} style="position:absolute;right:${pt(m)};top:${pt(40)};width:${pt(150)};${TYPE.date}color:${PALETTE.ink};text-align:right;white-space:nowrap;">${esc(date)}</div>`;
  return logo + right;
}

/**
 * Footer: the piece's name bottom-left (editable, real state on the page),
 * the page number bottom-right (derived from the position, so not editable).
 */
export function pageFooter(label: string, fallback: string, index: number): string {
  const top = GRID.footerBaseline - 8;
  const n = String(index + 1).padStart(2, "0");
  return (
    `<div ${edP("footerLabel")} style="position:absolute;left:${pt(GRID.margin)};top:${pt(top)};width:${pt(380)};${TYPE.footer}color:${PALETTE.ink};white-space:nowrap;">${esc(label || fallback)}</div>` +
    `<div style="position:absolute;right:${pt(GRID.margin)};top:${pt(top)};${TYPE.footer}color:${PALETTE.ink};text-align:right;">${n}</div>`
  );
}

/**
 * The page box. The single place the A4 size is declared and the brand
 * accent is set. `data-page-zone` is the fixed area the flow must fit in and
 * `data-page-flow` the flow itself: fit.ts and the editor compare the two.
 */
export function pageSection(t: BrandTheme, top: number, chrome: string, flow: string): string {
  return (
    `<section data-page-fit style="position:relative;width:${pt(A4.w)};height:${pt(A4.h)};background:${PALETTE.white};` +
    `font-family:${OPEN_SANS};color:${PALETTE.ink};overflow:hidden;--accent:${t.accent};">` +
    chrome +
    `<div data-page-zone style="position:absolute;left:0;top:${pt(top)};width:${pt(A4.w)};height:${pt(GRID.bottom - top)};overflow:hidden;">` +
    `<div data-page-flow style="display:flow-root;">${flow}</div></div></section>`
  );
}
