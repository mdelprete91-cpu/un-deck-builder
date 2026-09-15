"use client";

import { useCallback, useEffect, useState } from "react";

export interface TourStep {
  /**
   * Matches a `data-tour="…"` attribute in the editor. A step without one is
   * a centered card: used for the opening step, which introduces the product
   * rather than a control.
   */
  target?: string;
  title: string;
  body: string;
  /** Extra content under the body, e.g. the pair of example briefs. */
  extra?: React.ReactNode;
}

const CARD_W = 368;
/** Breathing room between the target and the spotlight ring. */
const PAD = 12;
const GAP = 16;
const EDGE = 18;
/** Below a card this short, a side of the target counts as "no room". */
const MIN_H = 299;

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Puts the card on a side of the target that can actually hold it. Below and
 * above first, since a card under the thing it describes reads best, then
 * beside it: the sidebar controls are tall enough that neither vertical side
 * has room, and the canvas has none at all. Nothing fits (a target filling
 * the screen) means centered, over the ring.
 */
function place(hole: Hole): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const holeBottom = hole.top + hole.height;
  const holeRight = hole.left + hole.width;
  const room = {
    below: vh - holeBottom - GAP - EDGE,
    above: hole.top - GAP - EDGE,
    right: vw - holeRight - GAP - EDGE,
    left: hole.left - GAP - EDGE,
  };
  const centerX = Math.min(
    Math.max(hole.left + hole.width / 2 - CARD_W / 2, EDGE),
    vw - CARD_W - EDGE,
  );
  if (room.below >= MIN_H) {
    return { top: holeBottom + GAP, left: centerX, width: CARD_W, maxHeight: room.below };
  }
  if (room.above >= MIN_H) {
    return { bottom: vh - hole.top + GAP, left: centerX, width: CARD_W, maxHeight: room.above };
  }
  // Beside: aligned to the target's top, pushed up only as far as it must be
  // to keep MIN_H of card on screen.
  const top = Math.min(Math.max(hole.top, EDGE), Math.max(vh - EDGE - MIN_H, EDGE));
  if (room.right >= CARD_W) {
    return { top, left: holeRight + GAP, width: CARD_W, maxHeight: vh - top - EDGE };
  }
  if (room.left >= CARD_W) {
    return { top, left: hole.left - GAP - CARD_W, width: CARD_W, maxHeight: vh - top - EDGE };
  }
  return {
    top: "50%",
    left: centerX,
    width: CARD_W,
    maxHeight: `calc(50vh - ${EDGE}px)`,
  };
}

/**
 * The product tour: a spotlight that walks the user through one control at a
 * time. It runs in two phases, defined in app/page.tsx — the brief and the
 * Generate button on an empty editor, then the editing chrome once a deck
 * exists, because most of that chrome does not render before it does.
 *
 * A step whose target is missing is skipped rather than shown against an
 * empty ring: half the chrome comes and goes with the deck.
 */
export default function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step: TourStep | undefined = steps[i];

  const next = useCallback(() => {
    if (i >= steps.length - 1) onDone();
    else setI((n) => n + 1);
  }, [i, steps.length, onDone]);

  // Measure the target, and re-measure on resize. A missing target advances.
  useEffect(() => {
    if (!step) {
      onDone();
      return;
    }
    // A centered step has nothing to measure. Whatever rect the previous step
    // left behind is ignored while `centered` is true.
    if (!step.target) return;
    const targetSel = `[data-tour="${step.target}"]`;
    const measure = () => {
      const el = document.querySelector(targetSel);
      if (!el) {
        next();
        return;
      }
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step, next, onDone]);

  // Escape only. Enter is left to the focused Next button: handling it here
  // too advanced two steps at once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!step) return null;
  const centered = !step.target;
  if (!centered && !rect) return null;

  const hole =
    !centered && rect
      ? {
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }
      : null;

  const cardStyle = hole ? place(hole) : { width: CARD_W, maxHeight: "calc(100vh - 32px)" };

  const card = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      className={`pop-in flex flex-col rounded-2xl bg-white p-5 shadow-stripe-lg ${
        hole ? "fixed z-[62]" : ""
      }`}
      style={cardStyle}
    >
      {/* Only the copy scrolls: the buttons have to stay reachable on a short
          viewport, or a step with examples hides its own Next. */}
      <div className="min-h-0 overflow-y-auto">
        <span className="mb-2 block text-[13px] font-normal text-ink-faint">
          Step {i + 1} of {steps.length}
        </span>
        <h3 className="text-lg font-medium text-ink">
          {step.title}
        </h3>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">{step.body}</p>
        {step.extra}
      </div>
      <div className="mt-5 flex shrink-0 items-center justify-between gap-3">
        <button
          onClick={onDone}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
        >
          Skip
        </button>
        <div className="flex items-center gap-3">
          {i > 0 && (
            <button
              onClick={() => setI((n) => n - 1)}
              className="h-10 rounded-full border border-hairline bg-white px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-mist"
            >
              Back
            </button>
          )}
          <button
            autoFocus
            onClick={next}
            className="h-9 rounded-full bg-giga px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-giga-deep active:scale-[0.98]"
          >
            {i === steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Blocks the app underneath: a click mid-tour on Delete slide would
          leave the tour pointing at something that no longer exists. */}
      <div className={`fixed inset-0 z-[60] ${centered ? "bg-scrim" : ""}`} />
      {hole && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[61] rounded-2xl transition-all duration-200"
          style={{ ...hole, boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)" }}
        />
      )}
      {hole ? (
        card
      ) : (
        <div className="fixed inset-0 z-[62] flex items-center justify-center p-4">{card}</div>
      )}
    </>
  );
}
