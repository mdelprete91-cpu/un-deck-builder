import type { Slide, Block, LayoutId } from "../schema";
import type { BrandTheme } from "../brand";
import { MANROPE, OPEN_SANS, HAIRLINE, esc, ed, dly, item, columns, section, footer, heading60 } from "./shared";
import { seriesColors } from "./charts";

/**
 * Dense layouts (28 Sep 2026, drawn for Mario to approve): the slides of a
 * consulting-style investment case, where a slide carries 150-250 words and
 * every figure has to stay (the Gambia joint investment case, 38 slides).
 * They are the existing grammar at a denser scale, nothing new in colour or
 * type: the 60px title of four-cards and list (two lines here), the #F7F7F7
 * card of four-cards, the accent label of the callout, the list's hairline,
 * the chart's grid and series colours, and one accent band for the key
 * message, the surface the closing slide already uses.
 *
 * Body text is Open Sans 500 at 24px, the smallest step that keeps a column
 * of 70 words readable; every text group sizes its children in em from one
 * container that carries the `data-fit` budget, so a whole list shrinks as
 * one and never overlaps what is below. The containers keep 28px on the
 * right so the editor's delete ✕ (it overhangs an item by 24px) is never
 * read as overflow.
 */

/**
 * Where the content starts: under a two-line 60px title (100 + 144 + 28), or
 * 72px higher when the title is short enough for one line (at most 50
 * characters; Manrope 500 at 60px averages about 29px a character on 1720px).
 * The title's budget follows, so a guess that is wrong shrinks the title
 * rather than running it into the content.
 */
const oneLine = (s: Slide) => (s.title ?? "").trim().length <= 50;
const topOf = (s: Slide) => (oneLine(s) ? 200 : 272);
const BOTTOM = 936; // 30px above the footer label, as on list and callout
const BAND_H = 124;
const GAP = 24;
const DENSE = `font-family:${OPEN_SANS};font-weight:500;font-size:24px;line-height:1.4;color:#000000;`;
const HEAD = (px: number, color = "var(--accent)") =>
  `font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.3;letter-spacing:-.01em;color:${color};`;
const CARD = "#F7F7F7";

function title(s: Slide): string {
  return heading60(s.title ?? "", "title", "#000000", 100, 1720, oneLine(s) ? 76 : 150);
}

/**
 * A block's points with their edit paths: `items` when it has them, else its
 * `body` as one point (a block added with "Add element" has only a body).
 */
function pointsOf(b: Block, i: number): { text: string; path: string }[] {
  if (b.items?.length) return b.items.map((text, j) => ({ text, path: `blocks.${i}.items.${j}` }));
  return b.body?.trim() ? [{ text: b.body, path: `blocks.${i}.body` }] : [];
}

/**
 * A bullet list in em: a point is an accent dot and its text; a point that
 * starts with a dash is a sub-point, indented, the en dash its marker. The
 * dash is part of the text, so editing never loses the level.
 */
function bullets(
  points: { text: string; path: string }[],
  fit: number,
  group?: string,
  head?: { path: string; text?: string; color?: string },
): string {
  const rows = points
    .map(({ text, path }) => {
      const sub = /^[-–]\s/.test(text);
      return sub
        ? `<div style="padding-left:.94em;"><div ${ed(path)} style="padding-left:.9em;text-indent:-.9em;">${esc(text.replace(/^-\s/, "– "))}</div></div>`
        : `<div style="display:flex;gap:.6em;">` +
            `<span style="flex:0 0 auto;width:.34em;height:.34em;margin-top:.53em;border-radius:50%;background:var(--accent);"></span>` +
            `<div ${ed(path)} style="flex:1;min-width:0;">${esc(text)}</div>` +
            `</div>`;
    })
    .join("");
  // The header, when there is one, is inside the budget: header and points
  // shrink as one, and a short header leaves its room to the points.
  const top = head
    ? `<div ${ed(head.path)} style="font-family:${MANROPE};font-weight:600;font-size:1.25em;line-height:1.3;letter-spacing:-.01em;color:${head.color ?? "var(--accent)"};margin-bottom:.35em;">${esc(head.text)}</div>`
    : "";
  return `<div data-fit="${fit}"${group ? ` data-fit-group="${group}"` : ""} style="${DENSE}padding-right:28px;display:flex;flex-direction:column;gap:.45em;">${top}${rows}</div>`;
}

