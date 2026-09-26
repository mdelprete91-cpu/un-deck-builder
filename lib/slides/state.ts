import type { ImagePos, Slide, SlideContent } from "./schema";
import { ensureId, isPage, normalizeSeries, normalizeSlide, PRIMARY_ARRAY } from "./schema";
import { closingFor, mergeContinuations, unifyLayouts } from "./rhythm";
import { BRANDS } from "./brand";
import { MAX_BLOCKS_PER_PAGE, PAGE_BLOCK_LIMITS, type PageBlockType } from "./pages/schema";
import { defaultBlock, newPageItem } from "./pages/presets";
import { newItem, defaultContent } from "./defaults";
import { tierDefaultGrid } from "./layouts/tables";
import type { BrandId } from "./brand";

interface Snapshot {
  slides: Slide[];
  activeIndex: number;
}

const HISTORY_LIMIT = 50;

/**
 * What the deck produces. "slides" is the 16:9 deck; "two-pager" is the A4
 * print piece, available on the Digital Inclusion brand only. A deck is one or
 * the other, decided while it is still empty.
 */
export type DeckFormat = "slides" | "two-pager";

/** The only brand the two-pager template exists for. */
export const TWO_PAGER_BRAND = "inclusion";

/** What a deck is called until someone names it. */
export const DEFAULT_DECK_NAME = "New deck";

export interface DeckState {
  /** The deck's name: the file name of every download, editable in the toolbar. */
  name: string;
  brandId: BrandId;
  format: DeckFormat;
  brief: string;
  count: number;
  /**
   * Whether generated decks get chapters: the agenda slide and the
   * section-divider slides that it mirrors. A generation setting, not a view
   * option — turning it off never touches the deck already on screen.
   */
  chapters: boolean;
  slides: Slide[];
  activeIndex: number;
  status: "idle" | "generating" | "error";
  error?: string;
  /** Cumulative API usage for the session, for the cost readout. */
  usage: { inputTokens: number; outputTokens: number };
  /**
   * The last generation, for the readout under "How it works": what it cost
   * and how long it took. Saved with the session (not in the deck file), so
   * it is still there after a reload.
   */
  lastRun?: { seconds: number; inputTokens: number; outputTokens: number };
  /** When the running generation started, to time it. */
  startedAt?: number;
  past: Snapshot[];
  future: Snapshot[];
}

