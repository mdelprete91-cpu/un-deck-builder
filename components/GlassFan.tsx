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
 * resting pose the four cards narrow into upright bars and a fifth slides
 * out from under the last; a light runs along them until the first slide
 * lands.
 */
export default function GlassFan({ spinning = false }: { spinning?: boolean }) {
  return (
    <div aria-hidden className={`glass-fan${spinning ? " glass-spin" : ""}`}>
      {Array.from({ length: CARDS }, (_, k) => (
        <Fragment key={k}>
          <span className={`glass-card glass-card-${k}`} />
          {/* The spinner's fifth bar, slid out from under the last card. */}
          {spinning && k === CARDS - 1 && <span className="glass-card glass-card-x glass-card-4" />}
        </Fragment>
      ))}
    </div>
  );
}
