"use client";

import { useEffect, useState } from "react";

/**
 * The empty stage's one picture (Mario, 1 Oct 2026): slides in a Cover Flow
 * row, as in old iTunes, three in view. The slide in the middle is larger and
 * faces you; the two beside it are smaller, turned a little towards the
 * middle and dimmed, and the row fades out at both sides. Every few seconds
 * the row steps one place to the right. No words: it says "slides come here"
 * without competing with the headline. Still under reduced motion.
 */
/**
 * The slides are clay renders (Mario, 7 Oct 2026, after the real-time 3D was
 * dropped): soft white paper and glossy blue shapes in the style of a 3D
 * document icon, generated once (gpt-image-1, transparent) and kept in
 * public/empty. The row turns them in perspective as before.
 */
const CLAY = ["cover", "bullets", "chart", "columns"] as const;
const CARDS = [0, 1, 2, 3, 0, 1, 2].map((k) => {
  const name = CLAY[k];
  return function Clay() {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/empty/${name}.webp`} alt="" draggable={false} className="block h-auto w-[214px] select-none" />
    );
  };
});
const STEP_MS = 4200;
const EASE = "1200ms cubic-bezier(0.65, 0, 0.35, 1)";
/**
 * Pixels between card centres. Just more than the middle card's half width
 * plus a side card's (112 + 88), so no two cards touch even mid-step, when one
 * grows and the other shrinks: the card coming to the middle never slides
 * over the one leaving it.
 */
const SPACING = 230;

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
    // 48px above and below for the cards' shadow, which the mask would cut at
    // the box's edge; the negative margins keep the 150px the layout counts on.
    <div aria-hidden className="skeleton-window -my-12 h-[246px] w-[720px] max-w-full" style={{ visibility: step === null ? "hidden" : undefined }}>
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
            {/* The side slides step back, dimmed but solid (globals.css .clay-side). */}
            <div className={d === 0 ? "clay-front" : "clay-side"} style={{ transition: instant ? "none" : `opacity ${EASE}, filter ${EASE}` }}>
              <Card />
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
