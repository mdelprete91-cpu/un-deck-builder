"use client";

import { CircleHelp, Plus } from "lucide-react";
import { useState } from "react";
import { BRANDS, PICKER_BRAND_IDS, type BrandId } from "@/lib/slides/brand";
import type { DeckState, DeckAction } from "@/lib/slides/state";
import type { Attachment } from "@/lib/slides/attachments";
import Button from "@/components/Button";
import ThemeToggle from "@/components/ThemeToggle";
import GenerationReadout from "@/components/GenerationReadout";
import PromptBox from "@/components/PromptBox";
import Select from "@/components/Select";

interface SidebarProps {
  state: DeckState;
  dispatch: (action: DeckAction) => void;
  onGenerate: () => void;
  onAddMore: (instruction: string, count: number) => void;
  /** Reopens the welcome card, which is the only place the brief rules live. */
  onHowItWorks: () => void;
  /** Reference files for the brief; session state in page.tsx, never in the deck. */
  attachments: Attachment[];
  onAttach: (files: File[]) => Promise<void> | void;
  onRemoveAttachment: (id: string) => void;
  attachError: string | null;
}

/** Sidebar section label — the BAG eyebrow at product scale. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[13px] font-normal text-ink-faint">
      {children}
    </span>
  );
}

/**
 * The two-pager is not ready (Mario, 15 Sep 2026: still buggy), so the row that
 * starts one is hidden. Everything behind it stays: a saved two-pager still
 * opens, because the format is derived from the slides, not from this switch.
 */
const SHOW_TEMPLATE_SWITCH = false;

export default function Sidebar({
  state,
  dispatch,
  onGenerate,
  onAddMore,
  onHowItWorks,
  attachments,
  onAttach,
  onRemoveAttachment,
  attachError,
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
    <aside className="flex h-full w-[340px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-hairline-light bg-canvas p-6 *:shrink-0">
      <div>
        {/* Same colored lockup as the Brand Asset Generator header */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/unicef-digital-impact-unboxed.svg"
          alt="UNICEF Digital Impact Division"
          // The lockup is cyan and black; on the dark chrome it goes all white.
          className="h-12 w-auto dark:brightness-0 dark:invert"
        />
      </div>

      {/* Settings rows in the ChatGPT register: label left, value right, no
          rule between them. Logo lockup: colors stay Giga on every option,
          only logo and footer change. Template only on Digital Inclusion,
          the one brand the A4 two-pager exists for, and only while the deck
          is empty: the formats do not mix, and the reducer enforces that. */}
      <div className="flex flex-col">
        <div className="flex h-9 items-center justify-between gap-3">
          <span className="text-sm text-ink">Logo</span>
          <Select
            ariaLabel="Logo lockup"
            value={state.brandId}
            options={PICKER_BRAND_IDS.map((id: BrandId) => ({ value: id, label: BRANDS[id].label }))}
            onChange={(brandId) => dispatch({ type: "SET_BRAND", brandId })}
          />
        </div>
        {SHOW_TEMPLATE_SWITCH && state.brandId === "inclusion" && (
          <div className="flex h-9 items-center justify-between gap-3">
            <span className="text-sm text-ink">Template</span>
            <Select
              ariaLabel="Template"
              value={state.format}
              disabled={state.slides.length > 0}
              options={[
                { value: "slides", label: "Slides", hint: "16:9 slides" },
                { value: "two-pager", label: "Two-pager", hint: "A4 pages, made to be printed" },
              ]}
              onChange={(format) => dispatch({ type: "SET_FORMAT", format })}
            />
          </div>
        )}
      </div>

      {/* Brief. The composer holds everything one Generate press sends: the
          text, the files, the Chapters toggle and the button itself. Agenda
          and dividers are one toggle because the agenda only exists to mirror
          the dividers: an agenda without chapters is a broken state, not an
          option. */}
      <div>
        <PromptBox
          brief={state.brief}
          onBrief={(brief) => dispatch({ type: "SET_BRIEF", brief })}
          chapters={state.chapters}
          onChapters={(chapters) => dispatch({ type: "SET_CHAPTERS", chapters })}
          attachments={attachments}
          onAttach={onAttach}
          onRemoveAttachment={onRemoveAttachment}
          onGenerate={onGenerate}
          generating={generating}
          hasSlides={hasSlides}
        />
        {attachError && (
          <p className="mt-1.5 text-xs leading-relaxed text-status-red">{attachError}</p>
        )}
        {/* The toggle only takes effect on the next generation, so say so
            exactly when the deck on screen disagrees with it. */}
        {chaptersPending && (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            The deck on screen still has {state.chapters ? "no chapters" : "chapters"}. Regenerate
            to apply.
          </p>
        )}
      </div>

      {/* Targeted additions live in a modal: what to add + how many; the AI
          picks the position and refreshes the agenda, existing slides are
          never touched. */}
      {hasSlides && (
        <Button
          variant="secondary"
          icon={Plus}
          data-tour="add-slides"
          onClick={() => setAddOpen(true)}
          disabled={generating}
          className="w-full"
        >
          Add slides
        </Button>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="pop-in w-full max-w-md rounded-2xl bg-surface p-5 shadow-stripe-lg"
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
              className="w-full resize-y rounded-lg border border-hairline bg-surface p-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
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
                  className="h-10 w-16 rounded-lg border border-hairline bg-surface px-2 text-center text-sm text-ink outline-none transition-shadow duration-150 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onAddMore(addBrief, addCount);
                    setAddBrief("");
                    setAddOpen(false);
                  }}
                  disabled={generating || !addBrief.trim()}
                >
                  Add slides
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-lg border border-status-red-border bg-status-red-bg p-3 text-xs leading-relaxed text-status-red">
          {state.error}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-4">
        {state.lastRun && <GenerationReadout lastRun={state.lastRun} session={state.usage} />}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" icon={CircleHelp} onClick={onHowItWorks}>
            How it works
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
