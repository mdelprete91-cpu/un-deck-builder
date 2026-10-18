import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import { MANROPE, OPEN_SANS, BODY30, LABEL36, esc, ed, dly, item, section, footer, coverFooter, backdrop, columns, heading80 } from "./shared";

/**
 * The slides UNICEF DI draws in a shape of its own (DI Deck Template.pdf,
 * Mario, 18 Oct 2026): the cover, the agenda, the divider, the big number,
 * the quote and the closing slide sit on the template's dot maps, with small
 * regular Manrope instead of the 144px display type. basic.ts hands these
 * over when `t.look === "di"`; every other layout keeps its geometry and
 * takes the look from the theme (page grey, footer, headings in renderSlide).
 *
 * The backgrounds come from the template's pages with the text taken out
 * (public/templates/di). Text sits where the template puts it.
 */

const bg = (t: BrandTheme, kind: "cover" | "agenda" | "dark" | "closing") =>
  t.backgrounds ? backdrop(t.backgrounds[kind]) : "";

/** p1: cyan, the dot map on the left, the title in white right of centre. */
export function cover(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "var(--accent)",
    "#FFFFFF",
    bg(t, "cover") +
      `<div style="position:absolute;left:870px;top:330px;width:950px;height:330px;display:flex;flex-direction:column;justify-content:flex-end;">` +
        `<div class="ar" ${ed("title", 330)} style="font-family:${MANROPE};font-weight:400;font-size:72px;line-height:1.12;letter-spacing:-.015em;color:#FFFFFF;white-space:pre-line;">${esc(s.title)}</div>` +
        `</div>` +
      `<div class="ar" ${ed("subtitle", 160)} style="position:absolute;left:872px;top:690px;width:950px;font-family:${OPEN_SANS};font-weight:500;font-size:30px;line-height:1.36;color:#FFFFFF;${dly(12)}">${esc(s.subtitle)}</div>` +
      coverFooter(t),
  );
}

/** p2: the dot map on the left, the chapters numbered 01, 02, 03 on the right, numbers in orange. */
export function agenda(s: Slide, t: BrandTheme): string {
  const items = (s.bullets ?? [])
    .map(
      (bullet, i) =>
        `<div class="ars" ${item(`bullets.${i}`)} style="display:flex;gap:.8em;padding:.1em 0;${dly(10 + i * 6)}">` +
        `<span style="flex:0 0 auto;white-space:pre;color:${t.highlight};">${String(i + 1).padStart(2, "0")}</span>` +
        `<span ${ed(`bullets.${i}`)} style="flex:1;min-width:0;">${esc(bullet)}</span>` +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    bg(t, "agenda") +
      // The template has no heading on the agenda: the title stays in the
      // deck (and in the editor's outline) but is not drawn.
      `<div data-fit="760" style="position:absolute;left:1140px;top:110px;width:700px;display:flex;flex-direction:column;gap:.25em;font-family:${MANROPE};font-weight:400;font-size:44px;line-height:1.2;letter-spacing:-.01em;color:#1A1A1A;">${items}</div>` +
      footer({ ...t, chapter: undefined, site: undefined }, "light"),
  );
}

/** p19: navy with the dot map, one statement centred in white. */
export function sectionDivider(s: Slide, t: BrandTheme): string {
  return section(
    t,
    t.dark ?? "var(--accent)",
    "#FFFFFF",
    bg(t, "dark") +
      `<div style="position:absolute;left:260px;top:240px;width:1400px;height:520px;display:flex;align-items:center;justify-content:center;">` +
      `<div class="ar" ${ed("title", 500)} style="width:100%;text-align:center;font-family:${MANROPE};font-weight:400;font-size:64px;line-height:1.2;letter-spacing:-.01em;color:#FFFFFF;white-space:pre-line;">${esc(s.title)}</div>` +
      `</div>` +
      footer({ ...t, chapter: undefined, site: undefined }, "dark"),
  );
}

/** p4: up to three labelled columns on the page, cyan labels, no numbers. */
export function threeColumns(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 3);
  const { xs, width } = columns(Math.min(blocks.length, 3));
  const cols = blocks
    .map(
      (b, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:380px;width:${Math.min(width, 549)}px;${dly(10 + i * 8)}">` +
        `<div ${ed(`blocks.${i}.label`, 100)} style="${LABEL36}color:var(--accent);">${esc(b.label)}</div>` +
        `<div ${ed(`blocks.${i}.body`, 440)} style="margin-top:18px;${BODY30}color:#000000;">${esc(b.body)}</div>` +
        `</div>`,
    )
    .join("");
  return section(t, "#FFFFFF", "#000000", heading80(s.title ?? "", "title", "#000000", 1720, 220) + cols + footer(t, "light"));
}

/** p18: the logos in black on the page, the heading at the template's size. */
export function partners(s: Slide, t: BrandTheme, cells: string): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    `<div class="ar" ${ed("title", 340)} style="position:absolute;left:100px;top:380px;width:760px;font-family:${MANROPE};font-weight:400;font-size:72px;line-height:1.1;letter-spacing:-.015em;color:#000000;white-space:pre-line;">${esc(s.title ?? t.ui?.partners ?? "Our partners")}</div>` +
      cells.replace(/filter:brightness\(0\) invert\(1\);/g, "filter:brightness(0);opacity:.85;").replace(/color:#FFFFFF;text-align:center;/g, "color:#000000;text-align:center;") +
      footer(t, "light"),
  );
}

/** p13: navy with the dot map, the figure in light cyan, the sentence in white under it. */
export function bigStat(s: Slide, t: BrandTheme): string {
  return section(
    t,
    t.dark ?? "var(--accent-deep)",
    "#FFFFFF",
    bg(t, "dark") +
      `<div style="position:absolute;left:100px;top:250px;width:1100px;height:300px;display:flex;flex-direction:column;justify-content:flex-end;">` +
        `<div class="ar" ${ed("stat", 300)} style="font-family:${MANROPE};font-weight:300;font-size:200px;line-height:1;letter-spacing:-.02em;color:#8FD8F8;">${esc(s.stat)}</div>` +
        `</div>` +
      `<div class="ar" ${ed("support", 330)} style="position:absolute;left:104px;top:590px;width:1000px;${BODY30}color:#FFFFFF;${dly(14)}">${esc(s.support)}</div>` +
      footer(t, "dark"),
  );
}

/** p6: the page with the dot map on the left, the quote right of it, the author in orange. */
export function quote(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    bg(t, "agenda") +
      `<div style="position:absolute;left:840px;top:150px;width:980px;height:640px;display:flex;flex-direction:column;justify-content:center;">` +
      `<div class="ar" ${ed("quote", 520)} style="font-family:${MANROPE};font-weight:400;font-size:56px;line-height:1.22;letter-spacing:-.01em;color:#1A1A1A;">“${esc(s.quote)}”</div>` +
      `<div class="ar" ${ed("author", 100)} style="margin-top:28px;font-family:${MANROPE};font-weight:500;font-size:28px;color:${t.quoteAuthor};${dly(14)}">${esc(s.author)}</div>` +
      `</div>` +
      footer(t, "light"),
  );
}

/**
 * The closing slide is fixed (Mario, 19 Oct 2026: "ci sarà sempre questa"):
 * the Figma frame "Closing slide" (DI-branding, node 207-2023) as one image,
 * with the turning words, "Digital access for every child" and the email
 * already on it. The slide's own title, contacts and channels are kept in
 * the deck but not drawn, so switching template brings them back.
 */
export function thankYou(t: BrandTheme): string {
  return section(t, "var(--accent)", "#FFFFFF", bg(t, "closing"));
}
