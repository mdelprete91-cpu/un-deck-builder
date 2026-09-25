import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import { MANROPE, OPEN_SANS, esc, ed, dly, item, section, footer, heading80 } from "./shared";
import { numeric, fmt } from "./stats";

/**
 * The full-width charts (25 Sep 2026). The template has no slide with thirty
 * columns or a line over time, so these are derived from chart-bars (template
 * 16) with Mario's approval: the same 80px title at the 100/100 origin, the
 * same y axis (max / half / 0) in grey, the same hairline grid, the same
 * tints of the accent, but the plot runs the full 1720px content width under
 * the title instead of sitting beside a legend. Nothing here is a new
 * colour, typeface or surface.
 *
 * Single-series charts (wide columns, horizontal bars) read `bars[i].value`;
 * the series charts (line, grouped, stacked) read `series` and
 * `bars[i].values`, one figure per series, which `normalizeSeries` keeps
 * true. Values on those are edited in the Data panel, so only the category
 * labels and the series names carry `data-edit`.
 */

/** The plot, under a two-line title and the legend row, above the x labels. */
const PLOT = { x: 240, y: 340, w: 1580, h: 460 };
const GRID = "#ECECEF";
const AXIS = `font-family:${OPEN_SANS};font-weight:500;font-size:28px;line-height:1.3;color:#6F6F6F;`;
/** Two lines of the 80px title: 176px of line boxes plus Manrope's descenders (scrollHeight reads 185). */
const TITLE_FIT = 190;
const LEGEND_Y = 292;
const LABEL_TOP = PLOT.y + PLOT.h + 16;

/** Horizontal hairlines at 0, ¼, ½, ¾ and the max. */
function gridLines(): string {
  return Array.from(
    { length: 5 },
    (_, i) =>
      `<div style="position:absolute;left:0;top:${Math.round((PLOT.h / 4) * i)}px;width:${PLOT.w}px;height:1px;background:${GRID};"></div>`,
  ).join("");
}

/** max / half / 0 in the left margin, right-aligned to the plot. */
function yAxis(max: number): string {
  return (
    [
      [0, fmt(max)],
      [PLOT.h / 2, fmt(max / 2)],
      [PLOT.h, "0"],
    ] as [number, string][]
  )
    .map(
      ([top, label]) =>
        `<div style="position:absolute;left:100px;top:${Math.round(PLOT.y + top - 18)}px;width:${PLOT.x - 124}px;text-align:right;${AXIS}">${label}</div>`,
    )
    .join("");
}

/**
 * Category labels under the plot: horizontal up to twelve, else turned 45°
 * so thirty country names still read. A rotation is the one transform the
 * PPTX walker keeps as a native property, so the export follows.
 */
function xLabels(bars: Slide["bars"], colW: number, editable = true): string {
  const n = bars?.length ?? 0;
  const rotated = n > 12;
  // A label owns its column: 26px up to eight, 22px from nine to twelve
  // ("Kazakhstan" at 22px is 120px, a twelfth of the plot is 131). Two
  // lines are budgeted either way, for the two-word names.
  const px = n <= 8 ? 26 : 22;
  const w = Math.round(colW - (n <= 8 ? 12 : 4));
  return (bars ?? [])
    .map((b, i) => {
      const cx = PLOT.x + colW * (i + 0.5);
      const edit = editable ? ed(`bars.${i}.label`, rotated ? 30 : 80) : "";
      return rotated
        ? `<div class="ars" ${edit} style="position:absolute;left:${Math.round(cx - 150)}px;top:${LABEL_TOP + 4}px;width:150px;text-align:right;font-family:${OPEN_SANS};font-weight:500;font-size:22px;line-height:1.2;color:#000000;transform:rotate(-45deg);transform-origin:right top;white-space:nowrap;overflow:hidden;${dly(20 + i * 2)}">${esc(b.label)}</div>`
        : `<div class="ars" ${edit} style="position:absolute;left:${Math.round(cx - w / 2)}px;top:${LABEL_TOP}px;width:${w}px;text-align:center;font-family:${OPEN_SANS};font-weight:500;font-size:${px}px;line-height:1.3;color:#000000;${dly(20 + i * 4)}">${esc(b.label)}</div>`;
    })
    .join("");
}

/**
 * One colour per series. The UNICEF lockups have a categorical series (the
 * Brand Book secondaries, as on the donut); Giga spreads its tints so two or
 * three lines stay apart.
 */
export function seriesColors(t: BrandTheme, k: number): string[] {
  if (t.chartSeries) return t.chartSeries.slice(0, Math.max(1, k));
  const s = t.barShades;
  if (k <= 1) return [s[0]];
  if (k === 2) return [s[0], s[3]];
  if (k === 3) return [s[0], s[2], s[4]];
  return [s[0], s[1], s[3], s[4]];
}

