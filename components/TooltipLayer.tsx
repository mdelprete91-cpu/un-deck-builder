"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One tooltip for the whole platform (Mario, 7 Oct 2026: the side bar's tips,
 * "same style everywhere"). Any element with a `title` or a `data-tip` gets
 * it: dark, short, at once on hover, never the browser's slow yellow box.
 * The title moves to data-tip on first hover so the native one never shows.
 * Placement: `data-tip-side="right"` puts it beside the element (the page's
 * side bar); otherwise below it, or above when there is no room.
 */
const GAP = 8;

export default function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; side: "right" | "below" | "above" } | null>(null);
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const hide = () => {
      current.current = null;
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-tip],[title]");
      if (!el || el === document.documentElement) return hide();
      // A text being edited keeps its own cursor and no tip.
      if (el.isContentEditable) return hide();
      const title = el.getAttribute("title");
      if (title) {
        el.dataset.tip = title;
        el.removeAttribute("title");
      }
      const text = el.dataset.tip?.trim();
      if (!text) return hide();
      if (current.current === el) return;
      current.current = el;
      const r = el.getBoundingClientRect();
      if (el.dataset.tipSide === "right") setTip({ text, x: r.right + GAP + 6, y: r.top + r.height / 2, side: "right" });
      else if (r.bottom + 40 > window.innerHeight) setTip({ text, x: r.left + r.width / 2, y: r.top - GAP, side: "above" });
      else setTip({ text, x: r.left + r.width / 2, y: r.bottom + GAP, side: "below" });
    };
    const out = (e: PointerEvent) => {
      const to = e.relatedTarget as Node | null;
      if (current.current && to && current.current.contains(to)) return;
      if (current.current && e.target instanceof Node && current.current.contains(e.target)) hide();
    };
    document.addEventListener("pointerover", over, true);
    document.addEventListener("pointerout", out, true);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("pointerout", out, true);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  if (!tip) return null;
  const transform =
    tip.side === "right" ? "translate(0, -50%)" : tip.side === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)";
  return (
    <div
      role="tooltip"
      className={`ui-tip ui-tip-${tip.side}`}
      style={{
        left: Math.max(8, Math.min(tip.x, window.innerWidth - 8)),
        top: tip.y,
        transform,
      }}
    >
      {tip.text}
    </div>
  );
}
