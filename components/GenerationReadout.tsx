"use client";

import { useEffect, useRef } from "react";
import { PartyPopperIcon, type PartyPopperIconHandle } from "@/components/PartyPopperIcon";

type Usage = { inputTokens: number; outputTokens: number };

/**
 * What the last generation cost and how long it took, under "How it works".
 * A small Canvas-2 card with the party popper, which pops once when a new
 * run lands (and again on hover), so the number reads as a small win rather
 * than a meter. The session total sits in the tooltip.
 */
export default function GenerationReadout({
  lastRun,
  session,
}: {
  lastRun: Usage & { seconds: number };
  session: Usage;
}) {
  const popper = useRef<PartyPopperIconHandle>(null);
  // A new run is a new object; the pop fires once per run, and once on
  // reopen, which is fine: the deck did land.
  useEffect(() => {
    popper.current?.startAnimation();
  }, [lastRun]);

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl bg-canvas-2 px-3 py-2"
      title={`Session so far: ${session.inputTokens.toLocaleString()} in · ${session.outputTokens.toLocaleString()} out tokens, ${formatCost(cost(session))}`}
      onMouseEnter={() => popper.current?.startAnimation()}
      onMouseLeave={() => popper.current?.stopAnimation()}
    >
      <PartyPopperIcon ref={popper} size={18} className="shrink-0 text-giga" />
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-medium text-ink">Deck generated</p>
        <p className="text-xs text-ink-muted">
          {formatCost(cost(lastRun))} · {formatSeconds(lastRun.seconds)}
        </p>
      </div>
    </div>
  );
}

/**
 * claude-haiku-4-5 list price: $1 per million input tokens, $5 per million
 * output tokens (September 2026). Update here if the route changes model.
 */
export function cost(u: Usage): number {
  return (u.inputTokens * 1 + u.outputTokens * 5) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatSeconds(s: number): string {
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}