/** The legend row above the plot: a dot and the editable series name. */
function legend(series: string[], colors: string[]): string {
  if (series.length < 2) return "";
  const items = series
    .map(
      (name, j) =>
        `<div style="display:flex;align-items:center;gap:16px;${dly(8 + j * 4)}" class="ars">` +
        `<div style="width:20px;height:20px;border-radius:50%;background:${colors[j]};"></div>` +
        `<div ${ed(`series.${j}`, 40)} style="font-family:${OPEN_SANS};font-weight:500;font-size:28px;line-height:1.3;color:#000000;white-space:nowrap;">${esc(name)}</div>` +
        `</div>`,
    )
    .join("");
  return `<div style="position:absolute;left:${PLOT.x}px;top:${LEGEND_Y}px;display:flex;gap:48px;">${items}</div>`;
}

function valuesOf(b: { value: number; values?: number[] }, k: number): number[] {
  const v = (b.values ?? [b.value]).map(numeric);
  while (v.length < k) v.push(0);
  return v.slice(0, k);
}

const VALUE = (px: number) => `font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.2;color:#000000;text-align:center;white-space:nowrap;`;

/** Columns for many categories, 3-30, one tint, the value on each. */
export function columnsWide(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 30);
  const n = Math.max(bars.length, 1);
  const colW = PLOT.w / n;
  const barW = Math.min(120, Math.round(colW * 0.68));
  const max = Math.max(...bars.map((b) => numeric(b.value)), 1);
  // The figure over each column shrinks with the count; past twenty
  // columns it may spill past its column ("12,450" is wider than 53px),
  // which neighbours tolerate because the values differ in length.
  const px = n <= 8 ? 30 : n <= 16 ? 24 : n <= 22 ? 20 : 16;
  const labelW = Math.round(colW * (n > 12 ? 1.4 : 1));
  const cols = bars
    .map((b, i) => {
      const v = numeric(b.value);
      const h = Math.max(6, Math.round((v / max) * (PLOT.h - px - 20)));
      const x = Math.round(colW * i + (colW - barW) / 2);
      return (
        `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:${x}px;top:${PLOT.h - h}px;width:${barW}px;height:${h}px;background:${b.color ?? t.accent};border-radius:4px 4px 0 0;${dly(10 + i * 2)}"></div>` +
        `<div class="ars" ${ed(`bars.${i}.value`, px + 8)} style="position:absolute;left:${Math.round(colW * (i + 0.5) - labelW / 2)}px;top:${PLOT.h - h - px - 14}px;width:${labelW}px;${VALUE(px)}${dly(14 + i * 2)}">${fmt(v)}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      yAxis(max) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${cols}</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}

/** A ranking: horizontal bars, 2-15 rows, the label at the left and the value at the bar's end. */
export function barsHorizontal(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 15);
  const n = Math.max(bars.length, 1);
  const AREA = { x: 600, y: 300, w: 1080, h: 600 };
  const rowH = Math.min(96, AREA.h / n);
  const barH = Math.round(Math.min(56, rowH * 0.62));
  const px = n <= 8 ? 30 : 24;
  const max = Math.max(...bars.map((b) => numeric(b.value)), 1);
  const rows = bars
    .map((b, i) => {
      const v = numeric(b.value);
      const w = Math.max(6, Math.round((v / max) * AREA.w));
      const y = Math.round(AREA.y + rowH * i + (rowH - barH) / 2);
      return (
        `<div class="ars" ${ed(`bars.${i}.label`, barH + 6)} style="position:absolute;left:100px;top:${y}px;width:${AREA.x - 130}px;height:${barH}px;display:flex;align-items:center;font-family:${OPEN_SANS};font-weight:500;font-size:${px}px;line-height:1.2;color:#000000;${dly(10 + i * 4)}">${esc(b.label)}</div>` +
        `<div class="agw" ${item(`bars.${i}`)} style="position:absolute;left:${AREA.x}px;top:${y}px;width:${w}px;height:${barH}px;background:${b.color ?? t.accent};border-radius:0 4px 4px 0;${dly(10 + i * 4)}"></div>` +
        `<div class="ars" ${ed(`bars.${i}.value`, barH + 6)} style="position:absolute;left:${AREA.x + w + 20}px;top:${y}px;width:200px;height:${barH}px;display:flex;align-items:center;font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.2;color:#000000;white-space:nowrap;${dly(14 + i * 4)}">${fmt(v)}</div>`
      );
    })
    .join("");
  // Vertical hairlines at 0, ½ and the max, their labels under the rows.
  const guides = ([0, 0.5, 1] as const)
    .map(
      (f) =>
        `<div style="position:absolute;left:${Math.round(AREA.x + AREA.w * f)}px;top:${AREA.y}px;width:1px;height:${AREA.h}px;background:${GRID};"></div>` +
        `<div style="position:absolute;left:${Math.round(AREA.x + AREA.w * f - 100)}px;top:${AREA.y + AREA.h + 12}px;width:200px;text-align:center;${AXIS}">${fmt(max * f)}</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      `<div data-chart style="position:absolute;left:${AREA.x}px;top:${AREA.y}px;width:${AREA.w}px;height:${AREA.h}px;"></div>` +
      guides +
      rows +
      footer(t, "light"),
  );
}

/** One to three lines over 3-24 periods; values shown on a single line up to twelve points. */
export function line(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 24);
  const series = (s.series ?? ["Series 1"]).slice(0, 3);
  const k = series.length;
  const colors = seriesColors(t, k);
  const n = Math.max(bars.length, 1);
  const colW = PLOT.w / n;
  const rows = bars.map((b) => valuesOf(b, k));
  const max = Math.max(...rows.flat(), 1);
  const top = 40;
  const yOf = (v: number) => Math.round(PLOT.h - (v / max) * (PLOT.h - top));
  const paths = series
    .map((_, j) => {
      const pts = rows.map((r, i) => `${Math.round(colW * (i + 0.5))},${yOf(r[j])}`);
      const dots = rows
        .map((r, i) => `<circle cx="${Math.round(colW * (i + 0.5))}" cy="${yOf(r[j])}" r="9" fill="${colors[j]}"/>`)
        .join("");
      return `<polyline points="${pts.join(" ")}" fill="none" stroke="${colors[j]}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    })
    .join("");
  const labels =
    k === 1 && n <= 12
      ? rows
          .map(
            (r, i) =>
              `<div class="ars" style="position:absolute;left:${Math.round(colW * i)}px;top:${yOf(r[0]) - 48}px;width:${Math.round(colW)}px;${VALUE(26)}${dly(24 + i * 3)}">${fmt(r[0])}</div>`,
          )
          .join("")
      : "";
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      legend(series, colors) +
      yAxis(max) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}` +
      `<svg class="af" width="${PLOT.w}" height="${PLOT.h}" viewBox="0 0 ${PLOT.w} ${PLOT.h}" style="position:absolute;left:0;top:0;overflow:visible;${dly(16)}">${paths}</svg>` +
      labels +
      `</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}

/** Two or three measures side by side per category, 2-10 categories. */
export function columnsGrouped(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 10);
  const series = (s.series ?? ["Series 1", "Series 2"]).slice(0, 3);
  const k = series.length;
  const colors = seriesColors(t, k);
  const n = Math.max(bars.length, 1);
  const colW = PLOT.w / n;
  const gap = 8;
  const groupW = Math.min(420, colW * 0.74);
  const barW = Math.round((groupW - gap * (k - 1)) / k);
  const rows = bars.map((b) => valuesOf(b, k));
  const max = Math.max(...rows.flat(), 1);
  const showValues = n * k <= 18;
  const px = n <= 5 ? 24 : 20;
  const cols = rows
    .map((r, i) => {
      const x0 = Math.round(colW * i + (colW - groupW) / 2);
      const group = r
        .map((v, j) => {
          const h = Math.max(6, Math.round((v / max) * (PLOT.h - px - 20)));
          const x = x0 + j * (barW + gap);
          return (
            `<div class="agh" style="position:absolute;left:${x}px;top:${PLOT.h - h}px;width:${barW}px;height:${h}px;background:${colors[j]};border-radius:4px 4px 0 0;${dly(10 + i * 3 + j)}"></div>` +
            (showValues
              ? `<div class="ars" style="position:absolute;left:${x - 20}px;top:${PLOT.h - h - px - 12}px;width:${barW + 40}px;${VALUE(px)}${dly(14 + i * 3 + j)}">${fmt(v)}</div>`
              : "")
          );
        })
        .join("");
      return `<div ${item(`bars.${i}`)} style="position:absolute;left:0;top:0;width:0;height:0;">${group}</div>`;
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      legend(series, colors) +
      yAxis(max) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${cols}</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}

/** Parts of a total per category, 2-4 parts stacked, the total on top. */
export function columnsStacked(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 10);
  const series = (s.series ?? ["Part 1", "Part 2"]).slice(0, 4);
  const k = series.length;
  const colors = seriesColors(t, k);
  const n = Math.max(bars.length, 1);
  const colW = PLOT.w / n;
  const barW = Math.min(160, Math.round(colW * 0.6));
  const rows = bars.map((b) => valuesOf(b, k));
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0));
  const max = Math.max(...totals, 1);
  const px = n <= 6 ? 26 : 22;
  const usable = PLOT.h - px - 20;
  const cols = rows
    .map((r, i) => {
      const x = Math.round(colW * i + (colW - barW) / 2);
      const total = Math.round((totals[i] / max) * usable);
      let y = PLOT.h;
      const segs = r
        .map((v, j) => {
          const h = Math.round((v / max) * usable);
          y -= h;
          const radius = j === k - 1 ? "border-radius:4px 4px 0 0;" : "";
          return `<div style="position:absolute;left:0;top:${y}px;width:${barW}px;height:${h}px;background:${colors[j]};${radius}"></div>`;
        })
        .join("");
      return (
        `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:${x}px;top:0;width:${barW}px;height:${PLOT.h}px;${dly(10 + i * 3)}">${segs}</div>` +
        `<div class="ars" style="position:absolute;left:${Math.round(colW * i)}px;top:${PLOT.h - total - px - 12}px;width:${Math.round(colW)}px;${VALUE(px)}${dly(14 + i * 3)}">${fmt(totals[i])}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      legend(series, colors) +
      yAxis(max) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${cols}</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}
