"use client";

/**
 * A toggle switch in the iOS manner (Mario, 7 Oct 2026, for Chapters): a
 * green track when on, grey when off, a white knob with a soft shadow that
 * slides on one ease-out curve and widens while it is held down. All the
 * motion is CSS (globals.css .switch-*). The label is part of the control:
 * a click anywhere on it toggles.
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
  const toggle = () => {
    if (!disabled) onChange(!checked);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={toggle}
      className={`switch inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/20 disabled:pointer-events-none disabled:opacity-40 ${
        checked ? "is-on" : ""
      }`}
      {...rest}
    >
      <span aria-hidden className="switch-track">
        <span className="switch-knob" />
      </span>
      {label}
    </button>
  );
}
