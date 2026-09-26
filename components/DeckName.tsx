"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_DECK_NAME } from "@/lib/slides/state";

/**
 * The deck's name, on the left of the toolbar. It is the file name every
 * download takes, so it reads as a title and edits in place: click to type,
 * Enter or blur saves, Escape puts the old name back. An empty name saves as
 * the default, because a file has to be called something.
 */
export default function DeckName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    onRename(draft.trim() || DEFAULT_DECK_NAME);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="Deck name"
        maxLength={80}
        className="h-9 min-w-0 max-w-[320px] rounded-lg border border-hairline bg-surface px-2.5 text-base font-medium text-ink outline-none focus:border-giga focus:ring-[3px] focus:ring-giga/15"
      />
    );
  }
  return (
    // The pencil says the name is editable and that it names the deck (Mario,
    // 26 Sep 2026): Faint Ink at rest, Ink on hover, like every quiet control.
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename the deck (this is the download file name)"
      aria-label={`Deck name: ${name}. Rename`}
      className="group flex h-9 min-w-0 max-w-[340px] items-center gap-2 rounded-lg px-2.5 text-base font-medium text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
    >
      <span className="truncate">{name}</span>
      <Pencil size={14} className="shrink-0 text-ink-faint transition-colors group-hover:text-ink" aria-hidden />
    </button>
  );
}
