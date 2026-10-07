/**
 * Writes the two-pager block spreadsheet (lib/slides/page-catalog.ts) to
 * docs/two-pager-blocks.csv, for people: the same table the model reads
 * before it plans a piece. Run with `npx tsx tools/export-catalog.ts`.
 */
import { writeFileSync } from "node:fs";
import { CATALOG_COLUMNS, catalogRows } from "../lib/slides/page-catalog";

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
const csv = [CATALOG_COLUMNS.map(cell).join(","), ...catalogRows().map((r) => r.map(cell).join(","))].join("\n") + "\n";
writeFileSync("docs/two-pager-blocks.csv", csv);
console.log(`docs/two-pager-blocks.csv: ${catalogRows().length} blocks`);
