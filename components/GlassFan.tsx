import { Fragment } from "react";

/**
 * The empty stage's picture (Mario, 8 Oct 2026): "Stackable glass" from
 * Spline, made a deck of slides and drawn in CSS, so it needs no runtime and
 * no published scene. Four 16:9 cards, the back one a blue-to-mint gradient,
 * the three in front tinted glass. The fan rests 70% open and breathes to
 * fully open and back: a light movement that sits above the centred
 * headline without pulling the eye. Still under reduced motion.
 */
const CARDS = 4;

/**
 * `spinning`: the generation's spinner (Mario, 8 Oct 2026). From the fan's
 * resting pose the four cards gather into a wheel and two more split off
 * on the way, six spokes, and the whole turns until the first slide lands.
 */
/**
 * Under the pointer the fan answers a little (Mario, 8 Oct 2026): the cards
 * open a touch wider and follow the pointer, the front ones more than the
 * back, like panes at different depths. --mx/--my are the pointer's place
 * over the fan, -1 to 1; the cards' own CSS turns them into motion.
 */
function follow(e: React.PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
  el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  el.style.setProperty("--h", "1");
}
function rest(e: React.PointerEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  for (const v of ["--mx", "--my", "--h"]) el.style.setProperty(v, "0");
}

export default function GlassFan({ spinning = false }: { spinning?: boolean }) {
  return (
    <div
      aria-hidden
      className={`glass-fan${spinning ? " glass-spin" : ""}`}
      onPointerMove={spinning ? undefined : follow}
      onPointerLeave={spinning ? undefined : rest}
    >
      {Array.from({ length: CARDS }, (_, k) => (
        <Fragment key={k}>
          <span className={`glass-card glass-card-${k}`} />
          {/* The spinner's two extra cards, over the gradient card and under the rest. */}
          {spinning && k === 0 && [4, 5].map((x) => <span key={x} className={`glass-card glass-card-x glass-card-${x}`} />)}
        </Fragment>
      ))}
    </div>
  );
}
