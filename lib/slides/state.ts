import type { Slide, SlideContent } from "./schema";
import { ensureId, PRIMARY_ARRAY } from "./schema";
import { newItem } from "./defaults";
import { tierDefaultGrid } from "./layouts/tables";
import type { BrandId } from "./brand";

interface Snapshot {
  slides: Slide[];
  activeIndex: number;
}

const HISTORY_LIMIT = 50;

export interface DeckState {
  brandId: BrandId;
  brief: string;
  count: number;
  slides: Slide[];
  activeIndex: number;
  status: "idle" | "generating" | "error";
  error?: string;
  /** Cumulative API usage for the session, for the cost readout. */
  usage: { inputTokens: number; outputTokens: number };
  past: Snapshot[];
  future: Snapshot[];
}

export const initialDeckState: DeckState = {
  brandId: "giga",
  brief: "",
  count: 8,
  slides: [],
  activeIndex: 0,
  status: "idle",
  usage: { inputTokens: 0, outputTokens: 0 },
  past: [],
  future: [],
};

export type DeckAction =
  | { type: "HYDRATE"; state: Partial<DeckState> }
  | { type: "SET_BRAND"; brandId: BrandId }
  | { type: "SET_BRIEF"; brief: string }
  | { type: "SET_COUNT"; count: number }
  | { type: "GENERATION_START"; replace: boolean }
  | { type: "APPEND_SLIDE"; content: SlideContent }
  | { type: "REPLACE_SLIDE"; index: number; content: SlideContent }
  | { type: "GENERATION_DONE"; usage?: { inputTokens: number; outputTokens: number } }
  | { type: "GENERATION_ERROR"; error: string }
  | { type: "EDIT_FIELD"; index: number; path: string; value: string }
  | { type: "DELETE_ITEM"; index: number; path: string }
  | { type: "ADD_ITEM"; index: number }
  | { type: "TOGGLE_CELL"; index: number; row: number; col: number }
  | { type: "SET_BARS"; index: number; bars: { label: string; value: number }[] }
  | { type: "SET_LOGO"; index: number; slug: string; dataUrl: string }
  | { type: "MOVE"; from: number; to: number }
  | { type: "DUPLICATE"; index: number }
  | { type: "DELETE"; index: number }
  | { type: "INSERT"; content: SlideContent; index?: number }
  | { type: "SET_ACTIVE"; index: number }
  | { type: "STEP"; delta: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" };

/** Set a dotted path ("blocks.2.body") inside a slide, immutably. */
export function setPath(slide: Slide, path: string, value: string): Slide {
  const keys = path.split(".");
  const clone: Slide = structuredClone(slide);
  let node: unknown = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (Array.isArray(node)) node = node[Number(key)];
    else node = (node as Record<string, unknown>)[key];
    if (node == null) return slide;
  }
  const last = keys[keys.length - 1];
  if (Array.isArray(node)) node[Number(last)] = value;
  else (node as Record<string, unknown>)[last] = value;
  return clone;
}

