import type { GridCell } from "./attachments";

/**
 * A CSV file as the same grid the workbook reader gives (one sheet), for the
 * chart import. RFC 4180: quoted fields may hold the delimiter, line breaks
 * and doubled quotes. The delimiter is guessed from the first line, since
 * Excel in most of Europe saves with ";" (and "," is then the decimal mark),
 * and a tab file works the same way. A leading BOM is dropped.
 */
export function parseCsv(text: string): GridCell[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].map((d) => [d, countOutsideQuotes(firstLine, d)] as const).sort((a, b) => b[1] - a[1])[0];
  const sep = delimiter[1] > 0 ? delimiter[0] : ",";
  const decimalComma = sep === ";" || sep === "\t";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((raw) => cellOf(raw.trim(), decimalComma)));
}

function countOutsideQuotes(line: string, d: string): number {
  let n = 0;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === d && !quoted) n++;
  }
  return n;
}

/** "1,234.5", "1.234,5" (with ";"), "12%", "−3", "$40" read as numbers; anything else stays text. */
function cellOf(text: string, decimalComma: boolean): GridCell {
  if (!text) return { text: "" };
  const percent = /%\s*$/.test(text);
  let t = text.replace(/[−–]/g, "-").replace(/[%$€£\s]/g, "");
  t = decimalComma ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { text };
  const num = Number(t);
  return Number.isFinite(num) ? { text, num, ...(percent ? { percent: true } : {}) } : { text };
}
