"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The empty stage's one picture (Mario, 1 Oct 2026): slide skeletons in a
 * Cover Flow row, as in old iTunes. The slide in the middle is larger and
 * faces you; the ones beside it are smaller, turned a little towards the
 * middle and fading out. Every few seconds the row steps one place to the
 * right. Grey shapes only, no words: it says "slides come here" without
 * competing with the headline. A row, not a column, so the headline stays
 * near the middle of the stage. Still under reduced motion.
 */
const CARDS = [Cover, Bullets, Chart, Columns, Cover, Bullets, Chart];
const STEP_MS = 2600;
/**
 * The row is an arc, a smile: the cards sit on a circle whose centre is above
 * the stage, so the middle one is lowest and the others rise and tilt with the
 * curve. RADIUS and ANGLE put card centres about 150px apart, less than a
 * card's width, so they overlap.
 */
const RADIUS = 950;
const ANGLE = 9;

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
    <div aria-hidden className="relative h-[190px] w-[640px] max-w-full [perspective:900px]">
      {CARDS.map((Card, i) => {
        // Place in the row, -half..half; growing step moves every card right.
        const pos = ((((i + step) % n) + n) % n) - half;
        const prev = ((((i + step - 1) % n) + n) % n) - half;
        const d = Math.abs(pos);
        const scale = d === 0 ? 1.12 : d === 1 ? 0.88 : 0.76;
        const turn = pos === 0 ? 0 : pos < 0 ? 18 : -18;
        const a = pos * ANGLE;
        const rad = (a * Math.PI) / 180;
        const x = RADIUS * Math.sin(rad);
        const y = -RADIUS * (1 - Math.cos(rad));
        return (
          <div
            key={i}
            className="absolute left-1/2 top-[62%]"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${-a}deg) rotateY(${turn}deg) scale(${scale})`,
              // Only the cards past the ends vanish; the others stay opaque and
              // fade under a veil in the stage colour, so overlaps never show through.
              opacity: d > 2 ? 0 : 1,
              zIndex: 10 - d,
              // The card that wraps from the right end to the left one jumps unseen.
              transition: prev === half && pos === -half ? "none" : "transform 700ms cubic-bezier(0.65, 0, 0.35, 1), opacity 700ms cubic-bezier(0.65, 0, 0.35, 1)",
            }}
          >
            <div className="relative">
              <Card />
              <div
                className="absolute inset-0 rounded-xl bg-surface"
                style={{ opacity: d === 0 ? 0 : d === 1 ? 0.35 : 0.7, transition: "opacity 700ms cubic-bezier(0.65, 0, 0.35, 1)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="aspect-video w-[200px] shrink-0 rounded-xl border border-hairline-light bg-canvas-2 p-3.5 shadow-float">{children}</div>;
}

const Bar = ({ className = "" }: { className?: string }) => <div className={`rounded-full bg-mist ${className}`} />;

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
            <div className="size-1.5 shrink-0 rounded-full bg-mist" />
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
            <div key={h} className={`flex-1 rounded-t-md bg-mist ${h}`} />
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
