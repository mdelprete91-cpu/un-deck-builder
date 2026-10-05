import type { GridCell } from "./attachments";
import { PRIMARY_ARRAY, SERIES_LAYOUTS, type Bar, type LayoutId } from "./schema";

/**
 * A chart's data from a spreadsheet (Mario, 5 Oct 2026): the Data panel's
 * Import reads an .xlsx, a .csv or a public Google Sheet into the same grid
 * (readWorkbook in attachments.ts, parseCsv in csv.ts, app/api/sheet-source)
 * and this turns the chosen columns into the slide's `bars` and `series`.
 * Deterministic: no model call, the numbers are the sheet's. The mapping is
 * saved on the slide (`chartSource`) so "Update" applies it again.
 */

export interface ChartMapping {
  sheet: string;
  /** Row index of the column headers, -1 when the data starts at once. */
  headerRow: number;
  labelCol: number;
  valueCols: number[];
}

export interface ChartSource {
  kind: "file" | "gsheet";
  /** The file's name, or the sheet's title for a link. */
  name: string;
  /** Google Sheets only: the link it was read from. */
  url?: string;
  mapping: ChartMapping;
  /** When it was last read, ms since 1970. */
  importedAt: number;
}

export interface ChartImport {
  bars: Bar[];
  series?: string[];
  /** What was cut or changed, one short line each. */
  notes: string[];
  /** Nothing to chart: why, in a sentence. */
  error?: string;
}

/** "A", "B", … "AA": how the sheet names a column. */
export function columnLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const filled = (c: GridCell | undefined) => !!c && c.text !== "";
const numberOf = (c: GridCell | undefined): number | undefined => (c?.num !== undefined && Number.isFinite(c.num) ? c.num : undefined);

function firstFilledRow(rows: GridCell[][]): number {
  return rows.findIndex((r) => r.some(filled));
}

/** The rows that carry data under the header, by index. */
function dataRows(rows: GridCell[][], headerRow: number): number[] {
  const from = headerRow >= 0 ? headerRow + 1 : Math.max(0, firstFilledRow(rows));
  const out: number[] = [];
  for (let i = from; i < rows.length; i++) if (rows[i]?.some(filled)) out.push(i);
  return out;
}

/** The columns the sheet uses, with the header's name when there is one: "B · Connected 2024". */
export function columnOptions(rows: GridCell[][], headerRow: number): { index: number; name: string; numeric: boolean }[] {
  const width = rows.reduce((n, r) => Math.max(n, r?.length ?? 0), 0);
  const data = dataRows(rows, headerRow);
  const out: { index: number; name: string; numeric: boolean }[] = [];
  for (let c = 0; c < width; c++) {
    const values = data.map((r) => rows[r][c]).filter(filled);
    if (!values.length && !(headerRow >= 0 && filled(rows[headerRow]?.[c]))) continue;
    const head = headerRow >= 0 ? rows[headerRow]?.[c]?.text : "";
    const numeric = values.length > 0 && values.filter((v) => numberOf(v) !== undefined).length / values.length >= 0.6;
    out.push({ index: c, name: head ? `${columnLetter(c)} · ${head}` : `Column ${columnLetter(c)}`, numeric });
  }
  return out;
}

/** How many series the layout holds: [min, max], [1, 1] for a single-series chart. */
export function seriesSpan(layoutId: LayoutId): [number, number] {
  return SERIES_LAYOUTS[layoutId] ?? [1, 1];
}

/**
 * The likely mapping: headers in the first filled row when it holds no
 * numbers, labels from the first mostly-text column, values from the
 * numeric columns after it, as many as the layout holds.
 */
export function guessMapping(sheet: string, rows: GridCell[][], layoutId: LayoutId): ChartMapping {
  const first = firstFilledRow(rows);
  const headerRow = first >= 0 && rows[first].filter(filled).every((c) => numberOf(c) === undefined) ? first : -1;
  const cols = columnOptions(rows, headerRow);
  const label = cols.find((c) => !c.numeric) ?? cols[0];
  const values = cols.filter((c) => c.numeric && c.index !== label?.index).map((c) => c.index);
  return { sheet, headerRow, labelCol: label?.index ?? 0, valueCols: values.slice(0, seriesSpan(layoutId)[1]) };
}

/** The sheet's rows as the chart's data, within what the layout holds. */
export function tableToChart(rows: GridCell[][], mapping: ChartMapping, layoutId: LayoutId): ChartImport {
  const notes: string[] = [];
  const [minSeries, maxSeries] = seriesSpan(layoutId);
  const multi = !!SERIES_LAYOUTS[layoutId];
  let cols = mapping.valueCols.filter((c, i, all) => all.indexOf(c) === i && c !== mapping.labelCol);
  if (!cols.length) return { bars: [], notes, error: "Pick at least one column of values." };
  if (cols.length > maxSeries) {
    notes.push(multi ? `This chart holds ${maxSeries} series: the first ${maxSeries} columns are used.` : "This chart shows one series: the first value column is used. A grouped, stacked or line chart holds more.");
    cols = cols.slice(0, maxSeries);
  }
  if (multi && cols.length < minSeries) return { bars: [], notes, error: `This chart needs at least ${minSeries} columns of values.` };

  const head = (c: number) => (mapping.headerRow >= 0 ? rows[mapping.headerRow]?.[c]?.text : "") || `Series ${cols.indexOf(c) + 1}`;
  let blanks = 0;
  const all: Bar[] = [];
  for (const r of dataRows(rows, mapping.headerRow)) {
    const row = rows[r];
    const label = row[mapping.labelCol]?.text ?? "";
    const nums = cols.map((c) => numberOf(row[c]));
    if (!label && nums.every((n) => n === undefined)) continue;
    blanks += nums.filter((n) => n === undefined).length;
    const values = nums.map((n) => n ?? 0);
    all.push(multi ? { label: label.slice(0, 60), value: values[0], values } : { label: label.slice(0, 60), value: values[0] });
  }
  if (blanks) notes.push(`${blanks} empty or non-numeric cell${blanks === 1 ? "" : "s"} read as 0.`);

  const limits = PRIMARY_ARRAY[layoutId];
  const min = limits?.min ?? 2;
  const max = limits?.max ?? 5;
  if (all.length < min) return { bars: [], notes, error: `This chart needs at least ${min} rows of data; the selection has ${all.length}.` };
  let bars = all;
  if (all.length > max) {
    notes.push(`This chart holds ${max} rows: showing the first ${max} of ${all.length}.`);
    bars = all.slice(0, max);
  }
  if (layoutId === "donut-chart" && bars.some((b) => b.value < 0)) {
    notes.push("A donut shows shares: negative values were set to 0.");
    bars = bars.map((b) => ({ ...b, value: Math.max(0, b.value) }));
  }
  return { bars, series: multi ? cols.map(head).map((h) => h.slice(0, 40)) : undefined, notes };
}
