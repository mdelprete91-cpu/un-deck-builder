"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import ColorPicker from "@/components/ColorPicker";
import type { BrandTheme } from "@/lib/slides/brand";
import { PRIMARY_ARRAY, SERIES_LAYOUTS, type Slide } from "@/lib/slides/schema";
import { numeric } from "@/lib/slides/layouts/stats";
import { chartShades } from "@/lib/slides/layouts/shared";
import { seriesColors } from "@/lib/slides/layouts/charts";

interface Row {
  label: string;
  /** One string per series on the series charts, a single one otherwise. */
  values: string[];
  color?: string;
}

interface ChartDataPanelProps {
  slide: Slide;
  theme: BrandTheme;
  onChange: (bars: { label: string; value: number; values?: number[]; color?: string }[], series?: string[]) => void;
  onClose: () => void;
}

const INPUT =
  "rounded-lg border border-hairline px-2.5 py-1.5 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15";

/**
 * Contextual data editor for every chart slide: label/value rows, applied
 * live (debounced) so the chart re-scales while you type. On the series
 * charts (line, grouped, stacked) the header row names the series and each
 * row carries one value per series; the row limits come from the layout, so
 * the wide columns take thirty rows and the donut five.
 */
export default function ChartDataPanel({ slide, theme, onChange, onClose }: ChartDataPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [series, setSeries] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const span = SERIES_LAYOUTS[slide.layoutId];
  const multi = !!span;
  const limits = PRIMARY_ARRAY[slide.layoutId] ?? { min: 2, max: 5 };

  // Resync from the slide when it changes (slide switch, undo/redo)
  useEffect(() => {
    const names = slide.series ?? [];
    setSeries(names);
    setRows(
      (slide.bars ?? []).map((b) => ({
        label: b.label,
        values: multi ? (b.values ?? [b.value]).map(String) : [String(b.value)],
        color: b.color,
      })),
    );
    dirty.current = false;
  }, [slide.id, slide.bars, slide.series, multi]);

  const apply = (nextRows: Row[], nextSeries = series) => {
    setRows(nextRows);
    setSeries(nextSeries);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      onChange(
        nextRows.map((r) => ({
          label: r.label,
          value: numeric(r.values[0]),
          ...(multi ? { values: r.values.map(numeric) } : {}),
          color: r.color,
        })),
        multi ? nextSeries : undefined,
      );
    }, 350);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The same rule as the renderers: the donut has a categorical series on the
  // UNICEF brands, the bars are tints of the accent, the wide charts one tint.
  const single =
    slide.layoutId === "donut-chart" && theme.chartSeries
      ? theme.chartSeries
      : slide.layoutId === "chart-bars"
        ? chartShades(theme, Math.max(rows.length, 1))
        : [theme.accent];
  const perSeries = seriesColors(theme, Math.max(series.length, 1));
  const k = Math.max(series.length, 1);

  const addSeries = () => {
    const next = [...series, `Series ${series.length + 1}`];
    apply(
      rows.map((r) => ({ ...r, values: [...r.values, "0"] })),
      next,
    );
  };
  const removeSeries = (j: number) => {
    apply(
      rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== j) })),
      series.filter((_, i) => i !== j),
    );
  };

  return (
    <div
      className={`absolute right-8 top-16 z-20 flex max-h-[calc(100%-6rem)] flex-col rounded-2xl border border-hairline bg-surface p-4 shadow-stripe-lg ${multi ? "w-[30rem]" : "w-80"}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Chart data</span>
        <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close" aria-label="Close" />
      </div>
      {multi && (
        <div className="mb-2 flex items-center gap-2">
          <span className="w-0 flex-1 text-xs text-ink-muted">Series</span>
          {series.map((name, j) => (
            <div key={j} className="flex w-28 items-center gap-1">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: perSeries[j] }} aria-hidden />
              <input
                value={name}
                onChange={(e) => apply(rows, series.map((s, i) => (i === j ? e.target.value : s)))}
                placeholder={`Series ${j + 1}`}
                aria-label={`Name of series ${j + 1}`}
                className={`${INPUT} w-0 flex-1 px-1.5`}
              />
              {series.length > span![0] && (
                <button
                  type="button"
                  onClick={() => removeSeries(j)}
                  aria-label={`Remove series ${name || j + 1}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-mist"
                >
                  <X size={12} aria-hidden />
                </button>
              )}
            </div>
          ))}
          {series.length < span![1] && (
            <Button variant="ghost" iconOnly icon={Plus} onClick={addSeries} title="Add a series" aria-label="Add a series" />
          )}
          <span className="w-9" aria-hidden />
        </div>
      )}
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {!multi && (
              <ColorPicker
                value={row.color}
                fallback={single[i % single.length]}
                label={`Colour of ${row.label || `row ${i + 1}`}`}
                onChange={(color) => apply(rows.map((r, j) => (j === i ? { ...r, color } : r)))}
              />
            )}
            <input
              value={row.label}
              onChange={(e) => apply(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
              placeholder="Label"
              className={`${INPUT} w-0 flex-1`}
            />
            {Array.from({ length: k }, (_, j) => (
              <input
                key={j}
                value={row.values[j] ?? ""}
                onChange={(e) =>
                  apply(rows.map((r, m) => (m === i ? { ...r, values: r.values.map((v, q) => (q === j ? e.target.value : v)) } : r)))
                }
                placeholder="Value"
                inputMode="decimal"
                aria-label={multi ? `${row.label || `Row ${i + 1}`}, ${series[j] || `series ${j + 1}`}` : undefined}
                className={`${INPUT} text-right ${multi ? "w-28" : "w-24"}`}
              />
            ))}
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              onClick={() => apply(rows.filter((_, j) => j !== i))}
              disabled={rows.length <= limits.min}
              title="Remove row"
              aria-label="Remove row"
            />
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        icon={Plus}
        onClick={() => apply([...rows, { label: `Item ${rows.length + 1}`, values: Array.from({ length: k }, () => "0") }])}
        disabled={rows.length >= limits.max}
        className="mt-3 w-full shrink-0"
      >
        Add row
      </Button>
      <p className="mt-2 shrink-0 text-[11px] leading-relaxed text-ink-muted">
        {multi
          ? `Values are real numbers, one per series; the chart scales to the largest. ${rows.length} of ${limits.max} rows. Cmd+Z to undo.`
          : `Values are real numbers, the chart scales to the largest. The dot picks a colour; automatic follows the brand. ${rows.length} of ${limits.max} rows. Cmd+Z to undo.`}
      </p>
    </div>
  );
}
