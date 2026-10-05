"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHART_COLORS } from "@/lib/slides/chart-colors";

/**
 * A swatch that opens the sixteen chart colours in a 4x4 grid. `value`
 * undefined means "automatic": the brand series decides, and the swatch
 * shows the colour the series gave (`fallback`) with a hollow look. The
 * popover is a menu card like the others in the chrome; Escape and a click
 * outside close it. It renders in a portal at a fixed position under the
 * swatch: inside the Data panel's scrolling rows it was clipped (Mario, 5
 * Oct 2026). It opens upward when there is no room below, and a scroll or a
 * resize closes it rather than leaving it behind.
 */
const MENU_W = 168;
const MENU_H = 232;
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
  const [open, setOpen] = useState<{ left: number; top: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = () => {
    if (open) return setOpen(null);
    const r = root.current!.getBoundingClientRect();
    const below = r.bottom + 4 + MENU_H <= window.innerHeight - 8;
    setOpen({
      left: Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8)),
      top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - MENU_H),
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("resize", close);
    // Capture: a scroll in any container (the panel's rows) moves the swatch away.
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const shown = value ?? fallback;
  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={!!open}
        aria-label={`${label}: ${value ? colorName(value) : "automatic"}`}
        title={value ? colorName(value) : "Automatic (brand series)"}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-mist"
      >
        <span
          className={`block h-5 w-5 rounded-full ${value ? "" : "ring-2 ring-inset ring-surface/70"}`}
          style={{ background: shown, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}
        />
      </button>
      {open && createPortal(
        <div
          ref={menu}
          role="menu"
          className="pop-in fixed z-[60] w-[168px] rounded-2xl bg-surface p-2 shadow-menu"
          style={{ left: open.left, top: open.top }}
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
                    setOpen(null);
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
              setOpen(null);
            }}
            disabled={!value}
            className="mt-1.5 block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-mist disabled:text-ink-faint"
          >
            Automatic
          </button>
        </div>,
        document.body,
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
