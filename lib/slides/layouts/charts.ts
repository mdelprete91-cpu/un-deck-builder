import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import { MANROPE, OPEN_SANS, esc, ed, dly, item, section, footer, heading80 } from "./shared";
import { fmt, signedValue } from "./stats";

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

/**
 * The plot, under a two-line title and the legend row, above the x labels.
 * The legend row ends at y 332 and the axis's top label starts at y 354,
 * so the two never meet (they did at y 340, Mario, 25 Sep 2026).
 */
const PLOT = { x: 240, y: 372, w: 1580, h: 440 };
const GRID = "#ECECEF";
const AXIS = `font-family:${OPEN_SANS};font-weight:500;font-size:28px;line-height:1.3;color:#6F6F6F;`;
/** Two lines of the 80px title: 176px of line boxes plus Manrope's descenders (scrollHeight reads 185). */
const TITLE_FIT = 190;
const LEGEND_Y = 296;
const LABEL_TOP = PLOT.y + PLOT.h + 16;

/**
 * The scale of a chart that may hold negatives: the unit of height and the
 * zero line's y inside a plot of `h`, with `room` px kept for the value over
 * the tallest bar and, when a value is negative, as much under the lowest.
 * All positive, it is the scale the charts always had (zero at the bottom,
 * the same expressions in the same order), so their markup does not change.
 */
function scaleOf(values: number[], h: number, room: number) {
  const max = Math.max(...values, 1);
  const lo = Math.min(0, ...values);
  const below = lo < 0 ? room : 0;
  const usable = h - room - below;
  const zero = h - below - (lo < 0 ? Math.round((-lo / (max - lo)) * usable) : 0);
  const size = (v: number) => Math.round((Math.abs(v) / (max - lo)) * usable);
  return { max, lo, zero, size };
}

/** The darker zero line, only when something falls below it. */
function zeroLine(lo: number, zero: number, w = PLOT.w): string {
  return lo < 0 ? `<div style="position:absolute;left:0;top:${zero - 1}px;width:${w}px;height:2px;background:#C9C9CF;"></div>` : "";
}

/** Horizontal hairlines at 0, ¼, ½, ¾ and the max. */
function gridLines(): string {
  return Array.from(
    { length: 5 },
    (_, i) =>
      `<div style="position:absolute;left:0;top:${Math.round((PLOT.h / 4) * i)}px;width:${PLOT.w}px;height:1px;background:${GRID};"></div>`,
  ).join("");
}

/**
 * max / half / 0 in the left margin, right-aligned to the plot. With
 * negative values (28 Sep 2026) the labels are max, 0 on the zero line and
 * the minimum at the bottom, and the zero line is drawn darker (`zeroLine`).
 */
