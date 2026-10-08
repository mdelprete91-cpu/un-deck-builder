/**
 * The empty stage's picture (Mario, 8 Oct 2026): "Stackable glass" from
 * Spline, made a deck of slides and drawn in CSS, so it needs no runtime and
 * no published scene. Four 16:9 cards, the back one a blue-to-mint gradient,
 * the three in front tinted glass. The fan rests 70% open and breathes to
 * fully open and back: a light movement that sits above the centred
 * headline without pulling the eye. Still under reduced motion.
 */
const CARDS = 4;

export default function GlassFan() {
  return (
    <div aria-hidden className="glass-fan">
      {Array.from({ length: CARDS }, (_, k) => (
        <span key={k} className={`glass-card glass-card-${k}`} />
      ))}
    </div>
  );
}
