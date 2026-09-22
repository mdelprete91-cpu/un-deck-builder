"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import ColorPicker from "@/components/ColorPicker";
import type { BrandTheme } from "@/lib/slides/brand";
import type { Slide } from "@/lib/slides/schema";
import { numeric } from "@/lib/slides/layouts/stats";
import { chartShades } from "@/lib/slides/layouts/shared";

interface Row {
  label: string;
  value: string;
  color?: string;
}

interface ChartDataPanelProps {
  slide: Slide;
  theme: BrandTheme;
  onChange: (bars: { label: string; value: number; color?: string }[]) => void;
  onClose: () => void;
}

const MAX_ROWS = 5;
const MIN_ROWS = 2;

/**
 * Contextual data editor for chart slides (bars + donut): label/value rows,
 * applied live (debounced) so the chart re-scales while you type.
 */
export default function ChartDataPanel({ slide, theme, onChange, onClose }: ChartDataPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Resync from the slide when it changes (slide switch, undo/redo)
  useEffect(() => {
    setRows((slide.bars ?? []).map((b) => ({ label: b.label, value: String(b.value), color: b.color })));
    dirty.current = false;
  }, [slide.id, slide.bars]);

  const apply = (next: Row[]) => {
    setRows(next);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      onChange(next.map((r) => ({ label: r.label, value: numeric(r.value), color: r.color })));
    }, 350);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The same rule as the renderers: the donut has a categorical series on the
  // UNICEF brands, the bars are tints of the accent.
  const series =
    slide.layoutId === "donut-chart" && theme.chartSeries ? theme.chartSeries : chartShades(theme, Math.max(rows.length, 1));

  return (
    <div className="absolute right-8 top-16 z-20 w-80 rounded-2xl border border-hairline bg-surface p-4 shadow-stripe-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Chart data</span>
        <Button
          variant="ghost"
          iconOnly
          icon={X}
          onClick={onClose}
          title="Close"
          aria-label="Close"
        />
      </div>
      {/* What the series would give each row, for the swatch on "automatic". */}
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <ColorPicker
              value={row.color}
              fallback={series[i % series.length]}
              label={`Colour of ${row.label || `row ${i + 1}`}`}
              onChange={(color) => apply(rows.map((r, j) => (j === i ? { ...r, color } : r)))}
            />
            <input
              value={row.label}
              onChange={(e) => apply(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
              placeholder="Label"
              className="w-0 flex-1 rounded-lg border border-hairline px-2.5 py-1.5 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
            />
            <input
              value={row.value}
              onChange={(e) => apply(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
              placeholder="Value"
              inputMode="decimal"
              className="w-24 rounded-lg border border-hairline px-2.5 py-1.5 text-right text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
            />
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              onClick={() => apply(rows.filter((_, j) => j !== i))}
              disabled={rows.length <= MIN_ROWS}
              title="Remove row"
              aria-label="Remove row"
            />
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        icon={Plus}
        onClick={() => apply([...rows, { label: `Item ${rows.length + 1}`, value: "0" }])}
        disabled={rows.length >= MAX_ROWS}
        className="mt-3 w-full"
      >
        Add row
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        Values are real numbers, the chart scales to the largest. The dot picks a colour; automatic follows the brand. Cmd+Z to undo.
      </p>
    </div>
  );
}
