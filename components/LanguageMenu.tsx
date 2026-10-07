"use client";

import { Check, ChevronDown, Languages, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { LANG_LABELS, LANG_NAMES, LANGS, type Lang } from "@/lib/slides/i18n";

/**
 * The deck's language, in the toolbar (Mario, 6 Oct 2026): the whole piece
 * switches, never one slide. Thirty-one languages, so the Download menu's
 * card gets a search field on top and a scrolling list: each language by its
 * own name with the English one beside it, a tick on the one on screen and
 * "original" on the one the deck was written in, which comes first. Texts
 * changed by hand are asked about when leaving a language (EditChoice).
 */
export default function LanguageMenu({
  current,
  source,
  busy,
  onSwitch,
}: {
  current: Lang;
  source: Lang;
  busy: boolean;
  onSwitch: (to: Lang) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  // The original first, then the rest by number of speakers.
  const ordered: Lang[] = [source, ...LANGS.filter((l) => l !== source)];
  const q = query.trim().toLowerCase();
  const shown = q ? ordered.filter((l) => `${LANG_LABELS[l]} ${LANG_NAMES[l]} ${l}`.toLowerCase().includes(q)) : ordered;
  const pick = (l: Lang) => {
    close();
    if (l !== current) onSwitch(l);
  };

  return (
    <div className="relative">
      <Button
        variant="secondary"
        icon={Languages}
        iconRight={ChevronDown}
        onClick={() => (open ? close() : setOpen(true))}
        disabled={busy}
        title="Language of the whole deck"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {current.toUpperCase()}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div role="menu" className="pop-in absolute right-0 z-20 mt-1.5 flex w-72 flex-col rounded-2xl bg-surface p-1.5 shadow-menu">
            <label className="mb-1 flex h-9 items-center gap-2 rounded-[10px] bg-mist px-2.5">
              <Search size={14} className="shrink-0 text-ink-muted" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && shown[0]) pick(shown[0]);
                }}
                placeholder="Search languages"
                aria-label="Search languages"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </label>
            <div className="max-h-80 overflow-y-auto">
              {shown.map((l) => (
                <button
                  key={l}
                  role="menuitemradio"
                  aria-checked={l === current}
                  onClick={() => pick(l)}
                  className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist"
                >
                  <span className="min-w-0 truncate">
                    {LANG_LABELS[l]}
                    {LANG_LABELS[l] !== LANG_NAMES[l] && <span className="ml-1.5 text-xs text-ink-muted">{LANG_NAMES[l]}</span>}
                    {l === source && <span className="ml-1.5 text-xs font-semibold text-giga">· original</span>}
                  </span>
                  {l === current && <Check size={16} className="shrink-0 text-ink" aria-hidden />}
                </button>
              ))}
              {shown.length === 0 && <p className="px-2.5 py-2 text-sm text-ink-muted">No language matches</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
