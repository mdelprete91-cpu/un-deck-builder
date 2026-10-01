"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * The empty stage's one picture (Mario, 1 Oct 2026): slide skeletons in a
 * Cover Flow row, as in old iTunes, three in view. The slide in the middle is
 * larger, faces you and builds its shapes in as it arrives (the card coming
 * from the left is empty, the one leaving to the right keeps them); the two beside it are smaller, turned a little towards
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

/**
 * The row runs on the clock, not on a counter: its place is the time since a
 * start kept in the tab's session, so switching tabs or reloading picks it up
 * where it was instead of starting over (Mario, 1 Oct 2026).
 */
const EPOCH_KEY = "giga-deck:skeleton-epoch";

function sessionEpoch(): { epoch: number; resumed: boolean } {
  try {
    const saved = Number(sessionStorage.getItem(EPOCH_KEY));
    if (saved > 0) return { epoch: saved, resumed: true };
    const now = Date.now();
    sessionStorage.setItem(EPOCH_KEY, String(now));
    return { epoch: now, resumed: false };
  } catch {
    return { epoch: Date.now(), resumed: false };
  }
}

export default function SkeletonDrift() {
  // null until the clock is read on the client, so the server render and the
  // first client render agree; the row is hidden for that one frame.
  const [step, setStep] = useState<number | null>(null);
  // A jump (a reload, or a tab that was in the background) lands in place:
  // no slide across, no build-in, the middle card already written.
  const [instant, setInstant] = useState(true);
  useEffect(() => {
    const { epoch, resumed } = sessionEpoch();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const now = () => Math.floor((Date.now() - epoch) / STEP_MS);
    let last = now();
    // First placement on the next frame, as any later tick would be.
    const first = requestAnimationFrame(() => {
      setStep(still ? 0 : last);
      setInstant(resumed);
    });
    if (still) return () => cancelAnimationFrame(first);
    const tick = () => {
      const s = now();
      if (s === last) return;
      setInstant(s - last > 1);
      setStep(s);
      last = s;
    };
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const n = CARDS.length;
  const half = Math.floor(n / 2);
  return (
    // The fade sits on a wrapper, the perspective on the row inside it: on one
    // element together Chrome draws the masked 3D cards in vertical stripes.
    <div aria-hidden className="skeleton-window h-[150px] w-[720px] max-w-full" style={{ visibility: step === null ? "hidden" : undefined }}>
    <div className="relative h-full w-full [perspective:900px]">
      {CARDS.map((Card, i) => {
        // Place in the row, -half..half; growing step moves every card right.
        const at = step ?? 0;
        const pos = ((((i + at) % n) + n) % n) - half;
        const prev = ((((i + at - 1) % n) + n) % n) - half;
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
              transition: instant || (prev === half && pos === -half) ? "none" : `transform ${EASE}, opacity ${EASE}`,
            }}
          >
            {/* A slide is written as it reaches the middle: the cards coming from the
                left are empty, the middle one builds its shapes in, the ones leaving
                to the right keep them. */}
            <div className={`relative ${pos < 0 ? "sk-empty" : pos === 0 && !instant ? "sk-build" : ""}`}>
              <Card />
              {/* The side cards sit under a veil in the stage colour: dimmer, never see-through. */}
              <div className="absolute inset-0 rounded-xl bg-surface" style={{ opacity: d === 0 ? 0 : 0.45, transition: instant ? "none" : `opacity ${EASE}` }} />
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

/** The build order of a shape inside its card, for the stagger. */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

const Bar = ({ className = "", i }: { className?: string; i: number }) => <div className={`sk rounded-full ${className}`} style={at(i)} />;

function Cover() {
  return (
    <Frame>
      <div className="flex h-full flex-col justify-end gap-2">
        <Bar i={0} className="h-3 w-3/4" />
        <Bar i={1} className="h-3 w-1/2" />
        <Bar i={2} className="mt-1 h-2 w-1/3" />
      </div>
    </Frame>
  );
}

function Bullets() {
  return (
    <Frame>
      <Bar i={0} className="h-2.5 w-1/2" />
      <div className="mt-4 flex flex-col gap-2.5">
        {["w-4/5", "w-2/3", "w-3/4"].map((w, k) => (
          <div key={w} className="flex items-center gap-2">
            <div className="sk sk-dot size-1.5 shrink-0 rounded-full" style={at(k + 1)} />
            <Bar i={k + 1} className={`h-2 ${w}`} />
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
        <Bar i={0} className="h-2.5 w-2/5" />
        <div className="mt-3 flex flex-1 items-end gap-2.5">
          {["h-[35%]", "h-[60%]", "h-[45%]", "h-[85%]", "h-[70%]"].map((h, k) => (
            <div key={h} className={`sk sk-col flex-1 rounded-t-md ${h}`} style={at(k + 1)} />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function Columns() {
  return (
    <Frame>
      <Bar i={0} className="h-2.5 w-1/3" />
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((k) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Bar i={k + 1} className="h-2 w-3/4" />
            <Bar i={k + 2} className="h-1.5 w-full" />
            <Bar i={k + 3} className="h-1.5 w-5/6" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
