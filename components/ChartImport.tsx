"use client";

import { Check, FileSpreadsheet, Link2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import Select from "@/components/Select";
import { readWorkbook, type GridCell, type WorkbookGrid } from "@/lib/slides/attachments";
import { parseCsv } from "@/lib/slides/csv";
import { columnOptions, guessMapping, seriesSpan, tableToChart, type ChartImport as ChartImportResult, type ChartMapping, type ChartSource } from "@/lib/slides/chart-import";
import type { LayoutId } from "@/lib/slides/schema";

/** A sheet read and ready to map: its grid, and where it came from. */
export interface LoadedSource {
  kind: ChartSource["kind"];
  name: string;
  url?: string;
  grid: WorkbookGrid;
}

const FILE_ACCEPT = ".xlsx,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const INPUT =
  "w-0 flex-1 rounded-lg border border-hairline px-2.5 py-1.5 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15";

/** An .xlsx or .csv file from the computer as a grid. */
export async function readSourceFile(file: File): Promise<LoadedSource> {
  const name = file.name.slice(0, 200);
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    return { kind: "file", name, grid: { sheets: [{ name: file.name.replace(/\.csv$/i, ""), rows: parseCsv(await file.text()) }] } };
  }
  if (!/\.xlsx?m?$/i.test(file.name)) throw new Error("Choose an Excel (.xlsx) or CSV file.");
  if (/\.xls$/i.test(file.name)) throw new Error("This is an old .xls file: save it as .xlsx in Excel and try again.");
  return { kind: "file", name, grid: await readWorkbook(await file.arrayBuffer()) };
}

