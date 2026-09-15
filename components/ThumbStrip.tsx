"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AI_LAYOUT_IDS, MANUAL_LAYOUT_IDS, type LayoutId, type Slide } from "@/lib/slides/schema";
import type { BrandTheme } from "@/lib/slides/brand";
import { renderSlide, LAYOUTS } from "@/lib/slides/layouts";
import { defaultContent } from "@/lib/slides/defaults";
import { A4_PX } from "@/lib/slides/pages/a4";
import { PAGE_PRESETS, presetStack } from "@/lib/slides/pages/presets";
import SlideFrame from "./SlideFrame";
import type { DeckAction } from "@/lib/slides/state";

const PICKER_LAYOUT_IDS = [...AI_LAYOUT_IDS, ...MANUAL_LAYOUT_IDS];

/**
 * The picker modal, in the register of ChatGPT's "Add from library": the
 * title and the close button on one row, a hairline, then a three-column grid
 * of rounded cards with no captions (the name is the tooltip). Both pickers (slide
 * layouts, A4 page presets) are this one component with different items.
 */
function PickerModal({
  title,
  items,
  onPick,
  onClose,
}: {
  title: string;
  items: { id: string; label: string; html: string; size?: { w: number; h: number }; aspect: string }[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-scrim" />
      <div
        className="pop-in relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline-light px-7 py-5">
          <h2 className="text-xl font-medium text-ink">{title}</h2>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-mist"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* The preview is the whole card: no caption, the name is the tooltip. */}
        <div className="grid flex-1 grid-cols-3 gap-6 overflow-y-auto p-7">
          {items.map(({ id, label, html, size, aspect }) => (
            <button
              key={id}
              onClick={() => onPick(id)}
              title={label}
              aria-label={label}
              className="group block w-full rounded-2xl text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
            >
              {/* A <button> is not a block container: a percentage-width child
                  shrinks to fit and aspect-ratio has nothing to work from, so
                  the preview sits in a plain div. */}
              <div className="pointer-events-none overflow-hidden rounded-2xl shadow-stripe transition-shadow duration-150 group-hover:shadow-float">
                <SlideFrame html={html} size={size} className={`${aspect} w-full`} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayoutPickerModal({
  theme,
  onPick,
  onClose,
}: {
  theme: BrandTheme;
  onPick: (layoutId: LayoutId) => void;
  onClose: () => void;
}) {
  const items = useMemo(
    () =>
      PICKER_LAYOUT_IDS.map((id) => ({
        id,
        label: LAYOUTS[id].label,
        html: renderSlide({ ...defaultContent(id), id: `preview-${id}` }, theme),
        aspect: "aspect-video",
      })),
    [theme],
  );
  return (
    <PickerModal
      title="Add a slide"
      items={items}
      onPick={(id) => onPick(id as LayoutId)}
      onClose={onClose}
    />
  );
}

/**
 * "Add page" for two-pagers: the presets, rendered live. A preset is a
 * starting composition, not a layout: every block in it can be moved,
 * removed or added to afterwards.
 */
function PagePresetModal({
  theme,
  onPick,
  onClose,
}: {
  theme: BrandTheme;
  onPick: (presetId: string) => void;
  onClose: () => void;
}) {
  const items = useMemo(
    () =>
      PAGE_PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        html: renderSlide(
          { id: `preview-${preset.id}`, layoutId: "a4-page", stack: presetStack(preset.id) },
          theme,
          { index: 0, total: 1 },
        ),
        size: A4_PX,
        aspect: "aspect-[595/842]",
      })),
    [theme],
  );
  return (
    <PickerModal
      title="Add a page"
      items={items}
      onPick={onPick}
      onClose={onClose}
    />
  );
}

interface ThumbStripProps {
  slides: Slide[];
  theme: BrandTheme;
  activeIndex: number;
  dispatch: (action: DeckAction) => void;
  onInsertLayout: (layoutId: LayoutId) => void;
  /** Two-pager decks add pages from presets and are A4-shaped. */
  twoPager?: boolean;
  onInsertPage?: (presetId: string) => void;
}

export default function ThumbStrip({
  slides,
  theme,
  activeIndex,
  dispatch,
  onInsertLayout,
  twoPager = false,
  onInsertPage,
}: ThumbStripProps) {
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Insertion point: "insert before slide index j" (0..slides.length). */
  const [dropAt, setDropAtState] = useState<number | null>(null);
  // Refs mirror the state for the drag handlers: drag events can fire faster
  // than React re-renders, so the logic never reads async state.
  const dragIndexRef = useRef<number | null>(null);
  const dropAtRef = useRef<number | null>(null);

  const setDropAt = (value: number | null) => {
    dropAtRef.current = value;
    setDropAtState(value);
  };

  const endDrag = () => {
    setDragIndex(null);
    setDropAt(null);
    dragIndexRef.current = null;
  };

  const handleDrop = () => {
    const from = dragIndexRef.current;
    const at = dropAtRef.current;
    if (from == null || at == null) return endDrag();
    const to = from < at ? at - 1 : at;
    if (to !== from) dispatch({ type: "MOVE", from, to });
    endDrag();
  };

  return (
    <div
      className="flex h-full flex-col gap-2 overflow-y-auto p-3"
      onDragOver={(e) => {
        // Allow dropping in the empty space after the last thumbnail
        if (dragIndexRef.current != null) {
          e.preventDefault();
          if (e.target === e.currentTarget) setDropAt(slides.length);
        }
      }}
      onDrop={handleDrop}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          draggable
          onDragStart={(e) => {
            setDragIndex(i);
            dragIndexRef.current = i;
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={endDrag}
          onDragOver={(e) => {
            if (dragIndexRef.current == null) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            setDropAt(before ? i : i + 1);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDrop();
          }}
          className={`group relative shrink-0 cursor-grab overflow-hidden rounded-lg border transition-colors duration-150 active:cursor-grabbing ${
            i === activeIndex ? "border-ink" : "border-hairline hover:border-ink/30"
          } ${dragIndex === i ? "opacity-40" : ""} ${
            dropAt === i ? "border-t-4 !border-t-giga" : ""
          } ${dropAt === i + 1 && i === slides.length - 1 ? "border-b-4 !border-b-giga" : ""}`}
          onClick={() => dispatch({ type: "SET_ACTIVE", index: i })}
        >
          <div className="pointer-events-none">
            <SlideFrame
              html={renderSlide(slide, theme, { index: i, total: slides.length })}
              size={twoPager ? A4_PX : undefined}
              className={`${twoPager ? "aspect-[595/842]" : "aspect-video"} w-full`}
            />
          </div>
          <div className="absolute left-1 top-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-ink shadow-stripe">
            {i + 1} · {LAYOUTS[slide.layoutId]?.label ?? slide.layoutId}
          </div>
          <div className="absolute bottom-1 right-1 hidden gap-1 group-hover:flex">
            <ThumbButton
              label="⧉"
              title="Duplicate"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "DUPLICATE", index: i });
              }}
            />
            <ThumbButton
              label="✕"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "DELETE", index: i });
              }}
            />
          </div>
        </div>
      ))}

      {/* New-slide tile: opens the layout picker modal */}
      <button
        onClick={() => setLayoutsOpen(true)}
        title={twoPager ? "Add a page" : "Insert a slide layout"}
        className={`flex ${twoPager ? "aspect-[595/842]" : "aspect-video"} w-full shrink-0 items-center justify-center rounded-lg border border-dashed text-ink-muted transition-colors duration-150 ${
          layoutsOpen
            ? "border-ink/30 bg-mist text-ink"
            : "border-hairline hover:border-ink/30 hover:bg-mist hover:text-ink"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {layoutsOpen && twoPager && (
        <PagePresetModal
          theme={theme}
          onPick={(id) => {
            onInsertPage?.(id);
            setLayoutsOpen(false);
          }}
          onClose={() => setLayoutsOpen(false)}
        />
      )}
      {layoutsOpen && !twoPager && (
        <LayoutPickerModal
          theme={theme}
          onPick={(id) => {
            onInsertLayout(id);
            setLayoutsOpen(false);
          }}
          onClose={() => setLayoutsOpen(false)}
        />
      )}
    </div>
  );
}

function ThumbButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-medium text-ink shadow-stripe transition-colors duration-150 hover:bg-ink hover:text-white"
    >
      {label}
    </button>
  );
}
