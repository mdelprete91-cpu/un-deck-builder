import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import {
  MANROPE,
  BODY30,
  BODY32,
  esc,
  ed,
  dly,
  item,
  section,
  footer,
  heading80,
  chartShades,
} from "./shared";

// nowrap: a stat value must never break onto two lines — the autofit shrinks
// it to fit the column width instead (e.g. "$500M").
const STAT_VALUE = `font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1;letter-spacing:-.02em;color:var(--accent);white-space:nowrap;`;

function statBlock(
  path: string,
  x: number,
  y: number,
  width: number,
  value: string,
  label: string,
  delay: number,
  labelStyle = BODY32,
): string {
  return (
    `<div class="ars" ${item(path)} style="position:absolute;left:${x}px;top:${y}px;width:${width}px;${dly(delay)}">` +
    `<div ${ed(`${path}.value`, 180)} style="${STAT_VALUE}">${esc(value)}</div>` +
    `<div ${ed(`${path}.label`, 110)} style="margin-top:8px;${labelStyle}color:#000000;">${esc(label)}</div>` +
    `</div>`
  );
}

/**
 * Row-major slot positions for 1–6 stats in the right area of the slide.
 * 6 matches the template grid; fewer stats spread out to stay balanced.
 */
function statSlots(n: number, colA: number, colB: number): [number, number][] {
  switch (Math.max(1, Math.min(6, n))) {
    case 1:
      return [[colA, 250]];
    case 2:
      return [
        [colA, 100],
        [colA, 450],
      ];
    case 3:
      return [
        [colA, 100],
        [colA, 372],
        [colA, 644],
      ];
    case 4:
      return [
        [colA, 150],
        [colB, 150],
        [colA, 500],
        [colB, 500],
      ];
    case 5:
      return [
        [colA, 100],
        [colB, 100],
        [colA, 372],
        [colB, 372],
        [colA, 644],
      ];
    default:
      return [
        [colA, 100],
        [colB, 100],
        [colA, 372],
        [colB, 372],
        [colA, 644],
        [colB, 644],
      ];
  }
}

/** 1–6 stats beside the title (template 11). */
export function statGrid(s: Slide, t: BrandTheme): string {
  const stats = (s.stats ?? []).slice(0, 6);
  const slots = statSlots(stats.length, 920, 1390);
  const rendered = stats
    .map((st, i) =>
      statBlock(`stats.${i}`, slots[i][0], slots[i][1], 430, st.value, st.label, 8 + i * 4),
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 800, 620) + rendered + footer(t, "light"),
  );
}

/** Title + intro paragraph + 1–6 stats. */
export function brandEquity(s: Slide, t: BrandTheme): string {
  const stats = (s.stats ?? []).slice(0, 6);
  const slots = statSlots(stats.length, 813, 1345);
  const rendered = stats
    .map((st, i) =>
      statBlock(
        `stats.${i}`,
        slots[i][0],
        slots[i][1],
        455,
        st.value,
        st.label,
        10 + i * 4,
        `font-family:'Open Sans',sans-serif;font-weight:500;font-size:21px;line-height:1.3;`,
      ),
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 670, 340) +
      `<div class="ar" ${ed("body", 350)} style="position:absolute;left:100px;top:454px;width:670px;${BODY30}animation-delay:.12s;">${esc(s.body)}</div>` +
      rendered +
      footer(t, "light"),
  );
}

/** 1–2 large stats with explanations (template 12). */
export function twoStats(s: Slide, t: BrandTheme): string {
  const stats = (s.stats ?? []).slice(0, 2);
  const tops = stats.length === 1 ? [230] : [96, 439];
  const rows = stats
    .map(
      (st, i) =>
        `<div ${item(`stats.${i}`)} style="position:absolute;left:907px;top:${tops[i]}px;width:931px;height:300px;">` +
        // 500px value slot: a 6-char figure ("99.9M+") fits at full 144px
        `<div class="ars" ${ed(`stats.${i}.value`, 185)} style="position:absolute;left:0;top:0;width:500px;white-space:nowrap;font-family:${MANROPE};font-weight:400;font-size:144px;line-height:152px;letter-spacing:-.01em;color:var(--accent);${dly(10 + i * 12)}">${esc(st.value)}</div>` +
        `<div class="ars" ${ed(`stats.${i}.label`, 300)} style="position:absolute;left:530px;top:4px;width:401px;${BODY32}color:#000000;${dly(16 + i * 12)}">${esc(st.label)}</div>` +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 760, 700) + rows + footer(t, "light"),
  );
}

