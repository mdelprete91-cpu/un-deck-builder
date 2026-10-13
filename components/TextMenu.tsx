"use client";

import { BadgeCheck, ExternalLink, FileSearch, PenLine, Undo2 } from "lucide-react";
import { useEffect } from "react";
import type { TextSource } from "@/lib/slides/attribution";

/**
 * The right click on a text (Mario, 13 Oct 2026): where it comes from, by
 * name ("Attached file · report.docx", "Knowledge base · giga.global · How
 * credits work"), with its date and the passage, then "Add a source name or
 * footnote", which opens SourceModal.tsx: the source's name or the footnote,
 * on the slide or not, and for a figure the editor's check. UNICEF must not
 * say anything wrong, and a figure should be traceable to where it came
 * from. Placed at the click, in the same card as LogoMenu.tsx.
 */
/** What kind of place the source is, said before its name. */
const KIND: Record<NonNullable<TextSource["kind"]>, string> = {
  brief: "Your brief",
  answers: "Your answers",
  file: "Attached file",
  page: "Linked page",
  kb: "Knowledge base",
  facts: "Giga facts",
  replica: "The file you replicated",
};

export default function TextMenu({
  x,
  y,
  source,
  recorded,
  onAddSource,
  onUnverify,
  onClose,
}: {
  x: number;
  y: number;
  /** The text's source; undefined for a text the builder did not write (or a deck from before sources). */
  source?: TextSource;
  /** The deck carries sources at all: "not recorded" is said only for decks from before them. */
  recorded: boolean;
  onAddSource: () => void;
  onUnverify: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const W = 304;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1600;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const left = Math.max(8, Math.min(x, vw - W - 8));
  const top = Math.max(8, Math.min(y + 8, vh - 340));
  const row = "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist";
  const known = source && source.match !== "none" && source.label;
  const when = (d?: string) =>
    d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  // "Attached file · report.docx", "Knowledge base · giga.global · How credits work", "Your brief".
  const name = (s: TextSource) => {
    const own = s.kind === "brief" || s.kind === "answers" || s.kind === "replica";
    if (own) return KIND[s.kind!];
    return [s.kind ? KIND[s.kind] : "", s.label, s.kind === "kb" ? s.title : ""].filter(Boolean).join(" · ");
  };

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
              <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-giga">
                    {name(source)}
                    <ExternalLink size={12} className="ml-1 inline align-[-1px]" aria-hidden />
                  </a>
                ) : (
                  name(source)
                )}
                {source.date && (
                  <span className="font-normal text-ink-muted">
                    {" · "}
                    {source.kind === "kb" || source.kind === "page" ? "read " : source.kind === "facts" ? "checked " : ""}
                    {when(source.date)}
                  </span>
                )}
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
          <button role="menuitem" onClick={onAddSource} className={row}>
            <PenLine size={16} className="shrink-0 text-giga" aria-hidden />
            Add a source name or footnote…
          </button>
          {source?.verified && (
            <button role="menuitem" onClick={onUnverify} className={row}>
              <Undo2 size={16} className="shrink-0 text-ink-muted" aria-hidden />
              Remove the verification
            </button>
          )}
        </div>
      </div>
    </>
  );
}
