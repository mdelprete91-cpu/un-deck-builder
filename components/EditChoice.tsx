"use client";

import { useEffect } from "react";
import Button from "@/components/Button";

/**
 * After a text is changed in a translated language (Mario, 6 Oct 2026): keep
 * the change the next time this language comes back, or put the translation
 * back now. Keeping is the default, so ignoring the question never loses an
 * edit. Floats above the canvas's bottom bar, in the menu card.
 */
export default function EditChoice({
  language,
  onKeep,
  onRevert,
}: {
  /** The language by name ("Español"). */
  language: string;
  onKeep: () => void;
  onRevert: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep]);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[104px] z-30 flex justify-center px-6">
      <div role="status" className="float-in pointer-events-auto flex max-w-xl items-center gap-4 rounded-2xl bg-surface py-2.5 pl-4 pr-2.5 shadow-menu">
        <p className="text-sm leading-snug text-ink">
          You changed this text in {language}. Keep your version next time you switch back to {language}?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={onRevert} title="Put the translation back in this text">
            Use the translation
          </Button>
          <Button variant="primary" onClick={onKeep}>
            Keep my version
          </Button>
        </div>
      </div>
    </div>
  );
}
