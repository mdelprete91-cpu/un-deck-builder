import { DEFAULT_CHANNELS } from "./schema";
import type { DeckState } from "./state";

const KEY = "giga-deck:session";
const VERSION = 2;

interface Persisted {
  version: number;
  brandId: DeckState["brandId"];
  brief: string;
  count: number;
  chapters: boolean;
  slides: DeckState["slides"];
  activeIndex: number;
  usage: DeckState["usage"];
}

export interface OpenedSession {
  /**
   * Carried across sessions: the generation settings only, never content.
   * Which logo you work under is a preference; the deck is work.
   */
  settings: Partial<DeckState>;
  /** Last session's deck, offered as a restore and never applied on its own. */
  previous: Partial<DeckState> | null;
}

export function saveDeck(state: DeckState): void {
  try {
    const payload: Persisted = {
      version: VERSION,
      brandId: state.brandId,
      brief: state.brief,
      count: state.count,
      chapters: state.chapters,
      slides: state.slides,
      activeIndex: state.activeIndex,
      usage: state.usage,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // quota/serialization failures are non-fatal
  }
}

/**
 * Call once on mount. Reports what the editor should open with: the settings
 * to hydrate, and the deck the last session left behind, which is offered on
 * the empty state rather than applied.
 *
 * There is deliberately no second key holding that deck. A photo-heavy deck
 * already runs at the edge of the localStorage quota, so a copy would be the
 * write that fails. The deck stays where it is and `app/page.tsx` holds the
 * autosave off until the offer is taken or dropped.
 */
export function openSession(): OpenedSession {
  let saved: Partial<DeckState> | null = null;
  try {
    saved = read(localStorage.getItem(KEY));
  } catch {
    return { settings: {}, previous: null };
  }
  if (!saved) return { settings: {}, previous: null };
  return {
    settings: { brandId: saved.brandId, chapters: saved.chapters },
    previous: (saved.slides?.length ?? 0) > 0 ? saved : null,
  };
}

function read(raw: string | null): Partial<DeckState> | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.version !== VERSION || !Array.isArray(parsed.slides)) return null;
    return {
      brandId: parsed.brandId,
      brief: parsed.brief ?? "",
      count: parsed.count ?? 8,
      chapters: parsed.chapters ?? false,
      // The closing slide's social row used to be a constant in the renderer.
      // Seed it on decks saved before it moved, or editing it would be a
      // silent no-op (setPath cannot write into a missing array).
      // Additive and lossless, so it needs no VERSION bump.
      slides: parsed.slides.map((s) =>
        s.layoutId === "thank-you" && !s.channels?.length
          ? { ...s, channels: DEFAULT_CHANNELS.map((c) => ({ ...c })) }
          : s,
      ),
      activeIndex: parsed.activeIndex ?? 0,
      usage: parsed.usage ?? { inputTokens: 0, outputTokens: 0 },
    };
  } catch {
    return null;
  }
}

export function clearSaved(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