export const initialDeckState: DeckState = {
  name: DEFAULT_DECK_NAME,
  brandId: "did",
  format: "slides",
  brief: "",
  count: 8,
  chapters: false,
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
  | { type: "SET_FORMAT"; format: DeckFormat }
  | { type: "RENAME"; name: string }
  | { type: "SET_BRIEF"; brief: string }
  | { type: "SET_COUNT"; count: number }
  | { type: "SET_CHAPTERS"; chapters: boolean }
  | { type: "GENERATION_START"; replace: boolean }
  | { type: "APPEND_SLIDE"; content: SlideContent }
  | { type: "REPLACE_SLIDE"; index: number; content: SlideContent }
  | { type: "GENERATION_DONE"; usage?: { inputTokens: number; outputTokens: number } }
  | { type: "INSERT_TIERS" }
  | { type: "SET_IMAGE_POS"; index: number; pos: ImagePos; path?: string }
  | { type: "SET_LOGO_TONE"; id: string; tone: "light" | "dark" }
  | { type: "SET_ICON"; index: number; block: number; icon: string; path?: string }
  | { type: "INSERT_SLIDES"; at: number | null; contents: SlideContent[]; agenda?: string[] }
  | { type: "GENERATION_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | { type: "EDIT_FIELD"; index: number; path: string; value: string }
  | { type: "DELETE_ITEM"; index: number; path: string }
  | { type: "ADD_ITEM"; index: number; path?: string }
  | { type: "ADD_BLOCK"; index: number; at: number; blockType: PageBlockType }
  | { type: "DELETE_BLOCK"; index: number; block: number }
  | { type: "MOVE_BLOCK"; index: number; from: number; to: number }
  | { type: "TOGGLE_CELL"; index: number; row: number; col: number }
  /** Generation done: a deck that ends without its closing slide gets the default one. */
  | { type: "ENSURE_CLOSING" }
  /** Generation done under "same layout": every blocks-family slide takes the one layout that holds them all. */
  | { type: "UNIFY_LAYOUTS" }
  /** Generation done: consecutive slides with one title fold into one. */
  | { type: "MERGE_CONTINUATIONS" }
  | { type: "SET_BARS"; index: number; bars: { label: string; value: number; values?: number[]; color?: string }[]; series?: string[] }
  | { type: "SET_LOGO"; index: number; slug: string; dataUrl: string }
  | { type: "SET_IMAGE"; index: number; dataUrl: string; path?: string }
  | { type: "CLEAR_IMAGE"; index: number; path?: string }
  | { type: "SET_MAP"; index: number; slug: string | null }
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
export function setPath(slide: Slide, path: string, value: unknown): Slide {
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

/** Read a dotted path off a slide; the counterpart of setPath. */
export function readPath(slide: Slide, path: string): unknown {
  let node: unknown = slide;
  for (const key of path.split(".")) {
    if (node == null) return undefined;
    node = Array.isArray(node) ? node[Number(key)] : (node as Record<string, unknown>)[key];
  }
  return node;
}

/** Push the current slides onto the undo stack (called before a mutation). */
function remember(state: DeckState): Pick<DeckState, "past" | "future"> {
  return {
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), { slides: state.slides, activeIndex: state.activeIndex }],
    future: [],
  };
}

/**
 * The agenda is a live index of the deck's chapters: when section-divider
 * slides exist, its bullets always mirror their titles in deck order.
 * Decks without dividers keep a manual agenda.
 */
function syncAgenda(slides: Slide[]): Slide[] {
  const ai = slides.findIndex((s) => s.layoutId === "agenda");
  if (ai < 0) return slides;
  const chapters = slides
    .filter((s) => s.layoutId === "section-divider")
    .map((s) => (s.title ?? "").trim());
  if (chapters.length === 0) return slides;
  const bullets = chapters.slice(0, 9);
  const current = slides[ai].bullets ?? [];
  if (current.length === bullets.length && current.every((b, i) => b === bullets[i])) return slides;
  const next = [...slides];
  next[ai] = { ...next[ai], bullets };
  return next;
}

/** Deck positions of the section-divider slides, in order. */
function dividerIndexes(slides: Slide[]): number[] {
  return slides.flatMap((s, i) => (s.layoutId === "section-divider" ? [i] : []));
}

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  const next = reduce(state, action);
  if (next.slides !== state.slides) {
    const synced = syncAgenda(next.slides);
    if (synced !== next.slides) return { ...next, slides: synced };
  }
  return next;
}

