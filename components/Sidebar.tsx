"use client";

import { useState } from "react";
import { BRANDS, BRAND_IDS, type BrandId } from "@/lib/slides/brand";
import type { DeckState, DeckAction } from "@/lib/slides/state";

interface SidebarProps {
  state: DeckState;
  dispatch: (action: DeckAction) => void;
  onGenerate: () => void;
  onAddMore: (instruction: string, count: number) => void;
  /** Reopens the welcome card, which is the only place the brief rules live. */
  onHowItWorks: () => void;
}

/** Sidebar section label — the BAG eyebrow at product scale. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-manrope mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-giga">
      {children}
    </span>
  );
}

/**
 * Switch row that lives *inside* the prompt group, sharing its border. It is a
 * generation input, not a live view option: a detached card reads as "flip it
 * and the deck changes", which is not what happens (it takes effect on the
 * next generation). Sitting on the prompt box, it reads as part of what
 * Generate sends.
 */
function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
  tourTarget,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  tourTarget?: string;
}) {
  return (
    <button
      type="button"
      data-tour={tourTarget}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-b-lg border-t border-hairline px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-giga-tint focus-visible:bg-giga-tint disabled:pointer-events-none disabled:opacity-40"
    >
      <span>
        <span className="font-manrope block text-sm font-semibold tracking-[-0.01em] text-ink">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${
          checked ? "bg-giga" : "bg-hairline"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-stripe transition-transform duration-150 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

const SECONDARY_BTN =
  "h-10 rounded-full border border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:border-giga-100 hover:bg-giga-tint disabled:pointer-events-none disabled:opacity-40";

export default function Sidebar({
  state,
  dispatch,
  onGenerate,
  onAddMore,
  onHowItWorks,
}: SidebarProps) {
  const [addBrief, setAddBrief] = useState("");
  const [addCount, setAddCount] = useState(2);
  const [addOpen, setAddOpen] = useState(false);
  const generating = state.status === "generating";
  const hasSlides = state.slides.length > 0;
  const deckHasChapters = state.slides.some(
    (s) => s.layoutId === "agenda" || s.layoutId === "section-divider",
  );
  const chaptersPending = hasSlides && deckHasChapters !== state.chapters;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-hairline bg-white p-6 *:shrink-0">
      <div>
        {/* Same colored lockup as the Brand Asset Generator header */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/unicef-digital-impact-unboxed.svg"
          alt="UNICEF Digital Impact Division"
          className="h-12 w-auto"
        />
      </div>

      {/* Logo lockup: colors stay Giga on every option, only logo and footer change */}
      <div>
        <Eyebrow>Logo</Eyebrow>
        <div className="relative">
          <select
            value={state.brandId}
            onChange={(e) => dispatch({ type: "SET_BRAND", brandId: e.target.value as BrandId })}
            className="w-full cursor-pointer appearance-none rounded-lg border border-hairline bg-white px-3 py-2.5 pr-9 text-sm font-semibold text-ink outline-none transition-shadow duration-150 hover:border-giga-100 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
          >
            {BRAND_IDS.map((id: BrandId) => (
              <option key={id} value={id}>
                {BRANDS[id].label}
              </option>
            ))}
          </select>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Template. Only on Digital Inclusion, which is the one brand the A4
          two-pager exists for, and only while the deck is empty: the two
          formats do not mix, and the reducer enforces that too. */}
      {state.brandId === "inclusion" && (
        <div>
          <Eyebrow>Template</Eyebrow>
          <div className="flex rounded-lg border border-hairline bg-white p-0.5">
            {(
              [
                ["slides", "Slides"],
                ["two-pager", "Two-pager"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                disabled={state.slides.length > 0 && state.format !== id}
                onClick={() => dispatch({ type: "SET_FORMAT", format: id })}
                title={
                  state.slides.length > 0
                    ? "Delete the deck to switch template"
                    : id === "two-pager"
                      ? "A4 pages, made to be printed"
                      : "16:9 slides"
                }
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                  state.format === id
                    ? "bg-giga text-white"
                    : state.slides.length > 0
                      ? "text-ink-muted/50"
                      : "text-ink-muted hover:bg-giga-tint hover:text-giga"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brief. The Chapters switch shares this box: both are inputs to the
          same Generate press. Agenda and dividers are one switch because the
          agenda only exists to mirror the dividers — an agenda without
          chapters is a broken state, not an option. */}
      <div>
        <Eyebrow>Prompt</Eyebrow>
        <div
          data-tour="prompt"
          className="rounded-lg border border-hairline bg-white transition-shadow duration-150 focus-within:border-giga focus-within:ring-[3px] focus-within:ring-giga/15"
        >
          <textarea
            value={state.brief}
            onChange={(e) => dispatch({ type: "SET_BRIEF", brief: e.target.value })}
            placeholder="E.g. A partnership pitch for a telecom operator in East Africa: what Giga does, the opportunity, what we ask, what they get, impact numbers…"
            rows={7}
            className="block w-full resize-y rounded-t-lg bg-transparent p-3 text-sm text-ink outline-none placeholder:text-ink-muted/70"
          />
          <SwitchRow
            tourTarget="chapters"
            label="Chapters"
            hint="Agenda slide and section dividers"
            checked={state.chapters}
            disabled={generating}
            onChange={(chapters) => dispatch({ type: "SET_CHAPTERS", chapters })}
          />
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          Describe the story. The AI picks the right template slides, decides how many the story
          needs (ask for a count if you want one) and fills them in.
        </p>
        {/* The switch only takes effect on the next generation, so say so
            exactly when the deck on screen disagrees with it. */}
        {chaptersPending && (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            The deck on screen still has {state.chapters ? "no chapters" : "chapters"}. Regenerate
            to apply.
          </p>
        )}
      </div>

      <button
        data-tour="generate"
        onClick={onGenerate}
        disabled={generating || !state.brief.trim()}
        className="font-manrope h-12 rounded-full bg-giga px-6 text-sm font-semibold text-white shadow-stripe-md transition-all duration-150 hover:bg-giga-deep active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        {generating ? "Generating…" : hasSlides ? "Regenerate deck" : "Generate deck"}
      </button>

      {/* Targeted additions live in a modal: what to add + how many; the AI
          picks the position and refreshes the agenda, existing slides are
          never touched. */}
      {hasSlides && (
        <button
          data-tour="add-slides"
          onClick={() => setAddOpen(true)}
          disabled={generating}
          className={`${SECONDARY_BTN} flex items-center justify-center gap-1.5`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add slides
        </button>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="pop-in w-full max-w-md rounded-2xl bg-white p-5 shadow-stripe-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Eyebrow>Add slides</Eyebrow>
            <p className="mb-3 text-xs leading-relaxed text-ink-muted">
              Describe what to add. The AI writes the slides, picks where they fit and updates the
              agenda.
            </p>
            <textarea
              autoFocus
              value={addBrief}
              onChange={(e) => setAddBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAddOpen(false);
              }}
              placeholder="E.g. team structure: vertical teams (Tech, Finance, Product) plus cross-cutting functions"
              rows={4}
              className="w-full resize-y rounded-lg border border-hairline bg-white p-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted/70 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                Slides
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={addCount}
                  onChange={(e) => setAddCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  className="h-10 w-16 rounded-lg border border-hairline bg-white px-2 text-center text-sm text-ink outline-none transition-shadow duration-150 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAddOpen(false)}
                  className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onAddMore(addBrief, addCount);
                    setAddBrief("");
                    setAddOpen(false);
                  }}
                  disabled={generating || !addBrief.trim()}
                  className="font-manrope h-10 rounded-full bg-giga px-5 text-sm font-semibold text-white shadow-stripe-md transition-all duration-150 hover:bg-giga-deep active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                >
                  Add slides
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-lg border border-status-red/30 bg-status-red/5 p-3 text-xs leading-relaxed text-status-red">
          {state.error}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={onHowItWorks}
          className="flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:bg-giga-tint hover:text-giga"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.2" />
            <path d="M12 17h.01" />
          </svg>
          How it works
        </button>
        {hasSlides && (
          <button
            onClick={() => {
              if (confirm("Delete the current deck?")) dispatch({ type: "CLEAR" });
            }}
            className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-status-red/40 bg-white px-4 text-xs font-semibold text-status-red transition-colors duration-150 hover:border-status-red hover:bg-status-red/5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
            </svg>
            Delete deck
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
