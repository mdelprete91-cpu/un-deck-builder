import type { BrandTheme } from "../brand";
import { ed, esc, MANROPE, OPEN_SANS } from "../layouts/shared";

/**
 * The A4 two-pager shell: the print twin of `layouts/shared.ts`.
 *
 * Units are **points, 1:1 with the Figma boards** (595x842pt = A4). CSS pt is a
 * real absolute unit, so `@page { size: 595pt 842pt }` prints at exactly the
 * size the page is drawn at, with no scale factor anywhere in the chain.
 *
 * The one thing that is not in pt: `data-fit` budgets. `autofit.ts` reads
 * `getComputedStyle().fontSize` and `scrollHeight`, which are px whatever unit
 * the markup is authored in, so a budget left in pt would be a third too
 * generous and the text would overlap instead of shrinking, silently. Use
 * `edP()` and never write a `data-fit` literal here.
 *
 * For the same reason line-heights in this file are unitless: autofit only
 * remembers a line-height it can parse as px, so a pt one would stay put while
 * the font shrank underneath it.
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

/**
 * The grid, measured from the ten approved boards (Digital Inclusion,
 * Spectrum Certificates, Songbird, Lunar). Do not round these to something
 * tidier: they are the design, not a proposal.
 */
export const GRID = {
  margin: 24,
  /** Accent labels down the left edge. */
  rail: { x: 24, w: 100 },
  /** The main text column, which starts after the rail. */
  content: { x: 136, w: 435 },
  /** Elements that span rail and content (title, callout, divider). */
  full: { x: 24, w: 546 },
  /** The dense two-column body of the partnership boards. */
  cols2: [
    { x: 24, w: 273 },
    { x: 307, w: 274 },
  ],
  /** Stat cards, three across the content column. */
  cards3: { xs: [136.5, 282.83, 429.17], w: 141.33 },
  /** Icon columns, three across the content column. */
  icons3: { xs: [136, 281, 426], w: 145 },
  /** Photo cards, two across the content column. */
  photos2: { xs: [136, 357.5], w: 213.5 },
  /** The lockup: UNICEF mark, hairline rule, Digital Inclusion wordmark. */
  header: { top: 26.53, h: 36.94, markW: 66.85, markH: 35.58, markTop: 27.41, ruleX: 102.28, ruleW: 0.88, wordX: 115.5, wordW: 88.5 },
  /**
   * Where the stack may live. 80 is the box top of the title on the boards,
   * derived from its baseline (110.99) and the CSS half-leading, not eyeballed.
   */
  contentTop: 80,
  contentTopBare: 24,
  contentBottom: 795,
  footer: { baseline: 821.1, size: 8 },
} as const;

/**
 * The eight type styles of the boards. There are no others: a ninth size is a
 * question for the design team, not a judgement call in a renderer.
 */
export const TYPE = {
  /** Page title. 30/39. */
  title: `font-family:${MANROPE};font-weight:500;font-size:30pt;line-height:1.3;letter-spacing:-.01em;`,
  /** Stat number. */
  stat: `font-family:${MANROPE};font-weight:500;font-size:24pt;line-height:1.25;letter-spacing:-.01em;`,
  /** Rail label and section head, accent. 12/18. */
  rail: `font-family:${OPEN_SANS};font-weight:600;font-size:12pt;line-height:1.5;letter-spacing:-.01em;`,
  /** Block heading. */
  head: `font-family:${OPEN_SANS};font-weight:600;font-size:10pt;line-height:1.6;letter-spacing:-.01em;`,
  /** Body. 10/16. */
  body: `font-family:${OPEN_SANS};font-weight:400;font-size:10pt;line-height:1.6;letter-spacing:-.01em;`,
  /** Body in the narrow two-column boards. 10/15. */
  bodyTight: `font-family:${OPEN_SANS};font-weight:400;font-size:10pt;line-height:1.5;letter-spacing:-.01em;`,
  /** Card caption. 9/12. */
  caption: `font-family:${OPEN_SANS};font-weight:400;font-size:9pt;line-height:1.33;letter-spacing:-.01em;`,
  /** Footer. */
  footer: `font-family:${OPEN_SANS};font-weight:400;font-size:8pt;line-height:1.3;letter-spacing:-.01em;`,
} as const;

