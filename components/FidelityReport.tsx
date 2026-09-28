"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import Button from "@/components/Button";
import { isExact, tokens, totals, type DeckFidelity, type Leftover, type Totals } from "@/lib/slides/fidelity";
import type { Slide } from "@/lib/slides/schema";

/**
 * The fidelity report of a replica (lib/slides/fidelity.ts), inside the
 * generation readout: how many figures are exact, how much of the source's
 * text is kept word for word, what changed. "Review changes" opens the
 * detail, the source and the deck side by side, slide by slide, with "Go to
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
  const exact = isExact(t);
  const wrong = t.figures.total - t.figures.ok;
  return (
    <div className="mt-2.5 border-t border-hairline pt-2.5">
      <p className="text-[13px] text-ink-faint">Source fidelity</p>
      {exact ? (
        <p className="mt-1 text-xs leading-relaxed text-ink">Replicated exactly: every figure and line of the source is in the deck.</p>
      ) : (
        <>
          <dl className="mt-1 flex flex-col gap-0.5 text-xs leading-relaxed">
            <Row label="Figures exact">
              {t.figures.total ? (
                <>
                  <span className="text-ink">
                    {t.figures.ok} / {t.figures.total} ({pct(t.figures.ok, t.figures.total)}%)
                  </span>
                  {wrong > 0 && <span className="text-status-red"> · {wrong} changed</span>}
                </>
              ) : (
                <span className="text-ink-muted">None in the source</span>
              )}
            </Row>
            <Row label="Text kept">
              <span className="text-ink">{pct(t.words.kept, t.words.total)}%</span>
              <span className="text-ink-muted"> of the words</span>
            </Row>
            <Row label="Changed">
              <span className="text-ink-muted">
                {t.reworded} reworded, {t.missing} missing, {t.added} added
              </span>
            </Row>
            {t.notRebuilt > 0 && (
              <Row label="Not rebuilt">
                <span className="text-status-red">
                  {t.notRebuilt} slide{t.notRebuilt === 1 ? "" : "s"}
                </span>
              </Row>
            )}
          </dl>
          <Button variant="secondary" className="mt-2.5 w-full" onClick={() => setOpen(true)}>
            Review changes
          </Button>
        </>
      )}
      {report.transcribed && <p className="mt-2 text-xs leading-relaxed text-ink-muted">Source read from page images: check the figures.</p>}
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right tabular-nums">{children}</dd>
    </div>
  );
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The slide where it is now: its place when it landed, or found by its
  // title if the deck was reordered since.
  const locate = (s: DeckFidelity["slides"][number]) =>
    slides[s.at]?.title === s.deckTitle && slides[s.at]?.layoutId === s.layoutId
      ? s.at
      : slides.findIndex((x) => x.layoutId === s.layoutId && x.title === s.deckTitle);

  const changed = report.slides
    .map((s) => {
      // A changed figure sits on its line's row; only a figure with no row of its own (a chart label) gets one.
      const on = (line: string) => s.figures.wrong.filter((w) => w.source === line).map((w) => shown(w.figure));
      const rows = new Set([...s.lines.changed, ...s.lines.touched].map((p) => p.source).concat(s.lines.missing));
      return {
        s,
        diffs: [
          ...[...new Set(s.figures.wrong.filter((w) => !rows.has(w.source)).map((w) => w.source))].map((line): Diff => ({ kind: "figure", source: line, deck: "", figure: on(line).join(", ") })),
          ...s.lines.changed.map((p): Diff => ({ kind: "changed", source: p.source, deck: p.deck, figures: on(p.source) })),
          ...s.lines.touched.map((p): Diff => ({ kind: "reworded", source: p.source, deck: p.deck, figures: on(p.source) })),
          ...s.lines.missing.map((source): Diff => ({ kind: "missing", source, figures: on(source) })),
          ...s.added.map((deck): Diff => ({ kind: "added", deck })),
        ],
      };
    })
    .filter((x) => x.diffs.length);
  const first = report.firstPass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="fidelity-title"
        className="pop-in flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline-light px-7 py-5">
          <div className="min-w-0">
            <h2 id="fidelity-title" className="text-xl font-medium text-ink">
              Changes from the source
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              Each slide against its source slide. Case, punctuation and number formatting do not count.
              {report.transcribed && " The source is the model's reading of the page images, so check the figures against the file."}
            </p>
          </div>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" autoFocus />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Figures exact" value={t.figures.total ? `${t.figures.ok} / ${t.figures.total}` : "None"} />
            <Stat label="Text kept" value={`${pct(t.words.kept, t.words.total)}%`} />
            <Stat label="Lines changed" value={`${t.reworded + t.missing}`} />
            <Stat label="Text added" value={`${t.added}`} />
          </div>
          {report.repairs > 0 && first && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
              {report.repairs} slide{report.repairs === 1 ? " was" : "s were"} written a second time to match the source, {report.repaired} came back
              closer. First pass: {first.figures.ok} / {first.figures.total} figures, {pct(first.words.kept, first.words.total)}% of the words.
            </p>
          )}

          {changed.map(({ s, diffs }) => {
            const index = locate(s);
            return (
              <section key={`${s.n}-${s.at}`} className="mt-7">
                <div className="flex items-center justify-between gap-4 border-b border-hairline-light pb-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {index >= 0 ? `Slide ${index + 1}` : "Slide removed"} · {s.deckTitle || s.title}
                    </p>
                    <p className="text-[13px] text-ink-faint">
                      Source slide {s.n} · {s.figures.total ? `${s.figures.ok} / ${s.figures.total} figures · ` : ""}
                      {pct(s.words.kept, s.words.total)}% of the words
                    </p>
                  </div>
                  {index >= 0 && (
                    <Button variant="ghost" iconRight={ArrowRight} onClick={() => onGoTo(index)}>
                      Go to slide
                    </Button>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-6 pt-2 text-[13px] text-ink-faint">
                  <span>Source</span>
                  <span>Deck</span>
                </div>
                <ul>
                  {diffs.map((d, k) => (
                    <DiffRow key={k} d={d} />
                  ))}
                </ul>
              </section>
            );
          })}

          {report.leftovers.length > 0 && (
            <section className="mt-7">
              <div className="border-b border-hairline-light pb-2">
                <p className="text-sm font-medium text-ink">Not replicated</p>
                <p className="text-[13px] text-ink-faint">Source text that has no slide in the deck.</p>
              </div>
              <ul>
                {report.leftovers.map((l) => (
                  <LeftoverRow key={`${l.n}-${l.reason}`} l={l} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas-2 px-3 py-2.5">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className="mt-0.5 text-base font-medium tabular-nums text-ink">{value}</p>
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

function LeftoverRow({ l }: { l: Leftover }) {
  const why =
    l.reason === "failed"
      ? "Could not be rebuilt. Add it with Add slide or generate again."
      : l.reason === "ceiling"
        ? "Past the 40-slide limit."
        : "Not carried by the agenda, the dividers or the closing slide.";
  return (
    <li className="border-b border-hairline-light py-3 last:border-b-0">
      <p className={`mb-1 text-xs font-medium ${l.reason === "structure" ? "text-ink-muted" : "text-status-red"}`}>
        Source slide {l.n}
        {l.title ? ` · ${l.title}` : ""}
      </p>
      <p className="text-[13px] text-ink-faint">{why}</p>
      {l.lines.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1 text-sm leading-relaxed text-ink">
          {l.lines.slice(0, 12).map((line, k) => (
            <li key={k} className="break-words">
              {line}
            </li>
          ))}
          {l.lines.length > 12 && <li className="text-[13px] text-ink-faint">and {l.lines.length - 12} more lines</li>}
        </ul>
      )}
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
