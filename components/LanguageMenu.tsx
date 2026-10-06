"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { LANG_LABELS, LANGS, type Lang } from "@/lib/slides/i18n";

/**
 * The deck's language, in the toolbar (Mario, 6 Oct 2026): the whole piece
 * switches, never one slide. The menu is the Download menu's card and only
 * the languages: a tick on the one on screen, "original" on the one the deck
 * was written in. The fixes Mario makes are kept without being shown
 * (lib/slides/i18n.ts): no glossary to manage, no retranslate button.
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // The source is offered even when it is not one of the four (a deck written in Italian).
  const langs: Lang[] = (LANGS as readonly Lang[]).includes(source) ? [...LANGS] : [source, ...LANGS];
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <Button
        variant="secondary"
        icon={Languages}
        iconRight={ChevronDown}
        onClick={() => setOpen((v) => !v)}
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
          <div role="menu" className="pop-in absolute right-0 z-20 mt-1.5 w-64 rounded-2xl bg-surface p-1.5 shadow-menu">
            {langs.map((l) => (
              <button
                key={l}
                role="menuitemradio"
                aria-checked={l === current}
                onClick={() => {
                  close();
                  if (l !== current) onSwitch(l);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist"
              >
                <span>
                  {LANG_LABELS[l]}
                  {l === source && <span className="ml-1.5 text-xs text-ink-muted">original</span>}
                </span>
                {l === current && <Check size={16} className="shrink-0 text-ink" aria-hidden />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
