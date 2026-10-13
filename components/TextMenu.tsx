"use client";

import { BadgeCheck, ExternalLink, FileSearch, Superscript, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { citation, type TextSource } from "@/lib/slides/attribution";

/**
 * The right click on a text (Mario, 13 Oct 2026): where it comes from (the
 * site, the file or the brief, with its date and the passage), a footnote
 * citing that source, and, for a text with a figure, the editor's check:
 * "Mark as verified", with a source of their own or none. UNICEF must not
 * say anything wrong, and a figure the builder wrote should be traceable to
 * where it came from and certified by a person. Placed at the click, in the
 * same card as the programme-logo menu (LogoMenu.tsx).
 */
export default function TextMenu({
  x,
  y,
  source,
  recorded,
  hasFigure,
  canFootnote,
  onFootnote,
  onVerify,
  onUnverify,
  onClose,
}: {
  x: number;
  y: number;
  /** The text's source; undefined for a text the builder did not write (or a deck from before sources). */
  source?: TextSource;
  /** The deck carries sources at all: "not recorded" is said only for decks from before them. */
  recorded: boolean;
  hasFigure: boolean;
  /** A slide with a footnote row (not a page, not a cover or a closing). */
  canFootnote: boolean;
  onFootnote: (note: string) => void;
  onVerify: (source?: string) => void;
  onUnverify: () => void;
  onClose: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [given, setGiven] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (verifying) inputRef.current?.focus();
  }, [verifying]);

  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const W = 304;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1600;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const left = Math.max(8, Math.min(x, vw - W - 8));
  const top = Math.max(8, Math.min(y + 8, vh - 380));
  const row = "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist";
  const known = source && source.match !== "none" && source.label;
  const when = (d?: string) =>
    d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  // The footnote cites what the editor gave, else the source found.
  const note = source?.verified?.source || (known ? citation(source!) : "");

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())} />
      <div role="menu" aria-label="This text" className="pop-in fixed z-50 rounded-2xl bg-surface p-1.5 shadow-menu" style={{ left, top, width: W }}>
        <div className="px-2.5 pb-2 pt-1.5">
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <FileSearch size={13} aria-hidden />
            Where this comes from
          </p>
          {known ? (
            <>
              <p className="mt-1.5 text-sm font-medium text-ink">
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-giga">
                    {cap(source.label)}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                ) : (
                  cap(source.label)
                )}
                {source.date && <span className="font-normal text-ink-muted"> · {when(source.date)}</span>}
              </p>
              {source.quote && (
                <p className="mt-1 line-clamp-4 text-[13px] italic leading-snug text-ink-muted" data-hj-suppress>
                  “{source.quote}”
                </p>
              )}
              <p className="mt-1.5 text-xs text-ink-faint">
                {/* After an edit the words are the user's: the source is where they started, no longer a match. */}
                {source.edited ? "Generated from this source, edited by you since" : source.match === "high" ? "Matches the source" : "Close to the source, in other words"}
              </p>
            </>
          ) : source ? (
            <p className="mt-1.5 text-[13px] leading-snug text-ink-muted">
              {source.label ? `Nothing close in the text we can read; it may come from ${source.label}.` : "No source found: the builder wrote it from the brief."}
              {source.edited ? " Edited by you since." : ""}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] leading-snug text-ink-muted">{recorded ? "Written by you, or added after the deck was made." : "Sources were not recorded for this deck."}</p>
          )}
          {source?.verified && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-giga">
              <BadgeCheck size={15} className="mt-px shrink-0" aria-hidden />
              <span>
                Verified on {when(source.verified.at)}
                {source.verified.source ? `, source: ${source.verified.source}` : ", no source given"}
              </span>
            </p>
          )}
        </div>
        <div className="mx-1 h-px bg-hairline" />
        <div className="pt-1">
          {hasFigure &&
            (source?.verified ? (
              <button role="menuitem" onClick={onUnverify} className={row}>
                <Undo2 size={16} className="shrink-0 text-ink-muted" aria-hidden />
                Remove the verification
              </button>
            ) : verifying ? (
              // The check: a source of the editor's own, or none (Mario: "you can add a source or not").
              <form
                className="px-2.5 pb-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  onVerify(given.trim() || undefined);
                }}
              >
                <label className="text-xs text-ink-muted" htmlFor="verify-source">
                  Source for this figure (optional)
                </label>
                <input
                  id="verify-source"
                  ref={inputRef}
                  value={given}
                  onChange={(e) => setGiven(e.target.value)}
                  placeholder={known ? citation(source!) : "A link, a report, a person"}
                  className="mt-1 block h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
                />
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => onVerify(known && !given.trim() ? citation(source!) : undefined)} className="rounded-full px-3 py-1.5 text-[13px] text-ink-muted transition-colors duration-100 hover:bg-mist hover:text-ink">
                    {known && !given.trim() ? "Use the source above" : "Without a source"}
                  </button>
                  <button type="submit" disabled={!given.trim()} className="inline-flex items-center gap-1 rounded-full bg-giga px-3 py-1.5 text-[13px] font-medium text-white transition-opacity duration-100 disabled:opacity-40">
                    <BadgeCheck size={14} aria-hidden />
                    Verify
                  </button>
                </div>
              </form>
            ) : (
              <button role="menuitem" onClick={() => setVerifying(true)} className={row}>
                <BadgeCheck size={16} className="shrink-0 text-giga" aria-hidden />
                Mark as verified…
              </button>
            ))}
          {canFootnote && !verifying && (
            <button role="menuitem" onClick={() => onFootnote(note)} className={row}>
              <Superscript size={16} className="shrink-0 text-ink-muted" aria-hidden />
              {note ? "Add a footnote with this source" : "Add a footnote for this text"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
