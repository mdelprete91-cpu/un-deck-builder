import type { Slide, LayoutId } from "../schema";
import type { BrandTheme } from "../brand";
import { iconInner } from "../icons";
import { MANROPE, OPEN_SANS, HAIRLINE, esc, ed, dly, item, columns, section, footer, coverFooterDark, photoPanel, chartShades } from "./shared";
import { DENSE, CARD, BOTTOM, GAP, BAND_H, topOf, title, pointsOf, bullets, band, hasBand } from "./dense";
import { seriesColors } from "./charts";
import { fmt, signedValue, numeric } from "./stats";
import { stagesSlide } from "./progress";

/**
 * High-density variants (Mario, 28 Sep 2026): the same layouts, the same
 * fields, drawn for slides that carry 150-250 words (a consulting deck, a
 * report), picked from the "High density" tab of the layout picker or set by
 * a replica of a dense source slide (`density: "high"` on the slide). The
 * grammar is the one the five dense layouts established: the 60px title on
 * up to two lines, #F7F7F7 cards, Manrope 30px headers in the accent, Open
 * Sans 24px points sized in em under one `data-fit` container per text group
 * (a group shrinks as one, 18px at worst), the band for a key message, the
 * charts' grid, axes and series colours. Nothing new in colour or type; the
 * standard renderers are untouched (renderSlide picks these only when the
 * slide says so).
 */

const PAD = "32px 8px 28px 36px";
/** A block's text in a card: its label as the header, its points or body below, one budget for both. */
const cardText = (s: Slide, i: number, fit: number, group: string, ink?: { text: string; dot: string }, headColor?: string) => {
  const b = (s.blocks ?? [])[i];
  return bullets(pointsOf(b, i), fit, group, { path: `blocks.${i}.label`, text: b.label, color: headColor }, ink);
};
/** The zone under the title, above the band when there is one. */
const zone = (s: Slide) => {
  const top = topOf(s);
  const bottom = hasBand(s) ? BOTTOM - BAND_H - GAP : BOTTOM;
  return { top, bottom, h: bottom - top };
};
const withBand = (s: Slide, bottom: number) => (hasBand(s) ? band(s, bottom + GAP) : "");

/* ------------------------------------------------------------------ */
/*  Cards and columns                                                  */
/* ------------------------------------------------------------------ */

/** Card grid: 4 → 2x2, fewer → columns; every card a header and its points. */
function fourCards(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 4);
  const { top, bottom, h } = zone(s);
  const grid = blocks.length === 4;
  const cols = grid ? { xs: [100, 978, 100, 978], width: 842 } : columns(Math.max(blocks.length, 1));
  const cardH = grid ? Math.floor((h - GAP) / 2) : h;
  const cards = blocks
    .map((_, i) => {
      const x = cols.xs[i];
      const y = grid && i >= 2 ? top + cardH + GAP : top;
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${x}px;top:${y}px;width:${cols.width}px;height:${cardH}px;box-sizing:border-box;background:${CARD};padding:${PAD};${dly(8 + i * 8)}">` +
        cardText(s, i, cardH - 60, "cards") +
        `</div>`
      );
    })
    .join("");
  return section(t, "#FFFFFF", "#000000", title(s) + cards + withBand(s, bottom) + footer(t, "light"));
}

/** Icon cards: the icon over the header, the points under it. */
function iconCards(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 4);
  const { top, bottom, h } = zone(s);
  const { xs, width } = columns(Math.max(blocks.length, 1));
  const cards = blocks
    .map(
      (_, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:${top}px;width:${width}px;height:${h}px;box-sizing:border-box;background:${CARD};padding:${PAD};${dly(8 + i * 8)}">` +
        `<svg data-icon-pick="${i}" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="${t.accent}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin-bottom:18px;">${iconInner(s.icons?.[i], i)}</svg>` +
        cardText(s, i, h - 60 - 90, "cards") +
        `</div>`,
    )
    .join("");
  return section(t, "#FFFFFF", "#000000", title(s) + cards + withBand(s, bottom) + footer(t, "light"));
}