/**
 * Print surfaces. These are not on `BrandTheme` on purpose: they exist for A4
 * print pieces only and no slide renderer can reach them from here. The accent
 * still comes from the brand (`var(--accent)`), so the cyan rule holds.
 */
export const PALETTE = {
  ink: "#000000",
  inkSoft: "#1A1A1A",
  /** The status/attention hue of the printed boards. */
  orange: "#D14807",
  orangeBorder: "#E8B8A2",
  orangeTint: "rgba(209,72,7,.1)",
  panel: "#EFF2F5",
  /** The table header row. */
  panelSoft: "#F4F4F4",
  /** The pale field behind a framed figure. */
  figureTint: "#EDF4FC",
  hairline: "#E6E6E6",
  rule: "#D9D9D9",
  white: "#FFFFFF",
} as const;

/** A fit budget in pt, expressed in the px autofit measures in. */
export function fitPx(fitPt: number): number {
  return Math.round(fitPt * PX);
}

/** `ed()` for A4 renderers: the budget goes in as pt and comes out as px. */
export function edP(path: string, fitPt?: number): string {
  return ed(path, fitPt ? fitPx(fitPt) : undefined);
}

/** `data-fit` for a node that is not itself editable (its spans are). */
export function fitAttr(fitPt: number): string {
  return `data-fit="${fitPx(fitPt)}"`;
}

/** Line height in pt for a style, so blocks can compute their own height. */
export function lineHeight(sizePt: number, ratio: number): number {
  return sizePt * ratio;
}

/**
 * The page box. The single place the A4 dimensions are declared, mirroring
 * `section()` for slides, and the only place the brand CSS variables are set.
 */
export function pageSection(t: BrandTheme, inner: string): string {
  const vars =
    `--accent:${t.accent};--accent-deep:${t.deep};--accent-light:${t.light};` +
    `--accent-soft:${t.soft};--accent-soft2:${t.soft2};`;
  return (
    `<section style="position:relative;width:${pt(A4.w)};height:${pt(A4.h)};background:${PALETTE.white};` +
    `font-family:${OPEN_SANS};color:${PALETTE.ink};overflow:hidden;${vars}">` +
    `<div style="position:absolute;inset:0;">${inner}</div></section>`
  );
}

/**
 * The approved A4 lockup: UNICEF mark, hairline rule, Digital Inclusion
 * wordmark. Fixed assets rather than the theme's lockup, because this is the
 * printed piece's masthead and the format only exists on that one brand.
 */
export function pageHeader(): string {
  const h = GRID.header;
  const wordH = (h.wordW * 92.33) / 647.12;
  return (
    `<img src="/logos/unicef.svg" alt="" style="position:absolute;left:${pt(GRID.margin)};top:${pt(h.markTop)};width:${pt(h.markW)};height:${pt(h.markH)};filter:brightness(0);">` +
    `<div style="position:absolute;left:${pt(h.ruleX)};top:${pt(h.top)};width:${pt(h.ruleW)};height:${pt(h.h)};background:${PALETTE.ink};"></div>` +
    `<img src="/logos/unicef-digital-inclusion-black.svg" alt="" style="position:absolute;left:${pt(h.wordX)};top:${pt(h.top + (h.h - wordH) / 2)};width:${pt(h.wordW)};height:${pt(wordH)};filter:brightness(0);">`
  );
}

/**
 * Footer: editable label bottom-left, page number bottom-right.
 *
 * The number is derived from the page's position and deliberately not
 * editable: `setPath` has nothing to write it to that would survive a
 * reorder, so a `data-edit` here would be a field the user types into and
 * watches revert. The label is real state (`slide.footerLabel`).
 */
export function pageFooter(label: string, fallback: string, index: number): string {
  const top = GRID.footer.baseline - GRID.footer.size;
  const n = String(index + 1).padStart(2, "0");
  return (
    `<div ${edP("footerLabel", 12)} style="position:absolute;left:${pt(GRID.margin)};top:${pt(top)};width:${pt(380)};${TYPE.footer}color:${PALETTE.ink};">${esc(label || fallback)}</div>` +
    `<div style="position:absolute;right:${pt(GRID.margin)};top:${pt(top)};${TYPE.footer}color:${PALETTE.ink};text-align:right;">${n}</div>`
  );
}
