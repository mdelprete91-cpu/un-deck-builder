"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ICON_SIZE } from "@/components/Button";

const OPTIONS = [
  { id: "system", label: "Follow the system", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * The theme switch: three icon segments in one pill (system, light, dark),
 * the shape Vercel made familiar. A radiogroup, so it is one control to a
 * screen reader and the arrow keys move the choice. Renders empty until
 * mounted: the theme is only known on the client, and a wrong first frame
 * would flash the other segment.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : null;

  const move = (from: number, delta: number) => {
    const next = OPTIONS[(from + delta + OPTIONS.length) % OPTIONS.length];
    setTheme(next.id);
    document.getElementById(`theme-${next.id}`)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-canvas-2 p-1"
    >
      {OPTIONS.map((o, i) => {
        const on = current === o.id;
        return (
          <button
            key={o.id}
            id={`theme-${o.id}`}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            tabIndex={on || (current === null && i === 0) ? 0 : -1}
            onClick={() => setTheme(o.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") move(i, 1);
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(i, -1);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ${
              on ? "bg-surface text-ink shadow-stripe" : "text-ink-faint hover:text-ink"
            }`}
          >
            <o.icon size={ICON_SIZE} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