/** Numbered cards: the step number over the header and points. */
function steps(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 4);
  const { top, bottom, h } = zone(s);
  const { xs, width } = columns(Math.max(blocks.length, 1));
  const cards = blocks
    .map(
      (_, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:${top}px;width:${width}px;height:${h}px;box-sizing:border-box;background:${CARD};padding:${PAD};${dly(8 + i * 8)}">` +
        `<div style="font-family:${MANROPE};font-weight:600;font-size:44px;line-height:1.1;color:var(--accent);margin-bottom:16px;">${i + 1}</div>` +
        cardText(s, i, h - 60 - 64, "cards", undefined, "#000000") +
        `</div>`,
    )
    .join("");
  return section(t, "#FFFFFF", "#000000", title(s) + cards + withBand(s, bottom) + footer(t, "light"));
}

/** Three columns on the deep surface: number, header and points in white. */
function threeColumns(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 3);
  const top = topOf(s);
  const h = BOTTOM - top;
  const { xs, width } = columns(Math.max(blocks.length, 1));
  const ink = { text: "#FFFFFF", dot: "var(--accent-soft)" };
  const cols = blocks
    .map(
      (_, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:${top}px;width:${width}px;height:${h}px;${dly(10 + i * 8)}">` +
        `<div style="font-family:${MANROPE};font-weight:600;font-size:44px;line-height:1.1;color:var(--accent-soft);margin-bottom:16px;">${i + 1}</div>` +
        cardText(s, i, h - 64, "cols", ink, "#FFFFFF") +
        `</div>`,
    )
    .join("");
  return section(t, "var(--accent-deep)", "#FFFFFF", title(s, "#FFFFFF") + cols + footer(t, "dark"));
}

/** Rows of header + points; `photo` puts the photo panel at that side. */
function rows(s: Slide, t: BrandTheme, photo?: "left" | "right"): string {
  const blocks = (s.blocks ?? []).slice(0, photo ? 4 : 6);
  const left = photo === "left" ? 920 : 100;
  const width = photo ? 880 : 1720;
  const top = topOf(s, width);
  const labelW = photo ? 0 : 280;
  const list = blocks
    .map((b, i) => {
      const points = pointsOf(b, i)
        .map(({ text, path }) =>
          /^[-–]\s/.test(text)
            ? `<div style="padding-left:.94em;"><div ${ed(path)} style="padding-left:.9em;text-indent:-.9em;">${esc(text.replace(/^-\s/, "– "))}</div></div>`
            : `<div style="display:flex;gap:.6em;"><span style="flex:0 0 auto;width:.34em;height:.34em;margin-top:.53em;border-radius:50%;background:var(--accent);"></span><div ${ed(path)} style="flex:1;min-width:0;">${esc(text)}</div></div>`,
        )
        .join("");
      const head = `<div ${ed(`blocks.${i}.label`)} style="${labelW ? `flex:0 0 ${labelW}px;` : "margin-bottom:.35em;"}font-family:${MANROPE};font-weight:600;font-size:1.25em;line-height:1.3;color:var(--accent);">${esc(b.label)}</div>`;
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="${labelW ? "display:flex;gap:40px;" : ""}padding:.7em 0;border-bottom:1px solid ${HAIRLINE};${dly(8 + i * 6)}">` +
        head +
        `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.4em;">${points}</div>` +
        `</div>`
      );
    })
    .join("");
  const panel = photo ? photoPanel(photo === "left" ? 0 : 1080, s.image, 840, s.imagePos, s.map) : "";
  return section(
    t,
    "#FFFFFF",
    "#000000",
    panel +
      title(s, "#000000", width, left) +
      `<div data-fit="${BOTTOM - top}" style="position:absolute;left:${left}px;top:${top}px;width:${width + 28}px;box-sizing:border-box;padding-right:28px;${DENSE}display:flex;flex-direction:column;">${list}</div>` +
      footer(t, "light", photo === "right" ? s.logoTone : undefined),
  );
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

