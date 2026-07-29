"use client";

import { useRef, useState } from "react";
import { AI_LAYOUT_IDS, MANUAL_LAYOUT_IDS, type LayoutId, type Slide } from "@/lib/slides/schema";
import type { BrandTheme } from "@/lib/slides/brand";
import { renderSlide, LAYOUTS } from "@/lib/slides/layouts";
import SlideFrame from "./SlideFrame";
import type { DeckAction } from "@/lib/slides/state";

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

      {/* New-slide tile: expands into the layout list inline (no clipping in the scroll area) */}
      <div className="shrink-0">
        <button
          onClick={() => setLayoutsOpen((v) => !v)}
          title="Insert a slide layout"
          className={`flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-150 ${
            layoutsOpen
              ? "border-giga bg-giga-tint text-giga"
              : "border-hairline text-ink-muted hover:border-giga-100 hover:bg-giga-tint hover:text-giga"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {layoutsOpen && (
          <div className="pop-in mt-1.5 overflow-hidden rounded-lg border border-hairline bg-white py-1 shadow-stripe">
            {[...AI_LAYOUT_IDS, ...MANUAL_LAYOUT_IDS].map((id) => (
              <button
                key={id}
                onClick={() => {
                  onInsertLayout(id);
                  setLayoutsOpen(false);
                }}
                className="block w-full px-2.5 py-1.5 text-left text-[11px] text-ink transition-colors duration-100 hover:bg-giga-tint"
              >
                {LAYOUTS[id].label}
              </button>
            ))}
          </div>
        )}
      </div>
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
