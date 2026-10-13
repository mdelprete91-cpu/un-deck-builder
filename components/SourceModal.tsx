"use client";

import { BadgeCheck, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import Switch from "@/components/Switch";

const INPUT =
  "block w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15";

/**
 * "Add a source name or footnote" (Mario, 13 Oct 2026: a dialog rather than
 * a field in the menu, since the text can be long). One text, written once:
 * the source's name or the footnote's words, filled in with the source the
 * builder found. It can go on the slide as a footnote, and, for a figure,
 * the editor can certify it: UNICEF must not say anything wrong, and a
 * figure in a deck should be traceable to where it came from. Same box as
 * the questions dialog (SheetWizard.tsx): 576px, the scrim, Esc closes.
 */
export default function SourceModal({
  quoted,
  initial,
  canFootnote,
  hasFigure,
  verified,
  onSave,
  onClose,
}: {
  /** The text the source is for, shown at the top. */
  quoted: string;
  /** The source the builder found, or the one given before. */
  initial: string;
  /** A slide with a footnote row: a page or a cover has none. */
  canFootnote: boolean;
  hasFigure: boolean;
  /** Already verified: the box starts ticked. */
  verified: boolean;
  onSave: (r: { text: string; footnote: boolean; verified: boolean }) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const [footnote, setFootnote] = useState(canFootnote);
  // A person writing a source of their own is usually certifying the figure.
  const [check, setCheck] = useState(verified);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const canSave = (footnote && canFootnote) || check || text.trim() !== initial.trim();
  const save = () => {
    if (canSave) onSave({ text: text.trim(), footnote: footnote && canFootnote, verified: hasFigure && check });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="source-modal-title"
        className="pop-in flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <h2 id="source-modal-title" className="text-xl font-medium text-ink">
            Source name or footnote
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>
        <div className="min-h-0 overflow-y-auto px-6 pb-2 pt-3">
          <p className="line-clamp-2 text-[13px] italic text-ink-muted" data-hj-suppress>
            “{quoted}”
          </p>
          <textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!touched && hasFigure && e.target.value.trim()) setCheck(true);
              setTouched(true);
            }}
            placeholder="Where this comes from: a report, a link, a dataset, a person. Or the footnote's words."
            className={`${INPUT} mt-3 resize-y`}
            data-hj-suppress
          />
          <div className="mt-3 flex flex-col gap-1">
            {canFootnote && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">
                  Show it as a footnote on the slide
                  <span className="block text-[13px] text-ink-muted">A number after the text, the words in the slide&apos;s footer.</span>
                </span>
                <Switch checked={footnote} onChange={setFootnote} label="" title="Show it as a footnote" />
              </div>
            )}
            {hasFigure && (
              <button
                type="button"
                role="checkbox"
                aria-checked={check}
                onClick={() => setCheck((v) => !v)}
                className={`mt-1 flex items-start gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                  check ? "bg-giga-tint text-giga" : "text-ink hover:bg-mist"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-100 ${
                    check ? "border-giga bg-giga text-white" : "border-mist-deep bg-surface"
                  }`}
                >
                  {check && <Check size={11} strokeWidth={3} aria-hidden />}
                </span>
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <BadgeCheck size={15} aria-hidden />
                    I checked this figure: mark it as verified
                  </span>
                  <span className={`mt-0.5 block text-[13px] ${check ? "text-giga/80" : "text-ink-muted"}`}>
                    {text.trim() ? "With the source above." : "With no source given."}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
