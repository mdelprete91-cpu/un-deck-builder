import { DEFAULT_CHANNELS, isPage } from "./schema";
import { DEFAULT_DECK_NAME } from "./state";
import type { DeckState } from "./state";

const KEY = "giga-deck:session";
const VERSION = 2;

interface Persisted {
  version: number;
  /** Added 17 Sep 2026, defaulted on read: additive, so no VERSION bump. */
  name?: string;
  brandId: DeckState["brandId"];
  format?: DeckState["format"];
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
      name: state.name,
      brandId: state.brandId,
      format: state.format,
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
    // `format` is not a setting: it belongs to the document. Hydrating it
    // would open an empty editor in two-pager mode and make Generate produce
    // A4 pages nobody asked for. It travels with `previous` instead.
    settings: { brandId: saved.brandId, chapters: saved.chapters },
    previous: (saved.slides?.length ?? 0) > 0 ? saved : null,
  };
}

function read(raw: string | null): Partial<DeckState> | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.version !== VERSION || !Array.isArray(parsed.slides)) return null;
    // The slides are the content, so they decide the format — including for a
    // session saved before the field existed.
    const twoPager = parsed.slides.some((s) => isPage(s));
    return {
      name: parsed.name?.trim() || DEFAULT_DECK_NAME,
      brandId: twoPager ? "inclusion" : parsed.brandId,
      // Added after VERSION 2 and defaulted, so it is additive and lossless:
      // bumping the version here would log out every returning user instead.
      format: twoPager ? "two-pager" : (parsed.format ?? "slides"),
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