/** The key message under the content: white on the accent, full width. */
function band(s: Slide, y: number): string {
  return (
    `<div class="ars" style="position:absolute;left:100px;top:${y}px;width:1720px;height:${BAND_H}px;box-sizing:border-box;background:var(--accent);padding:0 48px;display:flex;align-items:center;${dly(30)}">` +
    `<div ${ed("support", 92)} style="width:100%;${HEAD(30, "#FFFFFF")}">${esc(s.support)}</div>` +
    `</div>`
  );
}

const hasBand = (s: Slide) => !!s.support?.trim();

/**
 * Bullet columns (slides 4, 6, 17, 23, 24, 26, 27 of the Gambia case): one to
 * three cards side by side, a header in the accent and up to eight points
 * each, and the key message in the band below when there is one.
 */
export function bulletColumns(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 3);
  const { xs, width } = columns(Math.max(blocks.length, 1));
  const bottom = hasBand(s) ? BOTTOM - BAND_H - GAP : BOTTOM;
  const h = bottom - TOP;
  const cards = blocks
    .map(
      (b, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:${TOP}px;width:${width}px;height:${h}px;box-sizing:border-box;background:${CARD};padding:32px 8px 28px 36px;display:flex;flex-direction:column;gap:18px;${dly(8 + i * 8)}">` +
        bullets(pointsOf(b, i), h - 60, "cols", { path: `blocks.${i}.label`, text: b.label }) +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) + cards + (hasBand(s) ? band(s, bottom + GAP) : "") + footer(t, "light"),
  );
}

/**
 * Figures and commentary (slides 12, 30, 34): rows named in the left column
 * (Outcome, Benefits, Costs), their figures in the middle, each a value in
 * the accent over its caption, and the commentary on the same row at the
 * right. `subtitle` and `support` head the two columns.
 */
export function figuresPanel(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 4);
  const X = { label: 100, figures: 360, comment: 1180 };
  const W = { label: 236, figures: 780, comment: 640 };
  const heads =
    `<div class="ars" style="position:absolute;left:${X.figures}px;top:${TOP}px;width:${W.figures}px;${dly(6)}"><div ${ed("subtitle", 40)} style="${HEAD(30)}">${esc(s.subtitle)}</div></div>` +
    `<div class="ars" style="position:absolute;left:${X.comment}px;top:${TOP}px;width:${W.comment}px;${dly(6)}"><div ${ed("support", 40)} style="${HEAD(30)}">${esc(s.support)}</div></div>` +
    `<div style="position:absolute;left:100px;top:${TOP + 56}px;width:1720px;height:2px;background:var(--accent);"></div>`;
  const rows = blocks
    .map((b, i) => {
      const figures = (b.stats ?? [])
        .map(
          (f, j) =>
            `<div><div ${ed(`blocks.${i}.stats.${j}.value`)} style="font-family:${MANROPE};font-weight:600;font-size:1.25em;line-height:1.25;letter-spacing:-.01em;color:var(--accent);">${esc(f.value)}</div>` +
            `<div ${ed(`blocks.${i}.stats.${j}.label`)} style="margin-top:.1em;">${esc(f.label)}</div></div>`,
        )
        .join("");
      const comment = pointsOf(b, i)
        .map(
          ({ text, path }) =>
            `<div style="display:flex;gap:.6em;"><span style="flex:0 0 auto;width:.34em;height:.34em;margin-top:.53em;border-radius:50%;background:var(--accent);"></span><div ${ed(path)} style="flex:1;min-width:0;">${esc(text)}</div></div>`,
        )
        .join("");
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="display:flex;gap:24px;padding:.75em 0;border-bottom:1px solid ${HAIRLINE};${dly(10 + i * 6)}">` +
        `<div ${ed(`blocks.${i}.label`)} style="flex:0 0 ${W.label}px;font-family:${MANROPE};font-weight:600;font-size:1.2em;line-height:1.3;color:#000000;">${esc(b.label)}</div>` +
        `<div style="flex:0 0 ${W.figures}px;display:flex;flex-direction:column;gap:.55em;">${figures}</div>` +
        `<div style="flex:1;min-width:0;padding-left:40px;display:flex;flex-direction:column;gap:.45em;">${comment}</div>` +
        `</div>`
      );
    })
    .join("");
  const zoneTop = TOP + 72;
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      heads +
      `<div data-fit="${BOTTOM - zoneTop}" style="position:absolute;left:100px;top:${zoneTop}px;width:1748px;box-sizing:border-box;padding-right:28px;${DENSE}display:flex;flex-direction:column;">${rows}</div>` +
      footer(t, "light"),
  );
}

/**
 * Scenarios (slide 3): two or three options one under the other, each named
 * on an accent tile with its points beside it, and the conclusion in a panel
 * on the right (`subtitle` heads it, `bullets` are its points). Without
 * conclusion points the rows run the full width.
 */
export function scenarios(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 3);
  const n = Math.max(blocks.length, 1);
  const panel = (s.bullets ?? []).some((b) => b.trim());
  const right = panel ? 1260 : 1820;
  const rowH = Math.floor((BOTTOM - TOP - GAP * (n - 1)) / n);
  const TILE = 280;
  const rows = blocks
    .map((b, i) => {
      const y = TOP + i * (rowH + GAP);
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:100px;top:${y}px;width:${right - 100}px;height:${rowH}px;${dly(8 + i * 8)}">` +
        `<div style="position:absolute;left:0;top:0;width:${TILE}px;height:${rowH}px;box-sizing:border-box;background:var(--accent);padding:28px;display:flex;align-items:center;">` +
        `<div ${ed(`blocks.${i}.label`, rowH - 56)} style="${HEAD(32, "#FFFFFF")}">${esc(b.label)}</div></div>` +
        `<div style="position:absolute;left:${TILE}px;top:0;width:${right - 100 - TILE}px;height:${rowH}px;box-sizing:border-box;background:${CARD};padding:26px 8px 20px 36px;">` +
        bullets(pointsOf(b, i), rowH - 46, "scenarios") +
        `</div></div>`
      );
    })
    .join("");
  const side = panel
    ? `<div class="ars" style="position:absolute;left:1300px;top:${TOP}px;width:520px;height:${BOTTOM - TOP}px;box-sizing:border-box;border-top:4px solid var(--accent);padding:28px 0 0 0;display:flex;flex-direction:column;gap:18px;${dly(24)}">` +
      bullets(
        (s.bullets ?? []).map((text, j) => ({ text, path: `bullets.${j}` })),
        BOTTOM - TOP - 32,
        undefined,
        { path: "subtitle", text: s.subtitle, color: "#000000" },
      ) +
      `</div>`
    : "";
  return section(t, "#FFFFFF", "#000000", title(s) + rows + side + footer(t, "light"));
}