/** Push the current slides onto the undo stack (called before a mutation). */
function remember(state: DeckState): Pick<DeckState, "past" | "future"> {
  return {
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), { slides: state.slides, activeIndex: state.activeIndex }],
    future: [],
  };
}

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.state, status: "idle", past: [], future: [] };
    case "SET_BRAND":
      return { ...state, brandId: action.brandId };
    case "SET_BRIEF":
      return { ...state, brief: action.brief };
    case "SET_COUNT":
      return { ...state, count: action.count };
    case "GENERATION_START":
      return {
        ...state,
        ...(action.replace && state.slides.length > 0 ? remember(state) : {}),
        status: "generating",
        error: undefined,
        slides: action.replace ? [] : state.slides,
        activeIndex: action.replace ? 0 : state.activeIndex,
      };
    case "APPEND_SLIDE": {
      // No history push: generation is undone as a whole via GENERATION_START's snapshot.
      const slides = [...state.slides, ensureId(action.content)];
      return { ...state, slides, activeIndex: slides.length - 1 };
    }
    case "REPLACE_SLIDE": {
      const slides = [...state.slides];
      const old = slides[action.index];
      if (!old) return state;
      // Keep an uploaded image across AI regenerations of the slide
      slides[action.index] = { ...action.content, image: action.content.image ?? old.image, id: old.id };
      return { ...state, ...remember(state), slides };
    }
    case "GENERATION_DONE":
      return {
        ...state,
        status: "idle",
        usage: action.usage
          ? {
              inputTokens: state.usage.inputTokens + action.usage.inputTokens,
              outputTokens: state.usage.outputTokens + action.usage.outputTokens,
            }
          : state.usage,
      };
    case "GENERATION_ERROR":
      return { ...state, status: "error", error: action.error };
    case "EDIT_FIELD": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      const slides = [...state.slides];
      slides[action.index] = setPath(slide, action.path, action.value);
      return { ...state, ...remember(state), slides };
    }
    case "DELETE_ITEM": {
      // path like "blocks.2" — remove one element from the slide's item array
      const slide = state.slides[action.index];
      if (!slide) return state;
      const [field, idxStr] = action.path.split(".");
      const spec = PRIMARY_ARRAY[slide.layoutId];
      if (!spec || spec.field !== field) return state;
      const arr = slide[spec.field];
      if (!Array.isArray(arr) || arr.length <= 1) return state;
      const clone = structuredClone(slide);
      (clone[spec.field] as unknown[]).splice(Number(idxStr), 1);
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "TOGGLE_CELL": {
      const slide = state.slides[action.index];
      if (!slide || (slide.layoutId !== "tiers-1" && slide.layoutId !== "tiers-2")) return state;
      const clone = structuredClone(slide);
      clone.grid ??= tierDefaultGrid(slide.layoutId);
      const current = clone.grid[action.row]?.[action.col];
      if (current === undefined) return state;
      // cycle: ✅ → ✅ dimmed → empty → ✅ (text cells are not clickable)
      clone.grid[action.row][action.col] =
        current === "on" ? "half" : current === "half" ? null : "on";
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "SET_BARS": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      const slides = [...state.slides];
      slides[action.index] = { ...structuredClone(slide), bars: action.bars };
      return { ...state, ...remember(state), slides };
    }
    case "SET_LOGO": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      const clone = structuredClone(slide);
      clone.logos = { ...clone.logos, [action.slug]: action.dataUrl };
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "ADD_ITEM": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      const spec = PRIMARY_ARRAY[slide.layoutId];
      if (!spec) return state;
      const arr = (slide[spec.field] ?? []) as unknown[];
      if (arr.length >= spec.max) return state;
      const clone = structuredClone(slide);
      ((clone[spec.field] ??= [] as never) as unknown[]).push(newItem(spec.field));
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "MOVE": {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.slides.length || to >= state.slides.length)
        return state;
      const slides = [...state.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return { ...state, ...remember(state), slides, activeIndex: to };
    }
    case "DUPLICATE": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      const slides = [...state.slides];
      slides.splice(action.index + 1, 0, { ...structuredClone(slide), id: crypto.randomUUID() });
      return { ...state, ...remember(state), slides, activeIndex: action.index + 1 };
    }
    case "DELETE": {
      const slides = state.slides.filter((_, i) => i !== action.index);
      return {
        ...state,
        ...remember(state),
        slides,
        activeIndex: Math.min(state.activeIndex, Math.max(0, slides.length - 1)),
      };
    }
    case "INSERT": {
      const at = action.index ?? state.activeIndex + 1;
      const slides = [...state.slides];
      slides.splice(at, 0, ensureId(action.content));
      return { ...state, ...remember(state), slides, activeIndex: at };
    }
    case "SET_ACTIVE":
      return { ...state, activeIndex: Math.max(0, Math.min(action.index, state.slides.length - 1)) };
    case "STEP":
      return {
        ...state,
        activeIndex: Math.max(0, Math.min(state.activeIndex + action.delta, state.slides.length - 1)),
      };
    case "UNDO": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [...state.future, { slides: state.slides, activeIndex: state.activeIndex }],
        slides: prev.slides,
        activeIndex: Math.min(prev.activeIndex, Math.max(0, prev.slides.length - 1)),
      };
    }
    case "REDO": {
      const next = state.future[state.future.length - 1];
      if (!next) return state;
      return {
        ...state,
        future: state.future.slice(0, -1),
        past: [...state.past, { slides: state.slides, activeIndex: state.activeIndex }],
        slides: next.slides,
        activeIndex: Math.min(next.activeIndex, Math.max(0, next.slides.length - 1)),
      };
    }
    case "CLEAR":
      return {
        ...initialDeckState,
        ...remember(state),
        brandId: state.brandId,
        brief: state.brief,
        count: state.count,
      };
    default:
      return state;
  }
}
