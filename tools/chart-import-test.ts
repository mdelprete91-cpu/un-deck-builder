/**
 * The chart import without the browser: CSV parsing, the workbook grid and
 * the table-to-chart mapping on built cases and the QA workbooks.
 *
 *   npx tsx tools/chart-import-test.ts
 */
import { readFileSync } from "node:fs";
import { readWorkbook } from "../lib/slides/attachments";
import { parseCsv } from "../lib/slides/csv";
import { guessMapping, tableToChart } from "../lib/slides/chart-import";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

async function main() {
  // CSV: European ";" with decimal commas, quotes, a BOM, a blank line, a percentage.
  const eu = parseCsv('﻿Region;Mapped;"Share, %"\r\nNairobi;1.120;79,5%\r\n\r\n"Coast; north";1.340;54\r\n');
  check("csv ; delimiter and BOM", eu[0][0].text === "Region" && eu[0].length === 3);
  check("csv decimal comma and thousands dot", eu[1][1].num === 1120 && eu[1][2].num === 79.5 && eu[1][2].percent === true, JSON.stringify(eu[1]));
  check("csv quoted delimiter", eu[3][0].text === "Coast; north");
  const us = parseCsv('Quarter,Value\nQ1,"1,234.5"\nQ2,−30\nQ3,n/a\n');
  check("csv , delimiter, thousands comma, minus sign", us[1][1].num === 1234.5 && us[2][1].num === -30 && us[3][1].num === undefined, JSON.stringify(us.slice(1)));

  // Mapping on the CSV: labels + one value column on a bar chart.
  const m = guessMapping("csv", eu, "chart-bars");
  check("guess: header row, label col, value col", m.headerRow === 0 && m.labelCol === 0 && m.valueCols[0] === 1, JSON.stringify(m));
  const bars = tableToChart(eu, m, "chart-bars");
  check("bars from csv skip the blank row", bars.bars.length === 2 && bars.bars[1].label === "Coast; north" && bars.bars[1].value === 1340, JSON.stringify(bars));

  // Series chart from the quarterly workbook.
  const q = readFileSync("tools/qa-briefs/quarterly-series.xlsx");
  const grid = await readWorkbook(q.buffer.slice(q.byteOffset, q.byteOffset + q.byteLength) as ArrayBuffer);
  const sheet = grid.sheets[0];
  const qm = guessMapping(sheet.name, sheet.rows, "chart-line");
  const line = tableToChart(sheet.rows, qm, "chart-line");
  check("line chart: 3 series from the headers", JSON.stringify(line.series) === JSON.stringify(["Mapped", "Monitored", "Connected"]), JSON.stringify(line.series));
  check("line chart: first quarter values", JSON.stringify(line.bars[0].values) === JSON.stringify([4000, 1500, 400]) && line.bars[0].label === "Q1 2024", JSON.stringify(line.bars[0]));

  // Over the layout's limits: 30 countries on a 5-bar chart, 4 value columns on a single series.
  const c = readFileSync("tools/qa-briefs/countries-30.xlsx");
  const countries = (await readWorkbook(c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer)).sheets[0];
  const cm = { ...guessMapping(countries.name, countries.rows, "chart-bars"), valueCols: [1, 2, 3] };
  const capped = tableToChart(countries.rows, cm, "chart-bars");
  check("rows capped to the layout with a note", capped.bars.length === 5 && capped.notes.some((n) => /first 5 of 30/.test(n)), capped.notes.join(" / "));
  check("extra value columns noted on a single-series chart", capped.notes.some((n) => /one series/.test(n)));
  check("percent column reads as shown", countries.rows[1][3].num === 20 && countries.rows[1][3].percent === true);

  // Too few rows, and negatives on a donut.
  const tiny = parseCsv("A,1\n");
  check("too few rows is an error", !!tableToChart(tiny, { sheet: "csv", headerRow: -1, labelCol: 0, valueCols: [1] }, "chart-bars").error);
  const neg = parseCsv("Part,Share\nA,60\nB,-10\nC,50\n");
  const donut = tableToChart(neg, guessMapping("csv", neg, "donut-chart"), "donut-chart");
  check("donut negatives set to 0 with a note", donut.bars[1].value === 0 && donut.notes.some((n) => /negative/.test(n)));

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exit(failed ? 1 : 0);
}
main();