/**
 * Matrix (slides 8 and 10): one to three rows, each named on an accent tile,
 * across two to five cells with a heading and a line or two (the impact
 * pathways, each with its figure for the country). Cells are the row's
 * `stats`: `label` is the heading, `value` the text. A key message in the
 * band below when there is one.
 */
export function matrix(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 3);
  const n = Math.max(blocks.length, 1);
  const bottom = hasBand(s) ? BOTTOM - BAND_H - GAP : BOTTOM;
  const rowH = Math.floor((bottom - TOP - GAP * (n - 1)) / n);
  const TILE = 240;
  const CGAP = 16;
  const rows = blocks
    .map((b, i) => {
      const cells = (b.stats ?? []).slice(0, 5);
      const m = Math.max(cells.length, 1);
      const cw = Math.floor((1720 - TILE - CGAP - CGAP * (m - 1)) / m);
      const y = TOP + i * (rowH + GAP);
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:100px;top:${y}px;width:1720px;height:${rowH}px;${dly(8 + i * 8)}">` +
        `<div style="position:absolute;left:0;top:0;width:${TILE}px;height:${rowH}px;box-sizing:border-box;background:var(--accent);padding:24px;display:flex;align-items:center;">` +
        `<div ${ed(`blocks.${i}.label`, rowH - 48)} style="${HEAD(30, "#FFFFFF")}">${esc(b.label)}</div></div>` +
        cells
          .map(
            (c, j) =>
              `<div style="position:absolute;left:${TILE + CGAP + j * (cw + CGAP)}px;top:0;width:${cw}px;height:${rowH}px;box-sizing:border-box;background:${CARD};padding:22px 4px 18px 24px;">` +
              `<div data-fit="${rowH - 40}" data-fit-group="matrix" style="${DENSE}font-size:22px;padding-right:20px;">` +
              `<div ${ed(`blocks.${i}.stats.${j}.label`)} style="font-family:${MANROPE};font-weight:600;font-size:1.05em;line-height:1.3;color:var(--accent);">${esc(c.label)}</div>` +
              `<div ${ed(`blocks.${i}.stats.${j}.value`)} style="margin-top:.4em;">${esc(c.value)}</div>` +
              `</div></div>`,
          )
          .join("") +
        `</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) + rows + (hasBand(s) ? band(s, bottom + GAP) : "") + footer(t, "light"),
  );
}

/** A figure that may be negative (costs drawn below zero). */
function signed(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
const short = (n: number) => {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  return r.toLocaleString("en-US");
};

/**
 * Chart and explanation (slides 13-15, 31, 32, 35, 36): the explanation in a
 * card on the left (`subtitle` heads it, `bullets` are its points), a line
 * chart of one to three series on the right, and under it up to three
 * numbered notes, note k about series k, its number on the line's last point.
 * Values may be negative: costs run below a darker zero line. The grid, axis
 * type and series colours are the line chart's.
 */
export function chartText(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const bars = (s.bars ?? []).slice(0, 12);
  const series = (s.series?.length ? s.series : [""]).slice(0, 3);
  const k = series.length;
  const colors = seriesColors(t, k);
  const notes = (s.blocks ?? []).slice(0, 3);

  const PANEL = { x: 100, w: 700 };
  const LEG_Y = TOP;
  const P = { x: 960, y: TOP + 84, w: 720, h: 300 };
  const vals = bars.map((b) => (b.values?.length ? b.values : [b.value]).map(signed));
  const all = vals.flat();
  const hi = Math.max(0, ...all);
  const lo = Math.min(0, ...all);
  const span = hi - lo || 1;
  const yOf = (v: number) => P.y + ((hi - v) / span) * P.h;
  const n = Math.max(bars.length, 1);
  const xOf = (i: number) => P.x + (n === 1 ? P.w / 2 : (P.w * i) / (n - 1));

  const axisStyle = `font-family:${OPEN_SANS};font-weight:500;font-size:22px;line-height:1.3;color:#6F6F6F;`;
  const ticks = [hi, 0, lo].filter((v, i, a) => a.indexOf(v) === i);
  const grid =
    [0, 0.25, 0.5, 0.75, 1]
      .map((f) => `<div style="position:absolute;left:${P.x}px;top:${Math.round(P.y + P.h * f)}px;width:${P.w}px;height:1px;background:#ECECEF;"></div>`)
      .join("") +
    `<div style="position:absolute;left:${P.x}px;top:${Math.round(yOf(0))}px;width:${P.w}px;height:2px;background:#C9C9CF;"></div>` +
    ticks
      .map((v) => `<div style="position:absolute;left:840px;top:${Math.round(yOf(v) - 14)}px;width:100px;text-align:right;${axisStyle}">${short(v)}</div>`)
      .join("");
  const paths = series
    .map((_, j) => {
      const pts = vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v[j] ?? 0).toFixed(1)}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${colors[j]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join("");
  const svg = `<svg class="af" width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;${dly(14)}">${paths}</svg>`;
  // The lines and their end labels are drawing only (pointer-events off):
  // a click anywhere on the plot reaches [data-chart] and opens the Data
  // panel, and the explanation beside it stays editable.
  // The last point of each series: a dot on the line, then beside it the
  // note's number and the value, nudged apart when two lines end close.
  const last = vals.length - 1;
  const endY = series.map((_, j) => ({ j, y: last >= 0 ? yOf(vals[last][j] ?? 0) : 0 }));
  const placed = [...endY].sort((a, b) => a.y - b.y);
  for (let q = 1; q < placed.length; q++) placed[q].y = Math.max(placed[q].y, placed[q - 1].y + 40);
  const ends =
    last < 0
      ? ""
      : placed
          .map(({ j, y: ly }) => {
            const v = vals[last][j] ?? 0;
            const x = xOf(last);
            const y = yOf(v);
            const lx = Math.round(x + 18);
            const top = Math.round(ly - 17);
            const tag = notes[j]
              ? `<div class="af" style="position:absolute;left:${lx}px;top:${top}px;width:34px;height:34px;border-radius:50%;background:${colors[j]};${HEAD(19, "#FFFFFF")}line-height:34px;text-align:center;pointer-events:none;${dly(20)}">${j + 1}</div>`
              : "";
            return (
              `<div class="af" style="position:absolute;left:${Math.round(x - 8)}px;top:${Math.round(y - 8)}px;width:16px;height:16px;border-radius:50%;background:${colors[j]};pointer-events:none;${dly(20)}"></div>` +
              tag +
              `<div class="af" style="position:absolute;left:${lx + (notes[j] ? 44 : 0)}px;top:${top}px;width:110px;font-family:${MANROPE};font-weight:600;font-size:22px;line-height:34px;color:#000000;white-space:nowrap;pointer-events:none;${dly(20)}">${short(v)}</div>`
            );
          })
          .join("");
  const xl = bars
    .map((b, i) => `<div class="ars" ${ed(`bars.${i}.label`, 32)} style="position:absolute;left:${Math.round(xOf(i) - 60)}px;top:${P.y + P.h + 14}px;width:120px;text-align:center;${axisStyle}color:#000000;${dly(18 + i * 2)}">${esc(b.label)}</div>`)
    .join("");
  const leg =
    `<div style="position:absolute;left:${P.x}px;top:${LEG_Y}px;width:${1820 - P.x}px;display:flex;flex-wrap:wrap;gap:6px 32px;">` +
    series
      .map(
        (name, j) =>
          `<div class="ars" style="display:flex;align-items:center;gap:12px;${dly(8 + j * 4)}"><div style="width:18px;height:18px;border-radius:50%;background:${colors[j]};"></div><div ${ed(`series.${j}`, 32)} style="${axisStyle}color:#000000;white-space:nowrap;">${esc(name)}</div></div>`,
      )
      .join("") +
    `</div>`;
  const NOTE_TOP = P.y + P.h + 70;
  const noteRows = notes
    .map(
      (b, j) =>
        `<div style="display:flex;gap:.7em;"><div style="flex:0 0 auto;width:1.35em;height:1.35em;border-radius:50%;background:${colors[j] ?? colors[0]};color:#FFFFFF;font-family:${MANROPE};font-weight:600;font-size:1em;line-height:1.35em;text-align:center;margin-top:.02em;">${j + 1}</div><div ${ed(`blocks.${j}.body`)} style="flex:1;min-width:0;">${esc(b.body)}</div></div>`,
    )
    .join("");
  const panel =
    `<div class="ars" style="position:absolute;left:${PANEL.x}px;top:${TOP}px;width:${PANEL.w}px;height:${BOTTOM - TOP}px;box-sizing:border-box;background:${CARD};padding:32px 8px 28px 36px;display:flex;flex-direction:column;gap:18px;${dly(6)}">` +
    bullets(
      (s.bullets ?? []).map((text, j) => ({ text, path: `bullets.${j}` })),
      BOTTOM - TOP - 60,
      undefined,
      { path: "subtitle", text: s.subtitle },
    ) +
    `</div>`;
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      panel +
      leg +
      `<div data-chart style="position:absolute;left:840px;top:${P.y - 20}px;width:980px;height:${P.h + 60}px;"></div>` +
      grid +
      svg +
      ends +
      xl +
      `<div data-fit="${BOTTOM - NOTE_TOP}" style="position:absolute;left:${P.x - 120}px;top:${NOTE_TOP}px;width:${1820 - P.x + 120}px;box-sizing:border-box;${DENSE}font-size:22px;display:flex;flex-direction:column;gap:.5em;">${noteRows}</div>` +
      footer(t, "light"),
  );
}

/**
 * Footnotes (every content slide): numbered sources and definitions in the
 * footer row, between the division label and the logo, the way a report
 * prints them. Grey on white, white at 75% on the accent surfaces; two lines,
 * then the text shrinks. Not on the cover, dividers, agenda and closing
 * slide, where a note has no reference to belong to.
 */
export const NO_NOTES: ReadonlySet<LayoutId> = new Set<LayoutId>([
  "cover",
  "agenda",
  "section-divider",
  "thank-you",
  "photo-full",
  "a4-page",
  "partner",
]);
const DARK_FOOTER: ReadonlySet<LayoutId> = new Set<LayoutId>(["three-columns", "big-stat", "section-image-deep", "quote"]);

export function footnote(s: Slide): string {
  if (NO_NOTES.has(s.layoutId) || !s.notes?.trim()) return "";
  const color = DARK_FOOTER.has(s.layoutId) ? "rgba(255,255,255,.75)" : "#6F6F6F";
  return `<div ${ed("notes", 50)} data-notes style="position:absolute;left:560px;top:956px;width:920px;font-family:${OPEN_SANS};font-weight:500;font-size:17px;line-height:1.35;color:${color};white-space:pre-line;">${esc(s.notes)}</div>`;
}
