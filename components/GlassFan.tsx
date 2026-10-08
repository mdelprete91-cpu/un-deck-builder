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
 * resting pose the same four cards gather into a wheel, one at each quarter,
 * and the whole turns until the first slide lands.
 */
export default function GlassFan({ spinning = false }: { spinning?: boolean }) {
  return (
    <div aria-hidden className={`glass-fan${spinning ? " glass-spin" : ""}`}>
      {Array.from({ length: CARDS }, (_, k) => (
        <span key={k} className={`glass-card glass-card-${k}`} />
      ))}
    </div>
  );
}
