import type { DeckState } from "./state";

const KEY = "giga-deck:session";
const VERSION = 1;

interface Persisted {
  version: number;
  brandId: DeckState["brandId"];
  brief: string;
  count: number;
  slides: DeckState["slides"];
  activeIndex: number;
  usage: DeckState["usage"];
}

export function saveDeck(state: DeckState): void {
  try {
    const payload: Persisted = {
      version: VERSION,
      brandId: state.brandId,
      brief: state.brief,
      count: state.count,
      slides: state.slides,
      activeIndex: state.activeIndex,
      usage: state.usage,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // quota/serialization failures are non-fatal
  }
}

export function loadDeck(): Partial<DeckState> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.version !== VERSION || !Array.isArray(parsed.slides)) return null;
    return {
      brandId: parsed.brandId,
      brief: parsed.brief ?? "",
      count: parsed.count ?? 8,
      slides: parsed.slides,
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