/** A public Google Sheet through app/api/sheet-source, every sheet included. */
export async function readSheetLink(url: string): Promise<LoadedSource> {
  const res = await fetch("/api/sheet-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  if (!res.ok) throw new Error((await res.text()) || "Could not read the sheet.");
  const name = decodeURIComponent(res.headers.get("X-Sheet-Name") ?? "Google Sheet");
  return { kind: "gsheet", name, url: url.trim(), grid: await readWorkbook(await res.arrayBuffer()) };
}

/** The saved mapping applied to a source read again: null when its sheet is gone. */
export function reapply(loaded: LoadedSource, mapping: ChartMapping, layoutId: LayoutId): ChartImportResult | null {
  const sheet = loaded.grid.sheets.find((s) => s.name === mapping.sheet) ?? (loaded.grid.sheets.length === 1 ? loaded.grid.sheets[0] : undefined);
  return sheet ? tableToChart(sheet.rows, { ...mapping, sheet: sheet.name }, layoutId) : null;
}

/**
 * The Data panel's import (Mario, 5 Oct 2026): a file or a public Google
 * Sheet, then the sheet, the header row, the labels and the values, guessed
 * and editable, with a preview of what the chart will get. Import hands back
 * the bars and the link to save on the slide; nothing reaches the slide
 * before that. The panel's own tokens and controls, no new chrome.
 */
export default function ChartImport({
  layoutId,
  initial,
  onImport,
  onCancel,
}: {
  layoutId: LayoutId;
  /** A source already read (Update when its sheet moved): opens on the mapping. */
  initial?: { loaded: LoadedSource; mapping?: ChartMapping; error?: string };
  onImport: (result: ChartImportResult, source: ChartSource) => void;
  onCancel: () => void;
}) {
  const [loaded, setLoaded] = useState<LoadedSource | null>(initial?.loaded ?? null);
  const [mapping, setMapping] = useState<ChartMapping | null>(() =>
    initial?.loaded ? (initial.mapping ?? guessMapping(initial.loaded.grid.sheets[0].name, initial.loaded.grid.sheets[0].rows, layoutId)) : null,
  );
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initial?.error ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [minSeries, maxSeries] = seriesSpan(layoutId);
  const multi = maxSeries > 1;

  const take = (next: LoadedSource) => {
    setLoaded(next);
    const first = next.grid.sheets.find((s) => s.rows.some((r) => r.some((c) => c.text))) ?? next.grid.sheets[0];
    setMapping(guessMapping(first.name, first.rows, layoutId));
    setError(null);
  };
  const run = async (read: () => Promise<LoadedSource>) => {
    setBusy(true);
    setError(null);
    try {
      take(await read());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the data.");
    } finally {
      setBusy(false);
    }
  };

  const rows: GridCell[][] = useMemo(() => loaded?.grid.sheets.find((s) => s.name === mapping?.sheet)?.rows ?? [], [loaded, mapping?.sheet]);
  const columns = useMemo(() => (mapping ? columnOptions(rows, mapping.headerRow) : []), [rows, mapping]);
  const result = useMemo(() => (mapping ? tableToChart(rows, mapping, layoutId) : null), [rows, mapping, layoutId]);
  // The first rows with something in them are the header candidates.
  const headerChoices = useMemo(() => {
    const out: number[] = [];
    rows.forEach((r, i) => {
      if (out.length < 8 && r.some((c) => c.text)) out.push(i);
    });
    return out;
  }, [rows]);

  if (!loaded || !mapping) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-muted">Bring the numbers from a spreadsheet. The chart remembers where they came from, so you can update it later.</p>
        <input
          ref={fileRef}
          type="file"
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run(() => readSourceFile(file));
          }}
        />
        <Button variant="secondary" icon={FileSpreadsheet} onClick={() => fileRef.current?.click()} disabled={busy} className="w-full">
          Choose an Excel or CSV file
        </Button>
        <div className="flex items-center gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && link.trim()) void run(() => readSheetLink(link));
            }}
            placeholder="Or paste a Google Sheets link"
            aria-label="Google Sheets link"
            className={INPUT}
          />
          <Button variant="secondary" icon={Link2} onClick={() => void run(() => readSheetLink(link))} disabled={busy || !link.trim()}>
            Load
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-faint">A Google Sheet must be shared as “Anyone with the link can view”.</p>
        {busy && <p className="text-xs text-ink-muted" aria-live="polite">Reading…</p>}
        {error && <p className="text-xs leading-relaxed text-status-red">{error}</p>}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const setSheet = (name: string) => {
    const sheet = loaded.grid.sheets.find((s) => s.name === name);
    if (sheet) setMapping(guessMapping(sheet.name, sheet.rows, layoutId));
  };
  const toggleValue = (c: number) => {
    const on = mapping.valueCols.includes(c);
    const next = on ? mapping.valueCols.filter((x) => x !== c) : [...mapping.valueCols, c].sort((a, b) => a - b);
    setMapping({ ...mapping, valueCols: next });
  };
  const preview = result?.bars.slice(0, 4) ?? [];

  return (
    <div className="flex min-h-0 flex-col">
      <p className="truncate text-[13px] text-ink-muted">
        {loaded.kind === "gsheet" ? "Google Sheet" : "File"} · <span className="text-ink">{loaded.name}</span>
      </p>
      <div className="mt-2 flex min-h-0 flex-col overflow-y-auto">
        {loaded.grid.sheets.length > 1 && (
          <Row label="Sheet">
            <Select ariaLabel="Sheet" value={mapping.sheet} options={loaded.grid.sheets.map((s) => ({ value: s.name, label: s.name }))} onChange={setSheet} />
          </Row>
        )}
        <Row label="Headers">
          <Select
            ariaLabel="Header row"
            value={String(mapping.headerRow)}
            options={[
              ...headerChoices.map((i) => ({ value: String(i), label: `Row ${i + 1}`, hint: rows[i].map((c) => c.text).filter(Boolean).slice(0, 3).join(" · ") })),
              { value: "-1", label: "No header row" },
            ]}
            onChange={(v) => setMapping({ ...mapping, headerRow: Number(v) })}
          />
        </Row>
        <Row label="Labels">
          <Select
            ariaLabel="Labels column"
            value={String(mapping.labelCol)}
            options={columns.map((c) => ({ value: String(c.index), label: c.name }))}
            onChange={(v) => setMapping({ ...mapping, labelCol: Number(v), valueCols: mapping.valueCols.filter((x) => x !== Number(v)) })}
          />
        </Row>
        {multi ? (
          <div className="border-b border-hairline-light py-2">
            <p className="text-sm text-ink">Values</p>
            <p className="text-[11px] text-ink-faint">
              One column per series, {minSeries === maxSeries ? maxSeries : `${minSeries} to ${maxSeries}`}
            </p>
            <div className="mt-1.5 flex flex-col gap-0.5">
              {columns
                .filter((c) => c.index !== mapping.labelCol)
                .map((c) => {
                  const on = mapping.valueCols.includes(c.index);
                  return (
                    <button
                      key={c.index}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleValue(c.index)}
                      className={`flex min-h-8 items-center gap-2.5 rounded-[10px] px-2 text-left text-sm transition-colors duration-100 ${on ? "bg-giga-tint text-giga" : "text-ink hover:bg-mist"} ${c.numeric ? "" : "opacity-60"}`}
                    >
                      <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${on ? "border-giga bg-giga text-white" : "border-mist-deep bg-surface"}`}>
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 truncate">{c.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <Row label="Values">
            <Select
              ariaLabel="Values column"
              value={String(mapping.valueCols[0] ?? "")}
              options={columns.filter((c) => c.index !== mapping.labelCol).map((c) => ({ value: String(c.index), label: c.name }))}
              onChange={(v) => setMapping({ ...mapping, valueCols: [Number(v)] })}
            />
          </Row>
        )}

        {/* What the chart will get: the first rows, then the count and anything cut. */}
        <div className="mt-3 rounded-xl bg-canvas-2 px-3 py-2.5" aria-live="polite">
          {result?.error ? (
            <p className="text-xs leading-relaxed text-status-red">
              {columns.some((c) => c.numeric && c.index !== mapping.labelCol) ? result.error : "This sheet has no columns of numbers to chart. Pick another sheet or file."}
            </p>
          ) : (
            <>
              <table className="w-full text-xs tabular-nums">
                <tbody>
                  {preview.map((b, i) => (
                    <tr key={i}>
                      <td className="truncate py-0.5 pr-2 text-ink">{b.label || "—"}</td>
                      {(b.values ?? [b.value]).map((v, j) => (
                        <td key={j} className="py-0.5 pl-2 text-right text-ink-muted">
                          {v.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {result?.bars.length} row{result?.bars.length === 1 ? "" : "s"}
                {result?.series ? ` · ${result.series.length} series: ${result.series.join(", ")}` : ""}
              </p>
              {result?.notes.map((n) => (
                <p key={n} className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                  {n}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs leading-relaxed text-status-red">{error}</p>}
      <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => (initial ? onCancel() : (setLoaded(null), setMapping(null)))}>
          {initial ? "Cancel" : "Back"}
        </Button>
        <Button
          variant="primary"
          disabled={!result || !!result.error}
          onClick={() => result && onImport(result, { kind: loaded.kind, name: loaded.name, url: loaded.url, mapping, importedAt: Date.now() })}
        >
          Import
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between gap-3 border-b border-hairline-light">
      <span className="text-sm text-ink">{label}</span>
      {children}
    </div>
  );
}