function reduce(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    // Restores a whole session: localStorage on load, or a reopened deck file.
    // History is dropped on purpose — a Snapshot carries only slides, so undoing
    // past a hydrate would leave old slides sitting in the new brand and brief.
    case "HYDRATE":
      return {
        ...state,
        ...action.state,
        status: "idle",
        error: undefined,
        past: [],
        future: [],
      };
    case "SET_BRAND":
      // A two-pager only exists on the Digital Inclusion brand. The guard is
      // here rather than only in the sidebar so no other path can strand a
      // cyan print piece on the Giga palette.
      if (state.format === "two-pager" && action.brandId !== TWO_PAGER_BRAND) return state;
      return { ...state, brandId: action.brandId };
    case "SET_FORMAT":
      // Only while the deck is empty: the two formats do not mix, and the
      // switch is a decision about the document, not a view toggle.
      if (state.slides.length > 0 || state.format === action.format) return state;
      return {
        ...state,
        format: action.format,
        brandId: action.format === "two-pager" ? TWO_PAGER_BRAND : state.brandId,
        // A two-pager is a two-pager: the name is the spec. The slide default
        // (8) would ask the model for an eight-page brief.
        count: action.format === "two-pager" ? 2 : initialDeckState.count,
      };
    case "RENAME":
      return { ...state, name: action.name.trim() || DEFAULT_DECK_NAME };
    case "SET_BRIEF":
      return { ...state, brief: action.brief };
    case "SET_COUNT":
      return { ...state, count: action.count };
    case "SET_CHAPTERS":
      return { ...state, chapters: action.chapters };
    case "GENERATION_START":
      return {
        ...state,
        ...(action.replace && state.slides.length > 0 ? remember(state) : {}),
        status: "generating",
        error: undefined,
        startedAt: Date.now(),
        slides: action.replace ? [] : state.slides,
        activeIndex: action.replace ? 0 : state.activeIndex,
      };
    case "APPEND_SLIDE": {
      // No history push: generation is undone as a whole via GENERATION_START's snapshot.
      const slides = [...state.slides, ensureId(action.content)];
      return { ...state, slides, activeIndex: slides.length - 1 };
    }
    case "ENSURE_CLOSING": {
      // The model left the closing slide out (a numbers deck of eight stats,
      // a five-slide intro with the contacts on a slide that never came,
      // 26 Sep 2026): the default one lands, so the deck ends the way every
      // deck does.
      const last = state.slides[state.slides.length - 1];
      if (!last || isPage(last) || last.layoutId === "thank-you") return state;
      const closing = normalizeSlide(closingFor(BRANDS[state.brandId]?.label), { brandId: state.brandId });
      if (!closing) return state;
      return { ...state, slides: [...state.slides, ensureId(closing)] };
    }
    case "MERGE_CONTINUATIONS": {
      if (state.slides.some(isPage)) return state;
      const merged = mergeContinuations(state.slides) as Slide[];
      if (merged.length === state.slides.length) return state;
      return { ...state, slides: merged, activeIndex: Math.min(state.activeIndex, merged.length - 1) };
    }
    case "UNIFY_LAYOUTS": {
      if (state.slides.some(isPage)) return state;
      const unified = unifyLayouts(state.slides);
      return { ...state, slides: unified.map((s, i) => (s === state.slides[i] ? state.slides[i] : { ...state.slides[i], ...s })) as Slide[] };
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
        startedAt: undefined,
        lastRun: action.usage
          ? {
              seconds: state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0,
              inputTokens: action.usage.inputTokens,
              outputTokens: action.usage.outputTokens,
            }
          : state.lastRun,
        usage: action.usage
          ? {
              inputTokens: state.usage.inputTokens + action.usage.inputTokens,
              outputTokens: state.usage.outputTokens + action.usage.outputTokens,
            }
          : state.usage,
      };
    case "CLEAR_ERROR":
      return state.status === "error" ? { ...state, status: "idle", error: undefined } : state;
    case "GENERATION_ERROR":
      return { ...state, status: "error", error: action.error };
    case "EDIT_FIELD": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      // Agenda bullets are chapter titles: editing one renames the matching
      // section-divider (the agenda re-syncs from it).
      const bullet = /^bullets\.(\d+)$/.exec(action.path);
      if (slide.layoutId === "agenda" && bullet) {
        const dividers = dividerIndexes(state.slides);
        const target = dividers[Number(bullet[1])];
        if (target !== undefined) {
          const slides = [...state.slides];
          slides[target] = { ...slides[target], title: action.value };
          return { ...state, ...remember(state), slides };
        }
      }
      const slides = [...state.slides];
      slides[action.index] = setPath(slide, action.path, action.value);
      return { ...state, ...remember(state), slides };
    }
    case "DELETE_ITEM": {
      // path like "blocks.2" — remove one element from the slide's item array
      const slide = state.slides[action.index];
      if (!slide) return state;
      const [field, idxStr] = action.path.split(".");
      // Agenda bullets are chapter titles: deleting one removes the matching
      // section-divider slide (chapter content stays).
      if (slide.layoutId === "agenda" && field === "bullets") {
        const dividers = dividerIndexes(state.slides);
        const target = dividers[Number(idxStr)];
        if (target !== undefined) {
          const slides = state.slides.filter((_, i) => i !== target);
          return {
            ...state,
            ...remember(state),
            slides,
            activeIndex: Math.min(state.activeIndex, Math.max(0, slides.length - 1)),
          };
        }
      }
      // On a page the editable array belongs to a block, not to the slide.
      if (isPage(slide)) {
        const m = /^stack\.(\d+)\.items\.(\d+)$/.exec(action.path);
        if (!m) return state;
        const [b, i] = [Number(m[1]), Number(m[2])];
        const block = slide.stack?.[b];
        const limits = block && PAGE_BLOCK_LIMITS[block.type];
        const arr = block?.items ?? [];
        if (!limits || arr.length <= limits[0]) return state;
        const clone = structuredClone(slide);
        clone.stack![b].items!.splice(i, 1);
        const slides = [...state.slides];
        slides[action.index] = clone;
        return { ...state, ...remember(state), slides };
      }
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
      if (!slide || isPage(slide)) return state;
      const slides = [...state.slides];
      const next = { ...structuredClone(slide), bars: action.bars };
      if (action.series) next.series = action.series;
      // The contract (one figure per series on every bar) holds after every edit.
      normalizeSeries(next);
      slides[action.index] = next;
      return { ...state, ...remember(state), slides };
    }
    case "SET_LOGO": {
      const slide = state.slides[action.index];
      if (!slide || isPage(slide)) return state;
      const clone = structuredClone(slide);
      clone.logos = { ...clone.logos, [action.slug]: action.dataUrl };
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    // A photo and a country map are alternatives in the same slot, so setting
    // one clears the other. The reframe belongs to the photo: a map is drawn
    // whole, and keeping a stale crop would apply it to the next upload.
    case "SET_IMAGE": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      // A page carries several images, each addressed by its own path.
      if (action.path && action.path !== "image") {
        const slides = [...state.slides];
        slides[action.index] = setPath(slide, action.path, action.dataUrl);
        return { ...state, ...remember(state), slides };
      }
      const clone = structuredClone(slide);
      clone.image = action.dataUrl;
      delete clone.map;
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "CLEAR_IMAGE": {
      // Back to the placeholder: the photo, its framing and any map go.
      const slide = state.slides[action.index];
      if (!slide) return state;
      if (action.path && action.path !== "image") {
        const slides = [...state.slides];
        slides[action.index] = setPath(slide, action.path, undefined);
        return { ...state, ...remember(state), slides };
      }
      const clone = structuredClone(slide);
      delete clone.image;
      delete clone.imagePos;
      delete clone.map;
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "SET_MAP": {
      const slide = state.slides[action.index];
      if (!slide || isPage(slide)) return state;
      const clone = structuredClone(slide);
      if (action.slug === null) {
        delete clone.map;
      } else {
        clone.map = action.slug;
        delete clone.image;
        delete clone.imagePos;
      }
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "SET_IMAGE_POS": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      const slides = [...state.slides];
      // The reframe is reported against the image's path; its position lives
      // in the sibling field ("…items.0.image" -> "…items.0.imagePos").
      if (action.path && action.path !== "image") {
        slides[action.index] = setPath(slide, action.path.replace(/image$/, "imagePos"), action.pos);
      } else {
        slides[action.index] = { ...slide, imagePos: action.pos };
      }
      return { ...state, ...remember(state), slides };
    }
    case "SET_ICON": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      if (action.path) {
        const slides = [...state.slides];
        slides[action.index] = setPath(slide, action.path, action.icon);
        return { ...state, ...remember(state), slides };
      }
      const clone = structuredClone(slide);
      clone.icons ??= [];
      clone.icons[action.block] = action.icon;
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "SET_LOGO_TONE": {
      // Derived from the photo's pixels, addressed by id (the compute is
      // async, indexes may have shifted). Not a user edit: no history push.
      const i = state.slides.findIndex((s) => s.id === action.id);
      if (i < 0 || state.slides[i].logoTone === action.tone) return state;
      const slides = [...state.slides];
      slides[i] = { ...slides[i], logoTone: action.tone };
      return { ...state, slides };
    }
    case "INSERT_SLIDES": {
      // AI-added slides land at the position the model chose (null = append)
      // and the agenda slide, if any, gets its refreshed bullets.
      if (action.contents.length === 0) return state;
      const slides = [...state.slides];
      const at = Math.max(0, Math.min(action.at ?? slides.length, slides.length));
      slides.splice(at, 0, ...action.contents.map(ensureId));
      if (action.agenda && action.agenda.length > 0) {
        const ai = slides.findIndex((s) => s.layoutId === "agenda");
        if (ai >= 0) slides[ai] = { ...slides[ai], bullets: action.agenda.slice(0, 9) };
      }
      return { ...state, ...remember(state), slides, activeIndex: at };
    }
    case "INSERT_TIERS": {
      // Partnership decks get the two fixed partnership-tier slides, inserted
      // before a closing thank-you. No-op if the deck already has them, and
      // never on a two-pager: the tier tables are slide geometry.
      if (state.format === "two-pager") return state;
      if (state.slides.some((s) => s.layoutId === "tiers-1" || s.layoutId === "tiers-2")) return state;
      const slides = [...state.slides];
      const at =
        slides.length > 0 && slides[slides.length - 1].layoutId === "thank-you"
          ? slides.length - 1
          : slides.length;
      slides.splice(at, 0, ensureId(defaultContent("tiers-1")), ensureId(defaultContent("tiers-2")));
      return { ...state, slides };
    }
    case "ADD_ITEM": {
      const slide = state.slides[action.index];
      if (!slide) return state;
      // Adding an agenda item on a chaptered deck creates the chapter too:
      // a new section-divider lands before the closing thank-you and the
      // agenda picks up its title automatically.
      if (slide.layoutId === "agenda" && dividerIndexes(state.slides).length > 0) {
        if (dividerIndexes(state.slides).length >= 9) return state;
        const slides = [...state.slides];
        const at =
          slides.length > 0 && slides[slides.length - 1].layoutId === "thank-you"
            ? slides.length - 1
            : slides.length;
        slides.splice(at, 0, ensureId({ layoutId: "section-divider", title: "New chapter" }));
        return { ...state, ...remember(state), slides };
      }
      if (isPage(slide)) {
        const m = /^stack\.(\d+)$/.exec(action.path ?? "");
        if (!m) return state;
        const b = Number(m[1]);
        const block = slide.stack?.[b];
        const limits = block && PAGE_BLOCK_LIMITS[block.type];
        if (!block || !limits) return state;
        const items = block.items ?? [];
        if (items.length >= limits[1]) return state;
        const clone = structuredClone(slide);
        (clone.stack![b].items ??= []).push(newPageItem(block.type));
        const slides = [...state.slides];
        slides[action.index] = clone;
        return { ...state, ...remember(state), slides };
      }
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
    case "ADD_BLOCK": {
      const slide = state.slides[action.index];
      if (!slide || !isPage(slide)) return state;
      const stack = slide.stack ?? [];
      if (stack.length >= MAX_BLOCKS_PER_PAGE) return state;
      const clone = structuredClone(slide);
      const at = Math.max(0, Math.min(action.at, stack.length));
      (clone.stack ??= []).splice(at, 0, defaultBlock(action.blockType));
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "DELETE_BLOCK": {
      const slide = state.slides[action.index];
      if (!slide || !isPage(slide)) return state;
      const stack = slide.stack ?? [];
      // A page is never empty: deleting the last block would leave nothing to
      // click on, and the page itself is what you delete instead.
      if (stack.length <= 1) return state;
      const clone = structuredClone(slide);
      clone.stack!.splice(action.block, 1);
      const slides = [...state.slides];
      slides[action.index] = clone;
      return { ...state, ...remember(state), slides };
    }
    case "MOVE_BLOCK": {
      const slide = state.slides[action.index];
      if (!slide || !isPage(slide)) return state;
      const stack = slide.stack ?? [];
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= stack.length || to >= stack.length) return state;
      const clone = structuredClone(slide);
      const [moved] = clone.stack!.splice(from, 1);
      clone.stack!.splice(to, 0, moved);
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
      // Clamped: on an empty deck activeIndex + 1 is past the end, which used
      // to leave the canvas blank with the filmstrip showing the new slide.
      const at = Math.min(action.index ?? state.activeIndex + 1, state.slides.length);
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
        format: state.format,
        brief: state.brief,
        count: state.count,
        chapters: state.chapters,
      };
    default:
      return state;
  }
}