const STAT = (px: number, color = "var(--accent)") =>
  `font-family:${MANROPE};font-weight:500;font-size:${px}px;line-height:1.05;letter-spacing:-.02em;color:${color};white-space:nowrap;`;

/**
 * Stat grid and Stats + intro: a paragraph under the title when there is
 * one (`body`), then up to six figures in three columns, each a value and a
 * label of up to 30 words. Values share one size (data-fit-group "stat").
 */
function statGrid(s: Slide, t: BrandTheme): string {
  const stats = (s.stats ?? []).slice(0, 6);
  const top = topOf(s);
  const intro = s.body?.trim()
    ? `<div class="ar" ${ed("body", 108)} style="position:absolute;left:100px;top:${top}px;width:1720px;${DENSE}font-size:26px;">${esc(s.body)}</div>`
    : "";
  const gridTop = intro ? top + 140 : top;
  const n = Math.max(stats.length, 1);
  const perRow = n <= 3 ? n : 3;
  const rowsN = Math.ceil(n / perRow);
  const { xs, width } = columns(perRow);
  const rowH = Math.floor((BOTTOM - gridTop - GAP * (rowsN - 1)) / rowsN);
  const cells = stats
    .map((st, i) => {
      const x = xs[i % perRow];
      const y = gridTop + Math.floor(i / perRow) * (rowH + GAP);
      return (
        `<div class="ars" ${item(`stats.${i}`)} style="position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${rowH}px;box-sizing:border-box;border-top:4px solid var(--accent);padding-top:22px;${dly(8 + i * 5)}">` +
        `<div ${ed(`stats.${i}.value`, 84, "stat")} style="${STAT(72)}padding-right:28px;">${esc(st.value)}</div>` +
        `<div ${ed(`stats.${i}.label`, rowH - 26 - 96)} style="margin-top:12px;${DENSE}padding-right:28px;">${esc(st.label)}</div>` +
        `</div>`
      );
    })
    .join("");
  return section(t, "#FFFFFF", "#000000", title(s) + intro + cells + footer(t, "light"));
}

/** Two stats: each a large value beside a long explanation, in two rows. */
function twoStats(s: Slide, t: BrandTheme): string {
  const stats = (s.stats ?? []).slice(0, 2);
  const top = topOf(s);
  const n = Math.max(stats.length, 1);
  const rowH = Math.floor((BOTTOM - top - GAP * (n - 1)) / n);
  const rowsHtml = stats
    .map(
      (st, i) =>
        `<div class="ars" ${item(`stats.${i}`)} style="position:absolute;left:100px;top:${top + i * (rowH + GAP)}px;width:1720px;height:${rowH}px;box-sizing:border-box;background:${CARD};padding:32px 36px;display:flex;gap:48px;${dly(10 + i * 10)}">` +
        `<div ${ed(`stats.${i}.value`, rowH - 64, "stat")} style="flex:0 0 560px;${STAT(96)}white-space:normal;">${esc(st.value)}</div>` +
        `<div ${ed(`stats.${i}.label`, rowH - 64)} style="flex:1;min-width:0;${DENSE}font-size:26px;padding-right:28px;">${esc(st.label)}</div>` +
        `</div>`,
    )
    .join("");
  return section(t, "#FFFFFF", "#000000", title(s) + rowsHtml + footer(t, "light"));
}

