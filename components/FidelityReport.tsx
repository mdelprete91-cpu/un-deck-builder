"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, ChevronUp, X } from "lucide-react";
import Button from "@/components/Button";
import { isExact, tokens, totals, type DeckFidelity, type Leftover, type Totals } from "@/lib/slides/fidelity";
import type { LayoutId, Slide } from "@/lib/slides/schema";
import { LAYOUTS } from "@/lib/slides/layouts";

/**
 * The fidelity report of a replica (lib/slides/fidelity.ts), inside the
 * generation readout: one percentage and "Review". The detail (figures
 * exact, words kept, what changed, what the app put back) is in the review, the source and the deck side by side, slide by slide, with "Go to
 * slide". Session state in page.tsx, cleared by the next generation.
 *
 * Colour follows DESIGN.md: what is kept in Ink, differences in Muted Ink
 * on a Mist mark, red only for a changed figure and a slide not rebuilt,
 * always with its words.
 */
export default function FidelityReport({
  report,
  slides,
  onGoTo,
}: {
  report: DeckFidelity;
  slides: Slide[];
  onGoTo: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = totals(report.slides, report.leftovers);
  const score = fidelityScore(t);
  return (
    <div className="mt-2.5 border-t border-hairline pt-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-ink-faint">Source fidelity</p>
        <p className="text-sm font-medium tabular-nums text-ink">{score}%</p>
      </div>
      <Button variant="secondary" className="mt-2.5 w-full" onClick={() => setOpen(true)}>
        Review
      </Button>
      {open && (
        <FidelityReview
          report={report}
          totals={t}
          slides={slides}
          onClose={() => setOpen(false)}
          onGoTo={(index) => {
            onGoTo(index);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * One number for the card: the weaker of figures exact and words kept, so a
 * changed figure is never hidden behind a lot of kept text. 100 only when
 * nothing changed, nothing is missing and every slide was rebuilt.
 */
function fidelityScore(t: Totals): number {
  if (isExact(t)) return 100;
  const score = Math.min(pct(t.figures.ok, t.figures.total), pct(t.words.kept, t.words.total));
  return Math.min(score, 99);
}

/** Rounded down, so 99.6% never reads as a clean 100%. */
function pct(part: number, whole: number): number {
  if (!whole) return 100;
  const p = Math.floor((part / whole) * 100);
  return part < whole ? Math.min(p, 99) : p;
}

type Diff =
  | { kind: "figure"; figure: string; source: string; deck: string }
  | { kind: "reworded" | "changed"; source: string; deck: string; figures: string[] }
  | { kind: "missing"; source: string; figures: string[] }
  | { kind: "added"; deck: string };

/** A normalised figure as people write it: "1274" is "1,274". */
const shown = (key: string) => (/^-?\d{4,}$/.test(key) ? Number(key).toLocaleString("en-US") : key);

const TAG: Record<Diff["kind"], string> = {
  figure: "Figure changed",
  reworded: "Reworded",
  changed: "Changed",
  missing: "Missing",
  added: "Added",
};

type Entry = DeckFidelity["slides"][number];

/** "Slide 7", "Slides 7–8", "Slides 7, 9"; "Pages 1–2" on a two-pager. */
function slideRange(at: number[], unit: "Slide" | "Page" = "Slide"): string {
  if (!at.length) return "Not in the deck";
  const sorted = [...at].sort((x, y) => x - y).map((i) => i + 1);
  const run = sorted.every((v, i) => !i || v === sorted[i - 1] + 1);
  if (sorted.length === 1) return `${unit} ${sorted[0]}`;
  return run ? `${unit}s ${sorted[0]}–${sorted[sorted.length - 1]}` : `${unit}s ${sorted.join(", ")}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Which fixed slide a structural source slide maps to, from its title, for the review's words. */
function structureName(title: string): string {
  if (/agenda|contents|sommario|índice|sommaire/i.test(title)) return "agenda";
  if (/thank|grazie|gracias|merci|obrigad|contact/i.test(title)) return "closing slide";
  return "chapter dividers";
}

/**
 * The review: a short summary of what the replica did to the source (how
 * many slides it became, what was split, what the app rebuilt, how much text
 * and how many figures are whole), then one row per source slide: where it
 * went, in which layout, what changed. The lines behind a change open on
 * demand, source and deck side by side.
 */
function FidelityReview({
  report,
  totals: t,
  slides,
  onClose,
  onGoTo,
}: {
  report: DeckFidelity;
  totals: Totals;
  slides: Slide[];
  onClose: () => void;
  onGoTo: (index: number) => void;
}) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The slide where it is now: its place when it landed, or found by its
  // title if the deck was reordered since.
  const locate = (s: Entry) =>
    slides[s.at]?.title === s.deckTitle && slides[s.at]?.layoutId === s.layoutId
      ? s.at
      : slides.findIndex((x) => x.layoutId === s.layoutId && x.title === s.deckTitle);

  const diffsOf = (s: Entry): Diff[] => {
    // A changed figure sits on its line's row; only a figure with no row of its own (a chart label) gets one.
    const on = (line: string) => s.figures.wrong.filter((w) => w.source === line).map((w) => shown(w.figure));
    const rows = new Set([...s.lines.changed, ...s.lines.touched].map((p) => p.source).concat(s.lines.missing));
    return [
      ...[...new Set(s.figures.wrong.filter((w) => !rows.has(w.source)).map((w) => w.source))].map((line): Diff => ({ kind: "figure", source: line, deck: "", figure: on(line).join(", ") })),
      ...s.lines.changed.map((p): Diff => ({ kind: "changed", source: p.source, deck: p.deck, figures: on(p.source) })),
      ...s.lines.touched.map((p): Diff => ({ kind: "reworded", source: p.source, deck: p.deck, figures: on(p.source) })),
      ...s.lines.missing.map((source): Diff => ({ kind: "missing", source, figures: on(source) })),
      ...s.added.map((deck): Diff => ({ kind: "added", deck })),
    ];
  };

  // One row per source slide, in source order.
  const byN = new Map<number, Entry[]>();
  for (const s of report.slides) byN.set(s.n, [...(byN.get(s.n) ?? []), s]);
  const lost = new Map<number, Leftover>();
  // Lines the plan leaves out of the agenda, divider and closing slides
  // count as missing in the summary, so they get a row too (Mario, 7 Oct
  // 2026: "5 missing, but I don't know what").
  for (const l of report.leftovers) if (l.reason === "failed" || l.reason === "ceiling" || l.reason === "structure") lost.set(l.n, l);
  const ns = [...new Set([...byN.keys(), ...lost.keys()])].sort((x, y) => x - y);

  const piece = report.piece;
  const rows = ns.map((n) => {
    const entries = byN.get(n) ?? [];
    const at: number[] = [];
    // A two-pager replica is one entry for the whole piece: all its pages.
    if (piece) for (let k = 0; k < slides.length; k++) at.push(k);
    else
      for (const e of entries) {
        const i = locate(e);
        if (i >= 0) for (let k = 0; k < (e.parts ?? 1); k++) at.push(i + k);
      }
    const layouts = piece ? [] : [...new Set(at.map((i) => slides[i]?.layoutId).filter(Boolean))].map((id) => LAYOUTS[id as LayoutId]?.label ?? id);
    const diffs = entries.flatMap(diffsOf);
    const wrong = entries.reduce((k, e) => k + e.figures.wrong.length, 0);
    const reworded = entries.reduce((k, e) => k + e.lines.touched.length + e.lines.changed.length, 0);
    const missing = entries.reduce((k, e) => k + e.lines.missing.length, 0);
    const added = entries.reduce((k, e) => k + e.added.length, 0);
    const putBack = entries.reduce((k, e) => k + (e.putBack ?? 0), 0);
    const notes: string[] = [];
    const left = lost.get(n);
    if (left?.reason === "structure") notes.push(`${plural(left.lines.length, "line")} left out of the deck's ${structureName(left.title)}`);
    else if (left) notes.push(left.reason === "ceiling" ? "past the 40-slide limit" : "could not be rebuilt");
    if (at.length > 1 && !piece) notes.push(`text split over ${at.length} slides`);
    if (entries.some((e) => e.rebuilt)) notes.push("rebuilt by the app in a simpler layout");
    else if (putBack) notes.push(`${plural(putBack, "line")} put back by the app`);
    if (wrong) notes.push(`${plural(wrong, "figure")} changed`);
    if (reworded) notes.push(`${plural(reworded, "line")} reworded`);
    if (missing) notes.push(`${missing} missing`);
    if (added) notes.push(`${added} added`);
    return {
      n,
      title: entries[0]?.title || left?.title || "",
      at,
      layouts,
      notes,
      diffs,
      lostLines: left?.lines ?? [],
      red: (!!left && left.reason !== "structure") || wrong > 0,
      structure: left?.reason === "structure",
    };
  });

  const noted = rows.filter((r) => r.notes.length > 0);
  const sourceCount = rows.filter((r) => !r.structure || r.at.length).length;
  const split = piece ? 0 : rows.filter((r) => r.at.length > 1).length;
  const rebuilt = report.slides.filter((s) => s.rebuilt).length;
  const notIn = rows.filter((r) => !r.at.length && !r.structure).length;
  const fromContent = rows.reduce((k, r) => k + r.at.length, 0);
  const summary: string[] = piece
    ? [`${plural(piece.sourcePages, "page")} of the source became a two-pager of ${plural(piece.pages, "A4 page")}, its text kept in the order it was written. The pages were set tighter where needed, never cut.`]
    : [
        `${plural(sourceCount, "content slide")} of the source became ${plural(fromContent, "slide")}. Cover, agenda and chapter dividers follow the source's structure.`,
      ];
  if (split) summary.push(`${plural(split, "source slide")} had more text than one layout holds, so the text continues on the next slide.`);
  if (rebuilt) summary.push(`${plural(rebuilt, "slide")} ${rebuilt === 1 ? "was" : "were"} rebuilt by the app from the source, in a simpler layout, because the model's version lost text.`);
  summary.push(
    isExact(t)
      ? `Every figure${t.figures.total ? ` (${t.figures.total})` : ""} and every line of the source is in the ${piece ? "two-pager" : "deck"}, word for word.`
      : `${t.figures.ok} / ${t.figures.total} figures exact, ${pct(t.words.kept, t.words.total)}% of the words kept${t.reworded || t.missing ? `: ${[t.reworded && plural(t.reworded, "line") + " reworded", t.missing && `${t.missing} missing`].filter(Boolean).join(", ")}` : ""}.`,
  );
  const structureLines = rows.filter((r) => r.structure).reduce((k, r) => k + r.lostLines.length, 0);
  if (structureLines)
    summary.push(`${plural(structureLines, "line")} of the source's agenda, chapter dividers or closing slide ${structureLines === 1 ? "is" : "are"} not in the deck, which has its own: they are listed below.`);
  if (notIn && !piece) summary.push(`${plural(notIn, "source slide")} ${notIn === 1 ? "is" : "are"} not in the deck.`);
  if (report.transcribed) summary.push("The source was read from page images: check the figures against the file.");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="fidelity-title"
        data-hj-suppress
        className="pop-in flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline-light px-7 py-5">
          <h2 id="fidelity-title" className="text-xl font-medium text-ink">
            Replica of the source · <span className="tabular-nums">{fidelityScore(t)}%</span>
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" autoFocus />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-ink-faint">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="mt-7 flex items-baseline justify-between gap-3 border-b border-hairline-light pb-2">
            <p className="text-sm font-medium text-ink">
              {piece ? (noted.length ? "What changed" : "Nothing changed") : all ? "Slide by slide" : noted.length ? "What changed, slide by slide" : "Nothing changed on any slide"}
            </p>
            {noted.length < rows.length && (
              <button type="button" className="text-[13px] text-ink-muted hover:text-ink" onClick={() => setAll(!all)}>
                {all ? "Only the changes" : `Show all ${rows.length} slides`}
              </button>
            )}
          </div>
          <ul>
            {(all ? rows : noted).map((r) => {
              const expandable = r.diffs.length > 0 || r.lostLines.length > 0;
              const open = openRow === r.n;
              return (
                <li key={r.n} className="border-b border-hairline-light last:border-b-0">
                  <div className="flex items-center gap-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        <span className="tabular-nums text-ink-faint">{r.n}.</span> {r.title || "Untitled"}
                      </p>
                      <p className="text-[13px] leading-relaxed text-ink-muted">
                        <span className={r.at.length || r.structure ? "" : "text-status-red"}>
                          {r.structure && !r.at.length ? "Agenda, divider or closing" : slideRange(r.at, piece ? "Page" : "Slide")}
                        </span>
                        {r.layouts.length > 0 && ` · ${r.layouts.join(", ")}`}
                        {r.notes.length > 0 ? (
                          <span className={r.red ? "text-status-red" : ""}> · {r.notes.join(", ")}</span>
                        ) : (
                          <span className="text-ink-faint"> · word for word</span>
                        )}
                      </p>
                    </div>
                    {expandable && (
                      <Button variant="ghost" icon={open ? ChevronUp : ChevronDown} onClick={() => setOpenRow(open ? null : r.n)} aria-expanded={open}>
                        Lines
                      </Button>
                    )}
                    {r.at.length > 0 && (
                      <Button variant="ghost" iconOnly icon={ArrowRight} onClick={() => onGoTo(Math.min(...r.at))} title={piece ? "Go to the first page" : "Go to slide"} aria-label={`Go to ${slideRange(r.at, piece ? "Page" : "Slide")}`} />
                    )}
                  </div>
                  {open && (
                    <div className="pb-3">
                      {r.diffs.length > 0 && (
                        <>
                          <div className="grid grid-cols-2 gap-x-6 text-[13px] text-ink-faint">
                            <span>Source</span>
                            <span>Deck</span>
                          </div>
                          <ul>
                            {r.diffs.map((d, k) => (
                              <DiffRow key={k} d={d} />
                            ))}
                          </ul>
                        </>
                      )}
                      {r.lostLines.length > 0 && (
                        <ul className="flex flex-col gap-1 text-sm leading-relaxed text-ink">
                          {r.lostLines.map((line, k) => (
                            <li key={k} className="break-words">
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DiffRow({ d }: { d: Diff }) {
  const source = "source" in d ? d.source : "";
  const deck = "deck" in d ? d.deck : "";
  return (
    <li className="border-b border-hairline-light py-3 last:border-b-0">
      <p className="mb-1 text-xs font-medium text-ink-muted">
        {d.kind === "figure" ? (
          <span className="text-status-red">
            {d.figure.includes(", ") ? "Figures changed" : TAG.figure}: {d.figure}
          </span>
        ) : (
          <>
            {TAG[d.kind]}
            {"figures" in d && d.figures.length > 0 && (
              <span className="text-status-red">
                {" "}
                · figure{d.figures.length === 1 ? "" : "s"} changed: {d.figures.join(", ")}
              </span>
            )}
          </>
        )}
      </p>
      <div className="grid grid-cols-2 gap-x-6 text-sm leading-relaxed">
        <p className="min-w-0 break-words text-ink">
          {d.kind === "added" ? <Faint>Not in the source</Faint> : <Marked text={source} against={d.kind === "missing" || !deck ? null : deck} />}
        </p>
        <p className="min-w-0 break-words text-ink">
          {d.kind === "missing" || !deck ? <Faint>Not on the slide</Faint> : <Marked text={deck} against={d.kind === "added" ? null : source} />}
        </p>
      </div>
    </li>
  );
}

function Faint({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>;
}

/** The words of `text` the other side does not have, on a Mist mark in Muted Ink; `against` null marks nothing. */
function Marked({ text, against }: { text: string; against: string | null }) {
  if (against === null) return <>{text}</>;
  const other = new Set(tokens(against));
  const words = text.split(/(\s+)/);
  return (
    <>
      {words.map((w, i) => {
        const t = tokens(w);
        const differs = t.length > 0 && t.some((x) => !other.has(x));
        return differs ? (
          <mark key={i} className="rounded-[4px] bg-mist px-0.5 text-ink-muted">
            {w}
          </mark>
        ) : (
          <span key={i}>{w}</span>
        );
      })}
    </>
  );
}