function yAxis(max: number, lo = 0, zero = PLOT.h): string {
  const marks: [number, string][] =
    lo < 0
      ? ([
          [0, fmt(max)],
          [zero, "0"],
          [PLOT.h, fmt(lo)],
        ] as [number, string][]).filter(([top, label], i) => !(i === 0 && (label === "0" || zero - top < 30)))
      : [
          [0, fmt(max)],
          [PLOT.h / 2, fmt(max / 2)],
          [PLOT.h, "0"],
        ];
  return (
    marks
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
  return `<div style="position:absolute;left:${PLOT.x}px;top:${LEGEND_Y}px;width:${PLOT.w}px;display:flex;flex-wrap:wrap;gap:8px 48px;">${items}</div>`;
}

function valuesOf(b: { value: number; values?: number[] }, k: number): number[] {
  const v = (b.values ?? [b.value]).map(signedValue);
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
  // The figure over each column shrinks with the count; past twenty
  // columns it may spill past its column ("12,450" is wider than 53px),
  // which neighbours tolerate because the values differ in length.
  const px = n <= 8 ? 30 : n <= 16 ? 24 : n <= 22 ? 20 : 16;
  const labelW = Math.round(colW * (n > 12 ? 1.4 : 1));
  const { max, lo, zero, size } = scaleOf(bars.map((b) => signedValue(b.value)), PLOT.h, px + 20);
  const cols = bars
    .map((b, i) => {
      const v = signedValue(b.value);
      const h = Math.max(6, size(v));
      const x = Math.round(colW * i + (colW - barW) / 2);
      const down = v < 0;
      return (
        `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:${x}px;top:${down ? zero : zero - h}px;width:${barW}px;height:${h}px;background:${b.color ?? t.accent};border-radius:${down ? "0 0 4px 4px" : "4px 4px 0 0"};${down ? "transform-origin:top;" : ""}${dly(10 + i * 2)}"></div>` +
        `<div class="ars" ${ed(`bars.${i}.value`, px + 8)} style="position:absolute;left:${Math.round(colW * (i + 0.5) - labelW / 2)}px;top:${down ? zero + h + 8 : zero - h - px - 14}px;width:${labelW}px;${VALUE(px)}${dly(14 + i * 2)}">${fmt(v)}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      yAxis(max, lo, zero) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${zeroLine(lo, zero)}${cols}</div>` +
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
  const values = bars.map((b) => signedValue(b.value));
  const max = Math.max(...values, 1);
  // Negatives run left of a zero line inside the same area, the value at
  // the bar's far end on either side (28 Sep 2026). All positive, zero is
  // the area's left edge and the bars are what they always were.
  const lo = Math.min(0, ...values);
  const room = lo < 0 ? 160 : 0;
  const span = max - lo;
  const zeroX = AREA.x + (lo < 0 ? room + Math.round((-lo / span) * (AREA.w - room * 2)) : 0);
  const usableW = AREA.w - room * 2;
  const rows = bars
    .map((b, i) => {
      const v = values[i];
      const w = Math.max(6, Math.round((Math.abs(v) / span) * usableW));
      const y = Math.round(AREA.y + rowH * i + (rowH - barH) / 2);
      const left = v < 0;
      return (
        `<div class="ars" ${ed(`bars.${i}.label`, barH + 6)} style="position:absolute;left:100px;top:${y}px;width:${AREA.x - 130}px;height:${barH}px;display:flex;align-items:center;font-family:${OPEN_SANS};font-weight:500;font-size:${px}px;line-height:1.2;color:#000000;${dly(10 + i * 4)}">${esc(b.label)}</div>` +
        `<div class="agw" ${item(`bars.${i}`)} style="position:absolute;left:${left ? zeroX - w : zeroX}px;top:${y}px;width:${w}px;height:${barH}px;background:${b.color ?? t.accent};border-radius:${left ? "4px 0 0 4px" : "0 4px 4px 0"};${left ? "transform-origin:right center;" : ""}${dly(10 + i * 4)}"></div>` +
        `<div class="ars" ${ed(`bars.${i}.value`, barH + 6)} style="position:absolute;left:${left ? zeroX - w - 220 : zeroX + w + 20}px;top:${y}px;width:200px;height:${barH}px;display:flex;align-items:center;${left ? "justify-content:flex-end;" : ""}font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.2;color:#000000;white-space:nowrap;${dly(14 + i * 4)}">${fmt(v)}</div>`
      );
    })
    .join("");
  // Vertical hairlines at 0, ½ and the max, their labels under the rows;
  // with negatives, at the minimum, 0 (darker) and the max.
  const marks: [number, number][] =
    lo < 0
      ? [
          [zeroX - Math.round((-lo / span) * usableW), lo],
          [zeroX, 0],
          [zeroX + Math.round((max / span) * usableW), max],
        ]
      : ([0, 0.5, 1] as const).map((f) => [Math.round(AREA.x + AREA.w * f), max * f]);
  const guides = marks
    .map(
      ([x, v]) =>
        `<div style="position:absolute;left:${x}px;top:${AREA.y}px;width:${lo < 0 && v === 0 ? 2 : 1}px;height:${AREA.h}px;background:${lo < 0 && v === 0 ? "#C9C9CF" : GRID};"></div>` +
        `<div style="position:absolute;left:${x - 100}px;top:${AREA.y + AREA.h + 12}px;width:200px;text-align:center;${AXIS}">${fmt(v)}</div>`,
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
  const lo = Math.min(0, ...rows.flat());
  // All below zero, the scale tops out at zero (not at a phantom 1).
  const max = lo < 0 ? Math.max(0, ...rows.flat()) || 0.0001 : Math.max(...rows.flat(), 1);
  const top = 40;
  // Below zero the line keeps going (28 Sep 2026); all positive, the same
  // expression as always.
  const yOf = (v: number) => (lo < 0 ? Math.round(PLOT.h - 40 - ((v - lo) / (max - lo)) * (PLOT.h - top - 40)) : Math.round(PLOT.h - (v / max) * (PLOT.h - top)));
  const zero = yOf(0);
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
      yAxis(max, lo, zero) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${zeroLine(lo, zero)}` +
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
  const showValues = n * k <= 18;
  const px = n <= 5 ? 24 : 20;
  const { max, lo, zero, size } = scaleOf(rows.flat(), PLOT.h, px + 20);
  const cols = rows
    .map((r, i) => {
      const x0 = Math.round(colW * i + (colW - groupW) / 2);
      const group = r
        .map((v, j) => {
          const h = Math.max(6, size(v));
          const x = x0 + j * (barW + gap);
          const down = v < 0;
          return (
            `<div class="agh" style="position:absolute;left:${x}px;top:${down ? zero : zero - h}px;width:${barW}px;height:${h}px;background:${colors[j]};border-radius:${down ? "0 0 4px 4px" : "4px 4px 0 0"};${down ? "transform-origin:top;" : ""}${dly(10 + i * 3 + j)}"></div>` +
            (showValues
              ? `<div class="ars" style="position:absolute;left:${x - 20}px;top:${down ? zero + h + 8 : zero - h - px - 12}px;width:${barW + 40}px;${VALUE(px)}${dly(14 + i * 3 + j)}">${fmt(v)}</div>`
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
      yAxis(max, lo, zero) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${zeroLine(lo, zero)}${cols}</div>` +
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
  const px = n <= 6 ? 26 : 22;
  // Positive parts stack up from zero, negative parts stack down from it
  // (28 Sep 2026); the figure is the net total, over the column or under it.
  const ups = rows.map((r) => r.filter((v) => v > 0).reduce((a, b) => a + b, 0));
  const downs = rows.map((r) => r.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  const anyDown = downs.some((d) => d < 0);
  const max = anyDown ? Math.max(...ups, 1) : Math.max(...totals, 1);
  const lo = Math.min(0, ...downs);
  const below = lo < 0 ? px + 20 : 0;
  const usable = PLOT.h - px - 20 - below;
  const span = max - lo;
  const zero = PLOT.h - below - (lo < 0 ? Math.round((-lo / span) * usable) : 0);
  const cols = rows
    .map((r, i) => {
      const x = Math.round(colW * i + (colW - barW) / 2);
      let up = zero;
      let down = zero;
      const segs = r
        .map((v, j) => {
          if (v < 0) {
            const h = Math.round((-v / span) * usable);
            const seg = `<div style="position:absolute;left:0;top:${down}px;width:${barW}px;height:${h}px;background:${colors[j]};"></div>`;
            down += h;
            return seg;
          }
          const h = Math.round((v / span) * usable);
          up -= h;
          const radius = j === k - 1 ? "border-radius:4px 4px 0 0;" : "";
          return `<div style="position:absolute;left:0;top:${up}px;width:${barW}px;height:${h}px;background:${colors[j]};${radius}"></div>`;
        })
        .join("");
      // All positive: the total's own rounding, as the label always sat.
      const labelTop = !anyDown ? PLOT.h - Math.round((totals[i] / max) * usable) - px - 12 : totals[i] < 0 ? down + 8 : up - px - 12;
      return (
        `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:${x}px;top:0;width:${barW}px;height:${PLOT.h}px;${dly(10 + i * 3)}">${segs}</div>` +
        `<div class="ars" style="position:absolute;left:${Math.round(colW * i)}px;top:${labelTop}px;width:${Math.round(colW)}px;${VALUE(px)}${dly(14 + i * 3)}">${fmt(totals[i])}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      legend(series, colors) +
      yAxis(max, lo, zero) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${zeroLine(lo, zero)}${cols}</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}

/*
 * Five more charts (Mario, 6 Oct 2026): a funnel, a waterfall, an area
 * chart, 100% bars and progress towards a target. Same title, grid, axis,
 * legend and tints as the charts above; nothing here is a new colour,
 * typeface or surface, except the waterfall's decrease, which takes the
 * chart palette's red so a fall reads as one.
 */

/** Dark text on the two palest tints, white on the rest. */
function onShade(i: number): string {
  return i >= 3 ? "#000000" : "#FFFFFF";
}

/** Stages narrowing to an outcome, 3-6, the share kept from each step on the right. */
export function funnel(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 6);
  const n = Math.max(bars.length, 1);
  const AREA = { y: 300, h: 600, cx: 1060, maxW: 960 };
  const rowH = Math.min(116, AREA.h / n);
  const barH = Math.round(rowH * 0.8);
  const values = bars.map((b) => Math.max(0, signedValue(b.value)));
  const max = Math.max(...values, 1);
  const px = n <= 4 ? 34 : 28;
  const rows = bars
    .map((b, i) => {
      const v = values[i];
      const w = Math.max(180, Math.round((v / max) * AREA.maxW));
      const y = Math.round(AREA.y + rowH * i + (rowH - barH) / 2);
      const shade = Math.min(i, 4);
      const prev = i > 0 ? values[i - 1] : 0;
      const kept = i > 0 && prev > 0 ? Math.round((v / prev) * 100) : null;
      return (
        `<div class="ars" ${ed(`bars.${i}.label`, barH)} style="position:absolute;left:100px;top:${y}px;width:${AREA.cx - AREA.maxW / 2 - 140}px;height:${barH}px;display:flex;align-items:center;font-family:${OPEN_SANS};font-weight:500;font-size:${px - 2}px;line-height:1.2;color:#000000;${dly(10 + i * 4)}">${esc(b.label)}</div>` +
        `<div class="agw" ${item(`bars.${i}`)} style="position:absolute;left:${Math.round(AREA.cx - w / 2)}px;top:${y}px;width:${w}px;height:${barH}px;border-radius:8px;background:${b.color ?? t.barShades[shade]};transform-origin:center;${dly(10 + i * 4)}"></div>` +
        `<div class="ars" ${ed(`bars.${i}.value`, barH)} style="position:absolute;left:${Math.round(AREA.cx - w / 2)}px;top:${y}px;width:${w}px;height:${barH}px;display:flex;align-items:center;justify-content:center;text-align:center;font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.2;color:${b.color ? "#FFFFFF" : onShade(shade)};white-space:nowrap;${dly(14 + i * 4)}">${fmt(v)}</div>` +
        (kept !== null
          ? `<div class="ars" style="position:absolute;left:${AREA.cx + AREA.maxW / 2 + 60}px;top:${y}px;width:${1820 - (AREA.cx + AREA.maxW / 2 + 60)}px;height:${barH}px;display:flex;flex-direction:column;justify-content:center;${dly(18 + i * 4)}">` +
            `<div style="font-family:${MANROPE};font-weight:600;font-size:30px;line-height:1.1;color:${t.accent};">${kept}%</div>` +
            `<div style="${AXIS}font-size:20px;">of the step above</div></div>`
          : "")
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      `<div data-chart style="position:absolute;left:${AREA.cx - AREA.maxW / 2}px;top:${AREA.y}px;width:${AREA.maxW}px;height:${AREA.h}px;"></div>` +
      rows +
      footer(t, "light"),
  );
}

/**
 * From a starting total to an ending one through the changes between, 3-10
 * bars: the first and the last are totals drawn from zero, the ones between
 * float from the running total, up in the accent, down in red, joined by a
 * dashed line at each level.
 */
export function waterfall(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 10);
  const n = Math.max(bars.length, 1);
  const colW = PLOT.w / n;
  const barW = Math.min(150, Math.round(colW * 0.6));
  const px = n <= 6 ? 28 : 22;
  const values = bars.map((b) => signedValue(b.value));
  // Each bar's span: totals from zero, changes from the running level.
  let level = 0;
  const spans = values.map((v, i) => {
    const total = i === 0 || i === n - 1;
    const from = total ? 0 : level;
    const to = total ? v : level + v;
    level = to;
    return { from, to, total };
  });
  const levels = spans.flatMap((sp) => [sp.from, sp.to]);
  const max = Math.max(...levels, 1);
  const lo = Math.min(0, ...levels);
  const room = px + 20;
  const below = lo < 0 ? room : 0;
  const usable = PLOT.h - room - below;
  const yOf = (v: number) => Math.round(PLOT.h - below - ((v - lo) / (max - lo)) * usable);
  const zero = yOf(0);
  const DOWN = "#E2231A";
  const cols = spans
    .map((sp, i) => {
      const x = Math.round(colW * i + (colW - barW) / 2);
      const top = Math.min(yOf(sp.from), yOf(sp.to));
      const h = Math.max(6, Math.abs(yOf(sp.from) - yOf(sp.to)));
      const up = sp.to >= sp.from;
      const color = bars[i].color ?? (sp.total ? t.barShades[0] : up ? t.barShades[2] : DOWN);
      const label = sp.total ? fmt(sp.to) : `${up ? "+" : ""}${fmt(sp.to - sp.from)}`;
      const labelTop = up || sp.total ? top - px - 12 : top + h + 8;
      // The dashed line from this bar's end to the next bar.
      const link =
        i < n - 1
          ? `<div style="position:absolute;left:${x + barW}px;top:${yOf(sp.to)}px;width:${Math.round(colW - barW)}px;height:0;border-top:2px dashed #C9C9CF;"></div>`
          : "";
      return (
        `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:${x}px;top:${top}px;width:${barW}px;height:${h}px;background:${color};border-radius:4px;${dly(10 + i * 3)}"></div>` +
        link +
        `<div class="ars" ${ed(`bars.${i}.value`, px + 8)} style="position:absolute;left:${Math.round(colW * i)}px;top:${labelTop}px;width:${Math.round(colW)}px;${VALUE(px)}${dly(14 + i * 3)}">${label}</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      yAxis(max, lo, zero) +
      `<div data-chart style="position:absolute;left:${PLOT.x}px;top:${PLOT.y}px;width:${PLOT.w}px;height:${PLOT.h}px;">${gridLines()}${zeroLine(lo, zero)}${cols}</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}

/** Lines over time with the area under each filled, 1-3 series over 3-24 periods. */
export function area(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 24);
  const series = (s.series ?? ["Series 1"]).slice(0, 3);
  const k = series.length;
  const colors = seriesColors(t, k);
  const n = Math.max(bars.length, 1);
  const colW = PLOT.w / n;
  const rows = bars.map((b) => valuesOf(b, k).map((v) => Math.max(0, v)));
  const max = Math.max(...rows.flat(), 1);
  const top = 40;
  const yOf = (v: number) => Math.round(PLOT.h - (v / max) * (PLOT.h - top));
  const xOf = (i: number) => Math.round(colW * (i + 0.5));
  // The first series drawn last, on top.
  const shapes = series
    .map((_, j) => {
      const pts = rows.map((r, i) => `${xOf(i)},${yOf(r[j])}`);
      const fill = `${xOf(0)},${PLOT.h} ${pts.join(" ")} ${xOf(n - 1)},${PLOT.h}`;
      return (
        `<polygon points="${fill}" fill="${colors[j]}" fill-opacity="0.18"/>` +
        `<polyline points="${pts.join(" ")}" fill="none" stroke="${colors[j]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`
      );
    })
    .reverse()
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
      `<svg class="af" width="${PLOT.w}" height="${PLOT.h}" viewBox="0 0 ${PLOT.w} ${PLOT.h}" style="position:absolute;left:0;top:0;overflow:visible;${dly(16)}">${shapes}</svg>` +
      labels +
      `</div>` +
      xLabels(bars, colW) +
      footer(t, "light"),
  );
}

/** Composition compared across categories: one bar per row split into shares of 100%, 2-4 parts. */
export function bars100(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 8);
  const series = (s.series ?? ["Part 1", "Part 2"]).slice(0, 4);
  const k = series.length;
  const colors = seriesColors(t, k);
  const n = Math.max(bars.length, 1);
  const AREA = { x: 560, y: 380, w: 1260, h: 480 };
  const rowH = Math.min(104, AREA.h / n);
  const barH = Math.round(Math.min(64, rowH * 0.66));
  const px = n <= 5 ? 28 : 24;
  const rows = bars
    .map((b, i) => {
      const parts = valuesOf(b, k).map((v) => Math.max(0, v));
      const total = parts.reduce((a, c) => a + c, 0) || 1;
      const y = Math.round(AREA.y + rowH * i + (rowH - barH) / 2);
      let x = 0;
      const segs = parts
        .map((v, j) => {
          const w = Math.round((v / total) * AREA.w);
          const pct = Math.round((v / total) * 100);
          const seg =
            `<div style="position:absolute;left:${x}px;top:0;width:${w}px;height:${barH}px;background:${colors[j]};${j === 0 ? "border-radius:4px 0 0 4px;" : ""}${j === k - 1 ? "border-radius:0 4px 4px 0;" : ""}"></div>` +
            (w >= 72
              ? `<div style="position:absolute;left:${x}px;top:0;width:${w}px;height:${barH}px;display:flex;align-items:center;justify-content:center;text-align:center;font-family:${MANROPE};font-weight:600;font-size:${px - 2}px;color:${lightColor(colors[j]) ? "#000000" : "#FFFFFF"};white-space:nowrap;">${pct}%</div>`
              : "");
          x += w;
          return seg;
        })
        .join("");
      return (
        `<div class="ars" ${ed(`bars.${i}.label`, barH + 6)} style="position:absolute;left:100px;top:${y}px;width:${AREA.x - 130}px;height:${barH}px;display:flex;align-items:center;font-family:${OPEN_SANS};font-weight:500;font-size:${px}px;line-height:1.2;color:#000000;${dly(10 + i * 4)}">${esc(b.label)}</div>` +
        `<div class="agw" ${item(`bars.${i}`)} style="position:absolute;left:${AREA.x}px;top:${y}px;width:${AREA.w}px;height:${barH}px;transform-origin:left;${dly(10 + i * 4)}">${segs}</div>`
      );
    })
    .join("");
  const guides = [0, 0.5, 1]
    .map(
      (f) =>
        `<div style="position:absolute;left:${Math.round(AREA.x + AREA.w * f)}px;top:${AREA.y}px;width:1px;height:${AREA.h}px;background:${GRID};"></div>` +
        `<div style="position:absolute;left:${Math.round(AREA.x + AREA.w * f) - 100}px;top:${AREA.y + AREA.h + 12}px;width:200px;text-align:center;${AXIS}">${Math.round(f * 100)}%</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      legend(series, colors) +
      `<div data-chart style="position:absolute;left:${AREA.x}px;top:${AREA.y}px;width:${AREA.w}px;height:${AREA.h}px;"></div>` +
      guides +
      rows +
      footer(t, "light"),
  );
}

/** Indicators against their targets, 1-5: a track per indicator, filled to the share reached. */
export function progressTarget(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 5);
  const n = Math.max(bars.length, 1);
  const AREA = { x: 100, y: 320, w: 1360, h: 560 };
  const rowH = Math.min(176, AREA.h / n);
  const rows = bars
    .map((b, i) => {
      const [current, target] = valuesOf(b, 2).map((v) => Math.max(0, v));
      const share = target > 0 ? current / target : 0;
      const pct = Math.round(share * 100);
      // Fewer rows sit in the middle of the area, not at its top.
      const y = Math.round(AREA.y + (AREA.h - rowH * n) / 2 + rowH * i);
      const fill = Math.max(share > 0 ? 28 : 0, Math.round(Math.min(1, share) * AREA.w));
      return (
        // The name on the left and "640 of 1,000" at the track's end, on one
        // line over the track: five rows fit under a two-line title.
        `<div class="ars" ${ed(`bars.${i}.label`, 44)} style="position:absolute;left:${AREA.x}px;top:${y}px;width:${AREA.w - 320}px;font-family:${OPEN_SANS};font-weight:600;font-size:32px;line-height:1.3;color:#000000;white-space:nowrap;overflow:hidden;${dly(10 + i * 4)}">${esc(b.label)}</div>` +
        `<div class="ars" style="position:absolute;left:${AREA.x + AREA.w - 300}px;top:${y + 4}px;width:300px;text-align:right;${AXIS}white-space:nowrap;${dly(16 + i * 4)}">${fmt(current)} of ${fmt(target)}</div>` +
        `<div ${item(`bars.${i}`)} style="position:absolute;left:${AREA.x}px;top:${y + 56}px;width:${AREA.w}px;height:28px;border-radius:14px;background:${GRID};"></div>` +
        `<div class="agw" style="position:absolute;left:${AREA.x}px;top:${y + 56}px;width:${fill}px;height:28px;border-radius:14px;background:${b.color ?? t.accent};transform-origin:left;${dly(12 + i * 4)}"></div>` +
        `<div class="ars" style="position:absolute;left:${AREA.x + AREA.w + 40}px;top:${y + (n <= 3 ? 8 : 18)}px;width:${1820 - AREA.x - AREA.w - 40}px;text-align:right;font-family:${MANROPE};font-weight:500;font-size:${n <= 3 ? 88 : 64}px;line-height:1;letter-spacing:-.02em;color:${t.accent};${dly(16 + i * 4)}">${pct}%</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, TITLE_FIT) +
      `<div data-chart style="position:absolute;left:${AREA.x}px;top:${AREA.y}px;width:${AREA.w}px;height:${AREA.h}px;"></div>` +
      rows +
      footer(t, "light"),
  );
}

/** Whether a fill is pale enough to want dark text (the pale tints, yellow). */
function lightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
}