/** One figure and the paragraph that explains it; `dark` is the big-stat surface. */
function oneStat(s: Slide, t: BrandTheme, dark: boolean): string {
  const top = topOf(s);
  const color = dark ? "#FFFFFF" : "var(--accent)";
  const text = dark ? "#FFFFFF" : "#000000";
  const hasTitle = !!s.title?.trim();
  return section(
    t,
    dark ? "var(--accent-deep)" : "#FFFFFF",
    text,
    (hasTitle ? title(s, text) : "") +
      `<div class="ar" ${ed("stat", 200)} style="position:absolute;left:100px;top:${hasTitle ? top : 100}px;width:720px;${STAT(180, color)}">${esc(s.stat)}</div>` +
      `<div class="ar" ${ed("support", BOTTOM - (hasTitle ? top : 100) - 40)} style="position:absolute;left:880px;top:${hasTitle ? top + 16 : 116}px;width:940px;${DENSE}font-size:28px;line-height:1.45;color:${text};padding-right:28px;box-sizing:border-box;${dly(14)}">${esc(s.support)}</div>` +
      footer(t, dark ? "dark" : "light"),
  );
}

/* ------------------------------------------------------------------ */
/*  Charts: the explanation card left, the chart right                 */
/* ------------------------------------------------------------------ */

const P = { x: 900, w: 920, h: 360 };
/** The plot runs down to the x labels above the footer: its height depends on where it starts. */
const plotH = (y: number, rotated = false) => BOTTOM - y - (rotated ? 120 : 60);
const AXIS = `font-family:${OPEN_SANS};font-weight:500;font-size:22px;line-height:1.3;color:#6F6F6F;`;
const VALUE = (px: number) => `font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.2;color:#000000;text-align:center;white-space:nowrap;`;

function explanation(s: Slide, top: number): string {
  return (
    `<div class="ars" style="position:absolute;left:100px;top:${top}px;width:720px;height:${BOTTOM - top}px;box-sizing:border-box;background:${CARD};padding:${PAD};${dly(6)}">` +
    bullets(
      (s.bullets ?? []).map((text, j) => ({ text, path: `bullets.${j}` })),
      BOTTOM - top - 60,
      undefined,
      { path: "subtitle", text: s.subtitle },
    ) +
    `</div>`
  );
}

function legendRow(names: string[], colors: string[], y: number): string {
  if (names.length < 2) return "";
  return (
    `<div style="position:absolute;left:${P.x}px;top:${y}px;width:${P.w}px;display:flex;flex-wrap:wrap;gap:6px 28px;">` +
    names
      .map(
        (name, j) =>
          `<div class="ars" style="display:flex;align-items:center;gap:10px;${dly(8 + j * 4)}"><div style="width:16px;height:16px;border-radius:50%;background:${colors[j]};"></div><div ${ed(`series.${j}`, 30)} style="${AXIS}color:#000000;white-space:nowrap;">${esc(name)}</div></div>`,
      )
      .join("") +
    `</div>`
  );
}

/** Vertical scale with a zero line: values may be negative. */
function vscale(values: number[], h: number, room: number) {
  const max = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = max - lo || 1;
  const below = lo < 0 ? room : 0;
  const usable = h - room - below;
  const zero = room + Math.round((max / span) * usable);
  return { max, lo, zero, size: (v: number) => Math.max(4, Math.round((Math.abs(v) / span) * usable)) };
}

function axisAndGrid(y: number, max: number, lo: number, zero: number, h: number): string {
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => `<div style="position:absolute;left:${P.x}px;top:${Math.round(y + h * f)}px;width:${P.w}px;height:1px;background:#ECECEF;"></div>`)
    .join("");
  // Each figure once: all negative, the top of the scale is zero itself.
  const marks = ([[0, max], [zero, 0], [h, lo]] as [number, number][]).filter(([, v], i, a) => a.findIndex(([, w]) => w === v) === i && (i !== 2 || lo < 0));
  return (
    grid +
    `<div style="position:absolute;left:${P.x}px;top:${y + zero - 1}px;width:${P.w}px;height:2px;background:#C9C9CF;"></div>` +
    marks
      .map(([top, v]) => `<div style="position:absolute;left:${P.x - 110}px;top:${Math.round(y + top - 14)}px;width:96px;text-align:right;${AXIS}">${fmt(v)}</div>`)
      .join("")
  );
}

