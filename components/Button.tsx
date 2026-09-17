"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The one button of the chrome. Every measurement is fixed here and nowhere
 * else: 36px tall, Inter 14px medium, 12px side padding, a 14px Lucide icon
 * with a 6px gap. Variants change colour and border only. If a control needs
 * a different size it is not a button, it is something else.
 *
 * Icon-only buttons are 36px squares and must carry an `aria-label`.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "ai";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-giga text-white hover:bg-giga-deep active:scale-[0.98] disabled:opacity-40",
  secondary:
    "border border-hairline bg-white text-ink hover:bg-canvas-2 disabled:border-hairline-light disabled:text-ink-faint",
  ghost: "text-ink-muted hover:bg-mist hover:text-ink disabled:text-ink-faint",
  danger: "bg-status-red/10 text-status-red hover:bg-status-red/20 disabled:opacity-40",
  /** An "on" state, like the Chapters toggle: tinted, accent text. */
  accent: "bg-giga-tint text-giga hover:bg-giga-100 disabled:opacity-40",
  // A still orb of blues with a soft glow, white text (globals.css): the one
  // AI entry on the slide bar.
  ai: "ai-orb active:scale-[0.98] disabled:opacity-40",
};

export const ICON_SIZE = 14;

export default function Button({
  variant = "secondary",
  icon: Icon,
  iconRight: IconRight,
  iconOnly = false,
  iconClassName,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Lucide icon before the label. */
  icon?: LucideIcon;
  /** Lucide icon after the label (a chevron on a menu button). */
  iconRight?: LucideIcon;
  /** No label: a 36px square (children, if any, extend it). Pass `aria-label`. */
  iconOnly?: boolean;
  /** Class for the icons themselves, e.g. "animate-spin" on a spinner. */
  iconClassName?: string;
  /** Layout only (width, alignment). Never sizes, paddings or type. */
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/20 disabled:pointer-events-none ${
        // A 36px square: min-width does it for borderless variants, and for
        // the bordered one 10px + 14px icon + 10px + 2px border lands there
        // too. A child (an expandable label, see the composer's "+") widens
        // it from there.
        iconOnly ? "min-w-9 px-[10px]" : "px-3"
      } ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={ICON_SIZE} className={iconClassName} aria-hidden />}
      {children}
      {IconRight && <IconRight size={ICON_SIZE} className={iconClassName} aria-hidden />}
    </button>
  );
}