export function singleStat(s: Slide, t: BrandTheme): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 880, 700) +
      // Number and description meet in the middle: the number is anchored to
      // the bottom of its zone and grows upward (up to 2 lines), the
      // description sits 32px below it and grows downward (up to ~6 lines).
      `<div style="position:absolute;left:1030px;top:64px;width:790px;height:426px;display:flex;flex-direction:column;justify-content:flex-end;">` +
      `<div class="ar" ${ed("stat", 426)} style="font-family:${MANROPE};font-weight:500;font-size:213px;line-height:1;letter-spacing:-.02em;color:var(--accent);animation-delay:.1s;">${esc(s.stat)}</div>` +
      `</div>` +
      `<div class="ar" ${ed("support", 300)} style="position:absolute;left:1030px;top:522px;width:790px;${BODY32}animation-delay:.18s;">${esc(s.support)}</div>` +
      footer(t, "light"),
  );
}

/** Legend row (dot + label + value) used by the two chart layouts. */
function legendRow(
  path: string,
  x: number,
  y: number,
  color: string,
  text: string,
  delay: number,
  value?: string,
): string {
  return (
    `<div class="ars" ${item(path.replace(/\.label$/, ""))} style="position:absolute;left:${x}px;top:${y}px;display:flex;align-items:center;gap:24px;${dly(delay)}">` +
    `<div style="width:20px;height:20px;border-radius:50%;background:${color};"></div>` +
    `<div ${ed(path, 60)} style="${BODY32}color:#000000;">${esc(text)}</div>` +
    (value ? `<div style="${BODY32}font-weight:700;color:#000000;">${esc(value)}</div>` : "") +
    `</div>`
  );
}

/** Coerce an edited value ("10,000", "45%") into a number. */
export function numeric(value: unknown): number {
  const n = parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

const fmt = (n: number): string =>
  n >= 1000 ? `${Math.round(n).toLocaleString("en-US")}` : `${Math.round(n * 10) / 10}`;

/**
 * Column chart with grid lines and legend, 2–5 bars (template 16).
 * Values are real data: the chart scales to the largest bar, each bar shows
 * its editable value on top, and the y axis reads 0 / half / max.
 */
export function chartBars(s: Slide, t: BrandTheme): string {
  const bars = (s.bars ?? []).slice(0, 5);
  const shades = chartShades(t, bars.length);
  const AREA = { x: 1042, y: 108, w: 753, h: 705 };
  const colW = AREA.w / bars.length;
  const barW = Math.min(156, Math.round(colW) - 40);
  const max = Math.max(...bars.map((b) => numeric(b.value)), 1);

  const grid = Array.from(
    { length: 11 },
    (_, i) =>
      `<div style="position:absolute;left:0;top:${Math.round((AREA.h / 10) * i)}px;width:${AREA.w}px;height:1px;background:#ECECEF;"></div>`,
  ).join("");
  const cols = bars
    .map((b, i) => {
      const v = numeric(b.value);
      const h = Math.max(6, Math.round((v / max) * (AREA.h - 87)));
      const x = Math.round(colW * i + (colW - barW) / 2);
      return (
        `<div class="agh" ${item(`bars.${i}`)} style="position:absolute;left:${x}px;top:${AREA.h - h}px;width:${barW}px;height:${h}px;background:${shades[i % shades.length]};border-radius:4px 4px 0 0;${dly(10 + i * 8)}"></div>` +
        `<div class="ars" ${ed(`bars.${i}.value`, 44)} style="position:absolute;left:${x - 30}px;top:${AREA.h - h - 48}px;width:${barW + 60}px;text-align:center;font-family:${MANROPE};font-weight:600;font-size:30px;line-height:1.2;color:#000000;${dly(14 + i * 8)}">${fmt(v)}</div>`
      );
    })
    .join("");
  const yAxis = [
    [84, fmt(max)],
    [398, fmt(max / 2)],
    [789, "0"],
  ]
    .map(
      ([top, label]) =>
        `<div style="position:absolute;left:858px;top:${top}px;width:156px;text-align:right;${BODY32}color:#6F6F6F;">${label}</div>`,
    )
    .join("");
  const legend = bars
    .map((b, i) => legendRow(`bars.${i}.label`, 102, 346 + i * 115, shades[i % shades.length], b.label, 12 + i * 6, fmt(numeric(b.value))))
    .join("");

  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 740, 230) +
      legend +
      yAxis +
      `<div style="position:absolute;left:${AREA.x}px;top:${AREA.y}px;width:${AREA.w}px;height:${AREA.h}px;">${grid}${cols}</div>` +
      footer(t, "light"),
  );
}

