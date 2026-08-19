/**
 * Which phase of the product tour the user has already been through. Two
 * phases, deliberately split: the intro walks the brief and the Generate
 * button on an empty editor, the editor phase walks the chrome that only
 * renders once a deck exists.
 *
 * Bumping VERSION replays both for everyone, which is the point: a rewritten
 * tour is worth a second look, a typo fix is not.
 */
const KEY = "giga-deck:onboarding";
const VERSION = 1;

export type TourPhase = "intro" | "editor";

interface Seen {
  version: number;
  intro?: boolean;
  editor?: boolean;
}

export function seenOnboarding(): Seen {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: VERSION };
    const parsed = JSON.parse(raw) as Seen;
    if (parsed.version !== VERSION) return { version: VERSION };
    return parsed;
  } catch {
    return { version: VERSION };
  }
}

export function markSeen(...phases: TourPhase[]): void {
  try {
    const next: Seen = { ...seenOnboarding(), version: VERSION };
    for (const phase of phases) next[phase] = true;
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A user who cannot persist this gets the tour every visit. Not worth
    // failing over.
  }
}
