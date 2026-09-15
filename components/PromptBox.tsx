"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ATTACHMENT_ACCEPT, type Attachment } from "@/lib/slides/attachments";
import AttachmentsRow from "@/components/AttachmentsRow";

/**
 * The brief composer: one rounded surface that holds everything a Generate
 * press sends. Text on top, attachment chips under it, and a bottom bar with
 * the "+" for files on the left and the two things that shape the output on
 * the right: the Chapters toggle and Generate itself.
 *
 * The chat-composer shape is deliberate. Users know it, and it makes the rule
 * that matters here visible: Chapters is an input to the same press, not a
 * view option, so it sits next to the button that sends it.
 */

const MAX_HEIGHT = 280;

export default function PromptBox({
  brief,
  onBrief,
  chapters,
  onChapters,
  attachments,
  onAttach,
  onRemoveAttachment,
  onGenerate,
  generating,
  hasSlides,
}: {
  brief: string;
  onBrief: (brief: string) => void;
  chapters: boolean;
  onChapters: (next: boolean) => void;
  attachments: Attachment[];
  onAttach: (files: File[]) => Promise<void> | void;
  onRemoveAttachment: (id: string) => void;
  onGenerate: () => void;
  generating: boolean;
  hasSlides: boolean;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const canSend = !generating && (brief.trim().length > 0 || attachments.length > 0);

  // Grows with the text, like a chat composer, up to a ceiling that leaves
  // the rest of the sidebar reachable. Past it the textarea scrolls.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [brief]);

  const pickFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setReading(true);
    try {
      await onAttach(files);
    } finally {
      setReading(false);
    }
  };

  const active = dragging
    ? "border-hairline shadow-stripe-lg"
    : "border-hairline-light focus-within:border-hairline focus-within:shadow-stripe-lg";

  return (
    <div>
      {/* Files dropped on the box become attachments; stopPropagation keeps
          them away from <main>, which would turn an image into a slide. */}
      <div
        data-tour="prompt"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          void pickFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={(e) => {
          // The whole surface is the input: a click on padding focuses the text.
          if (e.target === e.currentTarget) textRef.current?.focus();
        }}
        className={`rounded-[28px] border bg-white shadow-stripe transition-[box-shadow,border-color] duration-150 ${active}`}
      >
        <textarea
          ref={textRef}
          value={brief}
          onChange={(e) => onBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
              e.preventDefault();
              onGenerate();
            }
          }}
          placeholder="Describe the deck you need…"
          rows={3}
          className="block w-full resize-none rounded-t-[28px] bg-transparent px-4 pt-3.5 pb-1 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint"
        />

        {attachments.length > 0 && (
          <div className="px-3 pb-1">
            <AttachmentsRow
              attachments={attachments}
              disabled={generating}
              onRemove={onRemoveAttachment}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={generating || reading}
            aria-label={reading ? "Reading files" : "Attach files"}
            title="Attach a PDF, Word, PowerPoint, text file or image"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink transition-colors duration-150 hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 disabled:pointer-events-none disabled:opacity-40"
          >
            {reading ? (
              <Spinner />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void pickFiles(files);
            }}
          />

          <div className="flex items-center gap-1.5">
            {/* Chapters is a generation input: it shapes the next deck, never the
                one on screen. As a pressed pill next to Generate it reads as
                part of what the press sends. */}
            <button
              type="button"
              data-tour="chapters"
              role="switch"
              aria-checked={chapters}
              disabled={generating}
              onClick={() => onChapters(!chapters)}
              title={
                chapters
                  ? "Chapters on: agenda slide and section dividers"
                  : "Chapters off: the deck runs straight through"
              }
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 disabled:pointer-events-none disabled:opacity-40 ${
                chapters
                  ? "bg-giga-tint text-giga"
                  : "text-ink-muted hover:bg-mist hover:text-ink"
              }`}
            >
              {/* The glyph is the state: a ticked circle on, an empty one off. */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                {chapters && <path d="m8.5 12.5 2.5 2.5 5-5" />}
              </svg>
              Chapters
            </button>

            <button
              type="button"
              data-tour="generate"
              onClick={onGenerate}
              disabled={!canSend}
              aria-label={generating ? "Generating" : hasSlides ? "Regenerate deck" : "Generate deck"}
              title={hasSlides ? "Regenerate the deck (⌘↵)" : "Generate the deck (⌘↵)"}
              className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-giga text-sm font-medium text-white transition-all duration-150 hover:bg-giga-deep active:scale-[0.96] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 disabled:pointer-events-none disabled:opacity-40 w-9`}
            >
              {generating ? (
                <Spinner />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
