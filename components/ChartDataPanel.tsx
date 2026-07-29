"use client";

import { useEffect, useRef, useState } from "react";
import type { Slide } from "@/lib/slides/schema";
import { numeric } from "@/lib/slides/layouts/stats";

interface Row {
  label: string;
  value: string;
}

interface ChartDataPanelProps {
  slide: Slide;
  onChange: (bars: { label: string; value: number }[]) => void;
  onClose: () => void;
}

const MAX_ROWS = 5;
const MIN_ROWS = 2;

/**
 * Contextual data editor for chart slides (bars + donut): label/value rows,
 * applied live (debounced) so the chart re-scales while you type.
 */
export default function ChartDataPanel({ slide, onChange, onClose }: ChartDataPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Resync from the slide when it changes (slide switch, undo/redo)
  useEffect(() => {
    setRows((slide.bars ?? []).map((b) => ({ label: b.label, value: String(b.value) })));
    dirty.current = false;
  }, [slide.id, slide.bars]);

  const apply = (next: Row[]) => {
    setRows(next);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      onChange(next.map((r) => ({ label: r.label, value: numeric(r.value) })));
    }, 350);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="absolute right-8 top-16 z-20 w-80 rounded-2xl border border-hairline bg-white p-4 shadow-stripe-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-manrope text-sm font-semibold tracking-[-0.01em] text-ink">Chart data</span>
        <button
          onClick={onClose}
          className="rounded-full px-2 py-0.5 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => apply(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
              placeholder="Label"
              className="w-0 flex-1 rounded-lg border border-hairline px-2.5 py-1.5 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted/70 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
            />
            <input
              value={row.value}
              onChange={(e) => apply(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
              placeholder="Value"
              inputMode="decimal"
              className="w-24 rounded-lg border border-hairline px-2.5 py-1.5 text-right text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted/70 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
            />
            <button
              onClick={() => apply(rows.filter((_, j) => j !== i))}
              disabled={rows.length <= MIN_ROWS}
              title="Remove row"
              className="rounded-full px-1 text-ink-muted transition-colors duration-150 hover:text-status-red disabled:opacity-25"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => apply([...rows, { label: `Item ${rows.length + 1}`, value: "0" }])}
        disabled={rows.length >= MAX_ROWS}
        className="mt-3 w-full rounded-lg border border-dashed border-hairline px-3 py-1.5 text-sm font-semibold text-ink-muted transition-colors duration-150 hover:border-giga hover:text-giga disabled:opacity-30"
      >
        + Add row
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        Values are real numbers, the chart scales to the largest. Cmd+Z to undo.
      </p>
    </div>
  );
}