function xLabels(labels: string[], y: number, colW: number): string {
  const rotated = labels.length > 10;
  return labels
    .map((l, i) => {
      const cx = P.x + colW * (i + 0.5);
      return rotated
        ? `<div class="ars" ${ed(`bars.${i}.label`, 30)} style="position:absolute;left:${Math.round(cx - 140)}px;top:${y + 6}px;width:140px;text-align:right;${AXIS}color:#000000;transform:rotate(-45deg);transform-origin:right top;white-space:nowrap;overflow:hidden;${dly(18 + i)}">${esc(l)}</div>`
        : `<div class="ars" ${ed(`bars.${i}.label`, 60)} style="position:absolute;left:${Math.round(cx - colW / 2 + 4)}px;top:${y}px;width:${Math.round(colW - 8)}px;text-align:center;${AXIS}color:#000000;${dly(18 + i * 2)}">${esc(l)}</div>`;
    })
    .join("");
}

const valuesOf = (b: { value: number; values?: number[] }, k: number) => {
  const v = (b.values?.length ? b.values : [b.value]).map(signedValue);
  while (v.length < k) v.push(0);
  return v.slice(0, k);
};

/** Columns, one series (chart-bars, columns-wide), grouped or stacked. */
function columnsChart(s: Slide, t: BrandTheme, mode: "single" | "grouped" | "stacked"): string {
  const top = topOf(s);
  const bars = (s.bars ?? []).slice(0, mode === "single" ? 30 : 10);
  const series = mode === "single" ? [""] : (s.series ?? []).slice(0, mode === "stacked" ? 4 : 3);
  const k = Math.max(series.length, 1);
  const colors = mode === "single" ? bars.map((b, i) => b.color ?? (s.layoutId === "chart-bars" ? chartShades(t, bars.length)[i % bars.length] : t.accent)) : seriesColors(t, k);
  const legendY = top;
  const y = top + (mode === "single" ? 30 : 70);
  const rows = bars.map((b) => valuesOf(b, k));
  const stackUp = rows.map((r) => r.filter((v) => v > 0).reduce((a, b) => a + b, 0));
  const stackDown = rows.map((r) => r.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  const scaleVals = mode === "stacked" ? [...stackUp, ...stackDown] : rows.flat();
  const n = Math.max(bars.length, 1);
  const px = n <= 6 ? 22 : n <= 12 ? 18 : 14;
  const H = plotH(y, bars.length > 10);
  const { max, lo, zero, size } = vscale(scaleVals, H, px + 14);
  const colW = P.w / n;
  const showValues = n * (mode === "grouped" ? k : 1) <= 16;
  const cols = rows
    .map((r, i) => {
      const x0 = P.x + colW * i;
      if (mode === "stacked") {
        const barW = Math.min(90, colW * 0.6);
        let up = y + zero;
        let down = y + zero;
        const segs = r
          .map((v, j) => {
            const h = size(v);
            if (v < 0) {
              const seg = `<div style="position:absolute;left:${Math.round(x0 + (colW - barW) / 2)}px;top:${down}px;width:${Math.round(barW)}px;height:${h}px;background:${colors[j]};"></div>`;
              down += h;
              return seg;
            }
            up -= h;
            return `<div style="position:absolute;left:${Math.round(x0 + (colW - barW) / 2)}px;top:${up}px;width:${Math.round(barW)}px;height:${h}px;background:${colors[j]};"></div>`;
          })
          .join("");
        const total = r.reduce((a, b) => a + b, 0);
        const label = showValues
          ? `<div style="position:absolute;left:${Math.round(x0)}px;top:${total < 0 ? down + 6 : up - px - 10}px;width:${Math.round(colW)}px;${VALUE(px)}">${fmt(total)}</div>`
          : "";
        return `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:0;top:0;width:0;height:0;${dly(10 + i * 2)}">${segs}${label}</div>`;
      }
      const groupW = mode === "grouped" ? Math.min(colW * 0.8, 70 * k) : Math.min(colW * 0.64, 110);
      const barW = mode === "grouped" ? (groupW - 6 * (k - 1)) / k : groupW;
      const inner = r
        .map((v, j) => {
          const h = size(v);
          const x = Math.round(x0 + (colW - groupW) / 2 + j * (barW + 6));
          const downBar = v < 0;
          return (
            `<div style="position:absolute;left:${x}px;top:${downBar ? y + zero : y + zero - h}px;width:${Math.round(barW)}px;height:${h}px;background:${mode === "single" ? colors[i] : colors[j]};border-radius:${downBar ? "0 0 3px 3px" : "3px 3px 0 0"};"></div>` +
            (showValues
              ? `<div ${mode === "single" ? ed(`bars.${i}.value`, px + 8) : ""} style="position:absolute;left:${x - 30}px;top:${downBar ? y + zero + h + 6 : y + zero - h - px - 10}px;width:${Math.round(barW) + 60}px;${VALUE(px)}">${fmt(v)}</div>`
              : "")
          );
        })
        .join("");
      return `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:0;top:0;width:0;height:0;${dly(10 + i * 2)}">${inner}</div>`;
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      explanation(s, top) +
      legendRow(series, colors, legendY) +
      `<div data-chart style="position:absolute;left:${P.x}px;top:${y}px;width:${P.w}px;height:${H}px;"></div>` +
      axisAndGrid(y, max, lo, zero, H) +
      cols +
      xLabels(bars.map((b) => b.label), y + H + 14, colW) +
      footer(t, "light"),
  );
}

/** Horizontal bars, a ranking; negatives run left of zero. */
function hbarsChart(s: Slide, t: BrandTheme): string {
  const top = topOf(s);
  const bars = (s.bars ?? []).slice(0, 15);
  const n = Math.max(bars.length, 1);
  const values = bars.map((b) => signedValue(b.value));
  const max = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = max - lo || 1;
  const labelW = 260;
  const area = { x: P.x + labelW, w: P.w - labelW - 120, y: top + 10, h: BOTTOM - top - 70 };
  const zeroX = area.x + Math.round((-lo / span) * area.w);
  const rowH = Math.min(96, area.h / n);
  const barH = Math.round(Math.min(56, rowH * 0.6));
  const px = n <= 8 ? 22 : 18;
  const rowsHtml = bars
    .map((b, i) => {
      const v = values[i];
      const w = Math.max(4, Math.round((Math.abs(v) / span) * area.w));
      const yy = Math.round(area.y + rowH * i + (rowH - barH) / 2);
      const left = v < 0;
      return (
        `<div class="ars" ${ed(`bars.${i}.label`, barH + 6)} style="position:absolute;left:${P.x}px;top:${yy}px;width:${labelW - 20}px;height:${barH}px;display:flex;align-items:center;${AXIS}font-size:${px}px;color:#000000;${dly(10 + i * 3)}">${esc(b.label)}</div>` +
        `<div class="agw" ${item(`bars.${i}`)} style="position:absolute;left:${left ? zeroX - w : zeroX}px;top:${yy}px;width:${w}px;height:${barH}px;background:${b.color ?? t.accent};border-radius:${left ? "3px 0 0 3px" : "0 3px 3px 0"};${left ? "transform-origin:right center;" : ""}${dly(10 + i * 3)}"></div>` +
        `<div class="ars" style="position:absolute;left:${left ? zeroX - w - 110 : zeroX + w + 10}px;top:${yy}px;width:100px;height:${barH}px;display:flex;align-items:center;${left ? "justify-content:flex-end;" : ""}${VALUE(px)}${dly(14 + i * 3)}">${fmt(v)}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      explanation(s, top) +
      `<div data-chart style="position:absolute;left:${area.x}px;top:${area.y}px;width:${area.w}px;height:${area.h}px;"></div>` +
      `<div style="position:absolute;left:${zeroX - 1}px;top:${area.y}px;width:2px;height:${n * rowH}px;background:#C9C9CF;"></div>` +
      rowsHtml +
      footer(t, "light"),
  );
}

/** Line chart, one to three series, the value at each line's end. */
function lineChart(s: Slide, t: BrandTheme): string {
  const top = topOf(s);
  const bars = (s.bars ?? []).slice(0, 24);
  const series = (s.series?.length ? s.series : [""]).slice(0, 3);
  const k = series.length;
  const colors = seriesColors(t, k);
  const y = top + 70;
  const rows = bars.map((b) => valuesOf(b, k));
  const H = plotH(y, bars.length > 10);
  const { max, lo, zero } = vscale(rows.flat(), H, 30);
  const span = max - lo || 1;
  const usable = H - 30 - (lo < 0 ? 30 : 0);
  const n = Math.max(bars.length, 1);
  const colW = P.w / n;
  const xOf = (i: number) => P.x + colW * (i + 0.5);
  const yOf = (v: number) => y + zero - Math.round((v / span) * usable);
  const paths = series
    .map((_, j) => `<polyline points="${rows.map((r, i) => `${xOf(i).toFixed(1)},${yOf(r[j])}`).join(" ")}" fill="none" stroke="${colors[j]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join("");
  const ends = series
    .map((_, j) => {
      const last = rows.length - 1;
      if (last < 0) return "";
      const v = rows[last][j];
      return (
        `<div style="position:absolute;left:${Math.round(xOf(last) - 7)}px;top:${yOf(v) - 7}px;width:14px;height:14px;border-radius:50%;background:${colors[j]};pointer-events:none;"></div>` +
        `<div style="position:absolute;left:${Math.round(xOf(last) + 14)}px;top:${yOf(v) - 14}px;width:90px;${VALUE(20)}text-align:left;pointer-events:none;">${fmt(v)}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      explanation(s, top) +
      legendRow(series, colors, top) +
      `<div data-chart style="position:absolute;left:${P.x}px;top:${y}px;width:${P.w}px;height:${H}px;"></div>` +
      axisAndGrid(y, max, lo, zero, H) +
      `<svg class="af" width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;${dly(14)}">${paths}</svg>` +
      ends +
      xLabels(bars.map((b) => b.label), y + H + 14, colW) +
      footer(t, "light"),
  );
}

/** Donut: shares only (never negative), the legend with its figures under it. */
function donut(s: Slide, t: BrandTheme): string {
  const top = topOf(s);
  const segs = (s.bars ?? []).slice(0, 5);
  const series = t.chartSeries ?? chartShades(t, segs.length);
  const shades = segs.map((seg, i) => seg.color ?? series[i % series.length]);
  const total = segs.reduce((sum, seg) => sum + numeric(seg.value), 0) || 1;
  let angle = 0;
  const stops = segs.map((seg, i) => {
    const end = angle + (numeric(seg.value) / total) * 360;
    const stop = `${shades[i]} ${angle.toFixed(1)}deg ${end.toFixed(1)}deg`;
    angle = end;
    return stop;
  });
  const size = Math.min(520, BOTTOM - top - 20);
  const legend = segs
    .map(
      (seg, i) =>
        `<div class="ars" ${item(`bars.${i}`)} style="display:flex;align-items:center;gap:14px;${dly(12 + i * 5)}"><div style="flex:0 0 auto;width:16px;height:16px;border-radius:50%;background:${shades[i]};"></div><div ${ed(`bars.${i}.label`, 60)} style="flex:1;min-width:0;${DENSE}">${esc(seg.label)}</div><div style="${VALUE(22)}">${fmt(numeric(seg.value))}</div></div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      explanation(s, top) +
      `<div class="af" data-chart style="position:absolute;left:${P.x}px;top:${top}px;width:${size}px;height:${size}px;border-radius:50%;background:conic-gradient(${stops.join(", ")});"><div style="position:absolute;left:${Math.round(size * 0.25)}px;top:${Math.round(size * 0.25)}px;width:${Math.round(size * 0.5)}px;height:${Math.round(size * 0.5)}px;border-radius:50%;background:#FFFFFF;"></div></div>` +
      `<div style="position:absolute;left:${P.x + size + 40}px;top:${top + 10}px;width:${P.w - size - 40}px;display:flex;flex-direction:column;gap:18px;">${legend}</div>` +
      footer(t, "light"),
  );
}

/* ------------------------------------------------------------------ */

/** The dense renderer of each layout that has one. */
export const DENSE_RENDERERS: Partial<Record<LayoutId, (s: Slide, t: BrandTheme) => string>> = {
  "four-cards": fourCards,
  "icon-cards": iconCards,
  steps,
  "three-columns": threeColumns,
  callout: (s, t) => rows(s, t, "right"),
  list: (s, t) => rows(s, t),
  "example-image-left": (s, t) => rows(s, t, "left"),
  "example-image-right": (s, t) => rows(s, t, "right"),
  "stat-grid": statGrid,
  "brand-equity": statGrid,
  "two-stats": twoStats,
  "single-stat": (s, t) => oneStat(s, t, false),
  "big-stat": (s, t) => oneStat(s, t, true),
  "chart-bars": (s, t) => columnsChart(s, t, "single"),
  "chart-columns-wide": (s, t) => columnsChart(s, t, "single"),
  "chart-columns-grouped": (s, t) => columnsChart(s, t, "grouped"),
  "chart-columns-stacked": (s, t) => columnsChart(s, t, "stacked"),
  "chart-bars-horizontal": hbarsChart,
  "chart-line": lineChart,
  "donut-chart": donut,
  timeline: (s, t) => stagesSlide(s, t, "timeline", true),
  "timeline-phases": (s, t) => stagesSlide(s, t, "timeline", true),
  progress: (s, t) => stagesSlide(s, t, "progress", true),
};

/**
 * Agenda, proposed (Mario, 28 Sep 2026: "the font sizes differ with the
 * amount of text"). Every item had its own one-line budget, so a long
 * chapter title shrank on its own. Here the items share one budget and one
 * size: a long title wraps to a second line at the size of the others, its
 * text hanging after the number, and the whole list shrinks together only
 * when it cannot fit. Not wired yet: shown beside the current agenda for
 * approval.
 */
export function agendaProposal(s: Slide, t: BrandTheme): string {
  const items = (s.bullets ?? [])
    .map(
      (bullet, i) =>
        `<div class="ars" ${item(`bullets.${i}`)} style="display:flex;gap:.35em;padding:.12em 0;${dly(10 + i * 6)}">` +
        `<span style="flex:0 0 auto;white-space:pre;">${String(i + 1).padStart(2, "0")} |</span>` +
        `<span ${ed(`bullets.${i}`)} style="flex:1;min-width:0;">${esc(bullet)}</span>` +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "var(--accent)",
    "#FFFFFF",
    `<div class="ar" ${ed("title", 780)} style="position:absolute;left:100px;top:100px;width:770px;font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1.05;letter-spacing:-.02em;color:#FFFFFF;">${esc(s.title ?? "Agenda")}</div>` +
      `<div data-fit="790" style="position:absolute;left:920px;top:100px;width:925px;box-sizing:border-box;padding-right:28px;display:flex;flex-direction:column;gap:.3em;font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.12;letter-spacing:-.02em;color:#FFFFFF;">${items}</div>` +
      coverFooterDark(t),
  );
}
