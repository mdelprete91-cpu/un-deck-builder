"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Shown under the label in the menu, muted. */
  hint?: string;
  disabled?: boolean;
}

/**
 * A settings-row select in the ChatGPT register: the trigger is the current
 * value and a chevron, borderless, sitting at the right of its label; the
 * menu is a white card with the menu shadow, 36px options, a tick on the
 * selected one. Measurements are the ones read off chatgpt.com's settings
 * dialog on 15 Sep 2026.
 *
 * Native <select> was replaced because its popup is the OS widget, which is
 * the one thing on the page the chrome cannot style.
 */
export default function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  align = "right",
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  /** Which edge of the trigger the menu hangs from. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // Close on outside click and on Escape; focus the selected option on open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const move = (from: HTMLElement, dir: 1 | -1) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? [])];
    const i = items.indexOf(from);
    items[(i + dir + items.length) % items.length]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        iconRight={ChevronDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="max-w-full"
      >
        <span className="truncate">{current?.label ?? value}</span>
      </Button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className={`pop-in absolute top-full z-30 mt-1 min-w-[220px] rounded-2xl bg-surface py-1.5 shadow-menu ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <div
                key={o.value}
                role="option"
                tabIndex={o.disabled ? -1 : 0}
                aria-selected={selected}
                aria-disabled={o.disabled || undefined}
                onClick={() => {
                  if (o.disabled) return;
                  onChange(o.value);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(e.currentTarget, 1);
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(e.currentTarget, -1);
                  }
                }}
                className={`mx-1.5 flex min-h-9 cursor-pointer items-center justify-between gap-6 rounded-[10px] px-2.5 py-1.5 text-sm text-ink outline-none transition-colors duration-100 ${
                  o.disabled
                    ? "cursor-default text-ink-faint"
                    : "hover:bg-mist focus-visible:bg-mist"
                } ${selected ? "bg-mist" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block text-xs text-ink-muted">{o.hint}</span>}
                </span>
                {selected && (
                  <Check size={16} className="shrink-0" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