/** Donut chart with legend, 2–5 segments (template 13). */
export function donutChart(s: Slide, t: BrandTheme): string {
  const segments = (s.bars ?? []).slice(0, 5);
  const shades = chartShades(t, segments.length);
  const total = segments.reduce((sum, seg) => sum + numeric(seg.value), 0) || 1;
  const GAP = 3;
  let angle = 0;
  const stops: string[] = [];
  segments.forEach((seg, i) => {
    const sweep = (numeric(seg.value) / total) * 360;
    const end = angle + sweep;
    stops.push(`${shades[i % shades.length]} ${angle.toFixed(1)}deg ${Math.max(angle, end - GAP).toFixed(1)}deg`);
    stops.push(`#FFFFFF ${Math.max(angle, end - GAP).toFixed(1)}deg ${end.toFixed(1)}deg`);
    angle = end;
  });
  const legend = segments
    .map((seg, i) => legendRow(`bars.${i}.label`, 102, 358 + i * 115, shades[i % shades.length], seg.label, 12 + i * 6, fmt(numeric(seg.value))))
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 950, 240) +
      legend +
      `<div class="af" style="position:absolute;left:1110px;top:113px;width:715px;height:715px;border-radius:50%;background:conic-gradient(${stops.join(", ")});">` +
      `<div style="position:absolute;left:178px;top:178px;width:359px;height:359px;border-radius:50%;background:#FFFFFF;"></div>` +
      `</div>` +
      footer(t, "light"),
  );
}

/** Timeline as a gradient band with labels above/below, 2–5 points (template 17/18). */
export function timeline(s: Slide, t: BrandTheme): string {
  const items = (s.blocks ?? []).slice(0, 5);
  const n = Math.max(items.length, 2);
  const band = items
    .map((_, i) => {
      const opacity = Math.max(0.2, (i + 6 - n) / 5);
      return `<div style="flex:1;background:var(--accent);opacity:${opacity.toFixed(1)};"></div>`;
    })
    .join("");
  const colW = 1816 / n;
  const below = Math.floor(n / 2);
  const labels = items
    .map((b, i) => {
      const x = Math.round(104 + i * colW + 2);
      const top = i < below ? 624 : 199;
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${x}px;top:${top}px;width:${Math.round(colW) - 60}px;${dly(18 + i * 8)}">` +
        `<div ${ed(`blocks.${i}.label`, 60)} style="font-family:${MANROPE};font-weight:600;font-size:40px;line-height:56px;letter-spacing:-.01em;color:#161616;">${esc(b.label)}</div>` +
        `<div ${ed(`blocks.${i}.body`, 165)} style="margin-top:12px;${BODY30}color:#000000;">${esc(b.body)}</div>` +
        `</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, 110) +
      `<div class="agw" style="position:absolute;left:104px;top:446px;width:1816px;height:138px;display:flex;animation-delay:.12s;">${band}</div>` +
      labels +
      footer(t, "light"),
  );
}

/** Phase columns spread evenly: Phase N / accent bar / month / description, 2–5 phases. */
export function timelinePhases(s: Slide, t: BrandTheme): string {
  const phases = (s.blocks ?? []).slice(0, 5);
  const n = phases.length;
  const step = n > 1 ? (1720 - 280) / (n - 1) : 0;
  const cols = phases
    .map(
      (p, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${Math.round(100 + i * step)}px;top:300px;width:280px;${dly(10 + i * 8)}">` +
        `<div style="font-family:${MANROPE};font-weight:600;font-size:32px;line-height:1.32;color:var(--accent);">Phase ${i + 1}</div>` +
        `<div style="margin-top:60px;height:8px;background:var(--accent);"></div>` +
        `<div ${ed(`blocks.${i}.label`, 45)} style="margin-top:38px;font-family:${MANROPE};font-weight:600;font-size:32px;line-height:1.32;color:#161616;">${esc(p.label)}</div>` +
        `<div ${ed(`blocks.${i}.body`, 200)} style="margin-top:14px;${BODY30}color:#000000;">${esc(p.body)}</div>` +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, 190) + cols + footer(t, "light"),
  );
}
