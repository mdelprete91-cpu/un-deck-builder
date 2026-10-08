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
 * `spinning`: the generation's spinner (Mario, 8 Oct 2026), made first in
 * Spline ("Card spinner"). Twelve glass cards round a ring; the fan's
 * gradient card is the lead and passes from slot to slot, each slot it
 * leaves fading back to glass.
 */
const SLOTS = 12;

export default function GlassFan({ spinning = false }: { spinning?: boolean }) {
  if (spinning) {
    return (
      <div aria-hidden className="card-spin">
        {Array.from({ length: SLOTS }, (_, k) => (
          <span key={k} className="card-spin-slot" style={{ "--k": k } as React.CSSProperties}>
            <span className="card-spin-lit" />
            <span className="card-spin-glass" />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden className="glass-fan">
      {Array.from({ length: CARDS }, (_, k) => (
        <span key={k} className={`glass-card glass-card-${k}`} />
      ))}
    </div>
  );
}
