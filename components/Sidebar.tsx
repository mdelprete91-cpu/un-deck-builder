"use client";

import { BRANDS, BRAND_IDS, type BrandId } from "@/lib/slides/brand";
import type { DeckState, DeckAction } from "@/lib/slides/state";

interface SidebarProps {
  state: DeckState;
  dispatch: (action: DeckAction) => void;
  onGenerate: () => void;
  onAddMore: (count: number) => void;
}

/** Sidebar section label — the BAG eyebrow at product scale. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-manrope mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-giga">
      {children}
    </span>
  );
}

const SECONDARY_BTN =
  "h-10 rounded-full border border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:border-giga-100 hover:bg-giga-tint disabled:pointer-events-none disabled:opacity-40";

export default function Sidebar({ state, dispatch, onGenerate, onAddMore }: SidebarProps) {
  const generating = state.status === "generating";
  const hasSlides = state.slides.length > 0;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-hairline bg-white p-6">
      <div>
        <h1 className="font-manrope text-xl font-semibold tracking-[-0.03em] text-ink">
          Giga Deck Builder
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          Describe the story. The AI picks the right template slides and fills them in.
        </p>
      </div>

      {/* Brand style */}
      <div>
        <Eyebrow>Style</Eyebrow>
        <div className="flex flex-col gap-1.5">
          {BRAND_IDS.map((id: BrandId) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "SET_BRAND", brandId: id })}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm text-ink transition-colors duration-150 ${
                state.brandId === id
                  ? "border-giga bg-giga-tint font-semibold"
                  : "border-hairline hover:border-giga-100 hover:bg-canvas"
              }`}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: BRANDS[id].accent }}
              />
              {BRANDS[id].label}
            </button>
          ))}
        </div>
      </div>

      {/* Brief */}
      <div>
        <Eyebrow>Prompt</Eyebrow>
        <textarea
          value={state.brief}
          onChange={(e) => dispatch({ type: "SET_BRIEF", brief: e.target.value })}
          placeholder="E.g. A partnership pitch for a telecom operator in East Africa: what Giga does, the opportunity, what we ask, what they get, impact numbers…"
          rows={7}
          className="w-full resize-y rounded-lg border border-hairline bg-white p-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted/70 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
        />
      </div>

      {/* Count */}
      <div>
        <Eyebrow>Slides: {state.count}</Eyebrow>
        <input
          type="range"
          min={3}
          max={20}
          value={state.count}
          onChange={(e) => dispatch({ type: "SET_COUNT", count: Number(e.target.value) })}
          className="w-full accent-giga"
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={generating || !state.brief.trim()}
        className="font-manrope h-12 rounded-full bg-giga px-6 text-sm font-semibold text-white shadow-stripe-md transition-all duration-150 hover:bg-giga-deep active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        {generating ? "Generating…" : hasSlides ? "Regenerate deck" : "Generate deck"}
      </button>

      {hasSlides && (
        <button onClick={() => onAddMore(3)} disabled={generating} className={SECONDARY_BTN}>
          + Add 3 more slides
        </button>
      )}

      {state.status === "error" && (
        <div className="rounded-lg border border-status-red/30 bg-status-red/5 p-3 text-xs leading-relaxed text-status-red">
          {state.error}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {hasSlides && (
          <button
            onClick={() => {
              if (confirm("Clear the current deck?")) dispatch({ type: "CLEAR" });
            }}
            className="rounded-full px-4 py-1.5 text-xs text-ink-muted transition-colors duration-150 hover:text-status-red"
          >
            Clear deck
          </button>
        )}
        {(state.usage.inputTokens > 0 || state.usage.outputTokens > 0) && (
          <p className="text-center text-[10px] text-ink-muted/80">
            Session: {state.usage.inputTokens.toLocaleString()} in ·{" "}
            {state.usage.outputTokens.toLocaleString()} out tokens
          </p>
        )}
      </div>
    </aside>
  );
}
