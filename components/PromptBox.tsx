"use client";

import { ArrowUp, Circle, CircleCheck, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ATTACHMENT_ACCEPT, type Attachment } from "@/lib/slides/attachments";
import AttachmentsRow from "@/components/AttachmentsRow";
import Button from "@/components/Button";

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

  // The "+" introduces itself: on an empty editor the pill widens to say
  // "Attach" for two seconds, then folds back to the icon. Hover reopens it,
  // so the affordance stays discoverable after the hint is gone.
  const [hint, setHint] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hasSlides || attachments.length > 0) return;
    const show = setTimeout(() => setHint(true), 500);
    const hide = setTimeout(() => setHint(false), 2500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // Once, when the composer mounts on an empty editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const labelOpen = (hint || hover) && !generating && !reading;

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
          <Button
            variant="secondary"
            iconOnly
            icon={Plus}
            onClick={() => fileRef.current?.click()}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            disabled={generating || reading}
            aria-label={reading ? "Reading files" : "Attach files"}
            title="Attach a PDF, Word, PowerPoint, text file or image"
          >
            {/* The label's width animates through a grid track, never through
                `width`; folded, the track is 0 and the pill is the 36px square.
                The -6px cancels the Button gap while folded. */}
            <span
              aria-hidden={!labelOpen}
              className="-ml-1.5 grid transition-[grid-template-columns] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ gridTemplateColumns: labelOpen ? "1fr" : "0fr" }}
            >
              <span className="min-w-0 overflow-hidden whitespace-nowrap">
                <span className="block pl-3">Attach</span>
              </span>
            </span>
          </Button>
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
            {/* The glyph is the state: a ticked circle on, an empty one off. */}
            <Button
              variant={chapters ? "accent" : "ghost"}
              icon={chapters ? CircleCheck : Circle}
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
            >
              Chapters
            </Button>

            <Button
              variant="primary"
              iconOnly
              icon={generating ? LoaderCircle : ArrowUp}
              iconClassName={generating ? "animate-spin" : undefined}
              data-tour="generate"
              onClick={onGenerate}
              disabled={!canSend}
              aria-label={generating ? "Generating" : hasSlides ? "Regenerate deck" : "Generate deck"}
              title={hasSlides ? "Regenerate the deck (⌘↵)" : "Generate the deck (⌘↵)"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

