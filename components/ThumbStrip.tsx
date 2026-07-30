"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AI_LAYOUT_IDS, MANUAL_LAYOUT_IDS, type LayoutId, type Slide } from "@/lib/slides/schema";
import type { BrandTheme } from "@/lib/slides/brand";
import { renderSlide, LAYOUTS } from "@/lib/slides/layouts";
import { defaultContent } from "@/lib/slides/defaults";
import SlideFrame from "./SlideFrame";
import type { DeckAction } from "@/lib/slides/state";

const PICKER_LAYOUT_IDS = [...AI_LAYOUT_IDS, ...MANUAL_LAYOUT_IDS];

/**
 * Full-screen layout picker: every template rendered as a live preview with
 * the active brand theme. Click inserts after the current slide.
 */
function LayoutPickerModal({
  theme,
  onPick,
  onClose,
}: {
  theme: BrandTheme;
  onPick: (layoutId: LayoutId) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const previews = useMemo(
    () =>
      PICKER_LAYOUT_IDS.map((id) => ({
        id,
        html: renderSlide({ ...defaultContent(id), id: `preview-${id}` }, theme),
      })),
    [theme],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/45" />
      <div
        className="pop-in relative flex max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 className="font-manrope text-lg font-semibold tracking-[-0.02em] text-ink">
              Choose a layout
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Inserted after the current slide, prefilled with placeholder copy.
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-giga-tint hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid flex-1 grid-cols-4 gap-4 overflow-y-auto p-6">
          {previews.map(({ id, html }) => (
            <button key={id} onClick={() => onPick(id)} className="group text-left">
              <div className="pointer-events-none overflow-hidden rounded-lg border-2 border-hairline transition-colors duration-150 group-hover:border-giga">
                <SlideFrame html={html} className="aspect-video w-full" />
              </div>
              <div className="mt-1.5 text-[11px] font-semibold text-ink group-hover:text-giga">
                {LAYOUTS[id].label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ThumbStripProps {
  slides: Slide[];
  theme: BrandTheme;
  activeIndex: number;
  dispatch: (action: DeckAction) => void;
  onInsertLayout: (layoutId: LayoutId) => void;
}

export default function ThumbStrip({ slides, theme, activeIndex, dispatch, onInsertLayout }: ThumbStripProps) {
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
          className={`group relative shrink-0 cursor-grab overflow-hidden rounded-lg border-2 transition-colors duration-150 active:cursor-grabbing ${
            i === activeIndex ? "border-giga" : "border-hairline hover:border-giga-100"
          } ${dragIndex === i ? "opacity-40" : ""} ${
            dropAt === i ? "border-t-4 !border-t-giga" : ""
          } ${dropAt === i + 1 && i === slides.length - 1 ? "border-b-4 !border-b-giga" : ""}`}
          onClick={() => dispatch({ type: "SET_ACTIVE", index: i })}
        >
          <div className="pointer-events-none">
            <SlideFrame html={renderSlide(slide, theme)} className="aspect-video w-full" />
          </div>
          <div className="absolute left-1 top-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-stripe">
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
        title="Insert a slide layout"
        className={`flex aspect-video w-full shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-giga transition-all duration-150 ${
          layoutsOpen
            ? "border-giga bg-giga/15"
            : "border-giga/50 bg-giga/5 hover:border-giga hover:bg-giga/15 hover:shadow-stripe"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {layoutsOpen && (
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
      className="rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink shadow-stripe transition-colors duration-150 hover:bg-giga hover:text-white"
    >
      {label}
    </button>
  );
}
