"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The empty stage's one picture (Mario, 1 Oct 2026): slide skeletons in a
 * Cover Flow row, as in old iTunes, three in view. The slide in the middle is
 * larger, faces you and shimmers like a loading skeleton; the two beside it are smaller, turned a little towards
 * the middle and veiled, and the row fades out at both sides. Every few
 * seconds the row steps one place to the right. Grey shapes only, no words:
 * it says "slides come here" without competing with the headline. Still
 * under reduced motion.
 */
const CARDS = [Cover, Bullets, Chart, Columns, Cover, Bullets, Chart];
const STEP_MS = 4200;
const EASE = "1200ms cubic-bezier(0.65, 0, 0.35, 1)";
/**
 * Pixels between card centres. Just more than the middle card's half width
 * plus a side card's (112 + 88), so no two cards touch even mid-step, when one
 * grows and the other shrinks: the card coming to the middle never slides
 * over the one leaving it.
 */
const SPACING = 212;

export default function SkeletonDrift() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  const n = CARDS.length;
  const half = Math.floor(n / 2);
  return (
    // The fade sits on a wrapper, the perspective on the row inside it: on one
    // element together Chrome draws the masked 3D cards in vertical stripes.
    <div aria-hidden className="skeleton-window h-[150px] w-[720px] max-w-full">
    <div className="relative h-full w-full [perspective:900px]">
      {CARDS.map((Card, i) => {
        // Place in the row, -half..half; growing step moves every card right.
        const pos = ((((i + step) % n) + n) % n) - half;
        const prev = ((((i + step - 1) % n) + n) % n) - half;
        const d = Math.abs(pos);
        const scale = d === 0 ? 1.12 : 0.88;
        const turn = pos === 0 ? 0 : pos < 0 ? 18 : -18;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(-50%, -50%) translateX(${pos * SPACING}px) rotateY(${turn}deg) scale(${scale})`,
              // Three in view: the rest fade out past the ends.
              opacity: d > 1 ? 0 : 1,
              // The card that wraps from the right end to the left one jumps unseen.
              transition: prev === half && pos === -half ? "none" : `transform ${EASE}, opacity ${EASE}`,
            }}
          >
            {/* Only the middle card shimmers, like a slide being written; the others stay still. */}
            <div className={`relative ${d === 0 ? "skeleton-live" : ""}`}>
              <Card />
              {/* The side cards sit under a veil in the stage colour: dimmer, never see-through. */}
              <div className="absolute inset-0 rounded-xl bg-surface" style={{ opacity: d === 0 ? 0 : 0.45, transition: `opacity ${EASE}` }} />
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="aspect-video w-[200px] shrink-0 rounded-xl border border-hairline-light bg-canvas-2 p-3.5 shadow-float">{children}</div>;
}

const Bar = ({ className = "" }: { className?: string }) => <div className={`sk rounded-full ${className}`} />;

function Cover() {
  return (
    <Frame>
      <div className="flex h-full flex-col justify-end gap-2">
        <Bar className="h-3 w-3/4" />
        <Bar className="h-3 w-1/2" />
        <Bar className="mt-1 h-2 w-1/3" />
      </div>
    </Frame>
  );
}

function Bullets() {
  return (
    <Frame>
      <Bar className="h-2.5 w-1/2" />
      <div className="mt-4 flex flex-col gap-2.5">
        {["w-4/5", "w-2/3", "w-3/4"].map((w) => (
          <div key={w} className="flex items-center gap-2">
            <div className="sk size-1.5 shrink-0 rounded-full" />
            <Bar className={`h-2 ${w}`} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Chart() {
  return (
    <Frame>
      <div className="flex h-full flex-col">
        <Bar className="h-2.5 w-2/5" />
        <div className="mt-3 flex flex-1 items-end gap-2.5">
          {["h-[35%]", "h-[60%]", "h-[45%]", "h-[85%]", "h-[70%]"].map((h) => (
            <div key={h} className={`sk flex-1 rounded-t-md ${h}`} />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function Columns() {
  return (
    <Frame>
      <Bar className="h-2.5 w-1/3" />
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Bar className="h-2 w-3/4" />
            <Bar className="h-1.5 w-full" />
            <Bar className="h-1.5 w-5/6" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
