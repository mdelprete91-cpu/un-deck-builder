"use client";

import { useEffect } from "react";
import Button from "@/components/Button";

/**
 * Leaving a translated language with texts changed by hand in it (Mario,
 * 6 Oct 2026: a blocking dialog, only when another language is picked).
 * Keep the changes, and they come back with the language; or use the
 * translation, and the texts go back to it before the switch. Esc keeps,
 * so the question never costs an edit.
 */
export default function EditChoice({
  language,
  target,
  edits,
  onKeep,
  onRevert,
  onCancel,
}: {
  /** The language being left, by name ("Español"). */
  language: string;
  /** The language picked. */
  target: string;
  edits: { text: string; translation: string }[];
  onKeep: () => void;
  onRevert: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const n = edits.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6">
      <div role="alertdialog" aria-labelledby="edit-choice-title" className="pop-in w-full max-w-md rounded-2xl bg-surface p-5 shadow-stripe-lg">
        <h2 id="edit-choice-title" className="text-base font-medium text-ink">
          Keep your changes in {language}?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          You changed {n === 1 ? "a text" : `${n} texts`} in {language}. Keep {n === 1 ? "it" : "them"} for the next time you switch back to {language}, or go back to the translation.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {edits.slice(0, 3).map((e, i) => (
            <li key={i} className="rounded-lg bg-mist px-3 py-2 text-[13px] leading-snug">
              <span className="line-clamp-2 text-ink">{e.text}</span>
              <span className="mt-0.5 line-clamp-1 text-ink-faint line-through">{e.translation}</span>
            </li>
          ))}
          {n > 3 && <li className="text-xs text-ink-muted">and {n - 3} more</li>}
        </ul>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onRevert}>
            Use the translation
          </Button>
          <Button variant="primary" onClick={onKeep} autoFocus>
            Keep my changes
          </Button>
        </div>
        <p className="mt-2 text-right text-xs text-ink-faint">Then switching to {target}</p>
      </div>
    </div>
  );
}
