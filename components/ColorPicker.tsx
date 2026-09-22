"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHART_COLORS } from "@/lib/slides/chart-colors";

/**
 * A swatch that opens the sixteen chart colours in a 4x4 grid. `value`
 * undefined means "automatic": the brand series decides, and the swatch
 * shows the colour the series gave (`fallback`) with a hollow look. The
 * popover is a menu card like the others in the chrome; Escape and a click
 * outside close it.
 */
export default function ColorPicker({
  value,
  fallback,
  onChange,
  label,
}: {
  value?: string;
  fallback: string;
  onChange: (hex: string | undefined) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const shown = value ?? fallback;
  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${value ? colorName(value) : "automatic"}`}
        title={value ? colorName(value) : "Automatic (brand series)"}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-mist"
      >
        <span
          className={`block h-5 w-5 rounded-full ${value ? "" : "ring-2 ring-inset ring-surface/70"}`}
          style={{ background: shown, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="pop-in absolute right-0 top-full z-30 mt-1 w-[168px] rounded-2xl bg-surface p-2 shadow-menu"
        >
          <div className="grid grid-cols-4 gap-1">
            {CHART_COLORS.map((c) => {
              const on = value === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => {
                    onChange(c.hex);
                    setOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-mist"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}
                  >
                    {on && <Check size={12} strokeWidth={3} className={lightHex(c.hex) ? "text-ink" : "text-white"} aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            disabled={!value}
            className="mt-1.5 block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-mist disabled:text-ink-faint"
          >
            Automatic
          </button>
        </div>
      )}
    </div>
  );
}

function colorName(hex: string): string {
  return CHART_COLORS.find((c) => c.hex === hex)?.name ?? hex;
}

/** Whether a tick on this swatch should be dark (yellow, pale blues, greys). */
function lightHex(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
