"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A toggle switch in the iOS manner (Mario, 7 Oct 2026, for Chapters): a
 * green track when on, grey when off, a white knob with a soft shadow. The
 * knob stretches while it travels and while it is held down, then settles
 * round where it lands, on a spring without bounce. The label is part of
 * the control: a click anywhere on it toggles.
 */
export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  title,
  ...rest
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
} & Record<`data-${string}`, string>) {
  // "travel" is on for the length of the move, so the knob can stretch on the way.
  const [travel, setTravel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const toggle = () => {
    if (disabled) return;
    setTravel(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTravel(false), 260);
    onChange(!checked);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={toggle}
      className={`switch inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/20 disabled:pointer-events-none disabled:opacity-40 ${
        checked ? "is-on" : ""
      } ${travel ? "is-travel" : ""}`}
      {...rest}
    >
      <span aria-hidden className="switch-track">
        <span className="switch-knob" />
      </span>
      {label}
    </button>
  );
}
