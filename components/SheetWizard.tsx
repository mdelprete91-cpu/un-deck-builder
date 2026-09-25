"use client";

import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, FileText, MessageSquareText, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { answeredCount, type MaterialKind, type SheetAnalysis, type SheetAnswers, type SheetQuestion } from "@/lib/slides/sheet-questions";

/** What the dialog is asking about: a file, or the brief itself. */
export interface WizardSubject {
  title: string;
  kind: MaterialKind;
  analysis?: SheetAnalysis;
  answers: SheetAnswers;
  /** The analysis failed; the dialog says so and offers a retry. */
  error?: string;
}

const INPUT =
  "block w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15";

const GLYPH: Record<MaterialKind, typeof FileText> = { spreadsheet: FileSpreadsheet, document: FileText, brief: MessageSquareText };

/**
 * The questions the material raises, one at a time, asked when Generate is
 * pressed (Mario, 25 Sep 2026: the model must see the whole brief first).
 * It reads while the user watches (a skeleton, never a spinner in the
 * content), then walks the questions the model wrote for this file or
 * this brief: a list of choices quoted from the material, or a line of
 * text. Every answer is saved as it is given, so closing keeps what was
 * said. With more than one file the dialog moves to the next one on Done,
 * and the last Done is the Generate press itself (`finalLabel`).
 *
 * Same box as the image picker: 576px, no taller than its content, the
 * scrim behind, the chrome's tokens and Button.tsx and nothing else. The
 * caller keys it by subject, so a new file starts at its first question.
 */
export default function SheetWizard({
  subject: s,
  finalLabel = "Done",
  onAnswers,
  onRetry,
  onSkip,
  onDone,
  onClose,
}: {
  subject: WizardSubject;
  /** The primary button on the last question: "Generate" when the deck follows. */
  finalLabel?: string;
  onAnswers: (answers: SheetAnswers) => void;
  onRetry: () => void;
  /** Move on without waiting for the reading, or without answering. */
  onSkip: () => void;
  /** The last question is answered (or skipped): the next subject, or the deck. */
  onDone: () => void;
  /** X or Esc: stop here, answers kept, nothing generated. */
  onClose: () => void;
}) {
  const analysis = s.analysis;
  const Glyph = GLYPH[s.kind];
  const questions = analysis?.questions ?? [];
  const [step, setStep] = useState(0);
  const answers = s.answers;
  const q: SheetQuestion | undefined = questions[step];
  const last = step >= questions.length - 1;
  const noun = s.kind === "spreadsheet" ? "sheet" : s.kind === "document" ? "file" : "brief";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (id: string, value: string | string[]) => onAnswers({ ...answers, [id]: value });
  const next = () => (last ? onDone() : setStep((n) => n + 1));
  const skipQuestion = () => {
    if (q) {
      const rest = { ...answers };
      delete rest[q.id];
      onAnswers(rest);
    }
    next();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="sheet-wizard-title"
        className="pop-in flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && analysis) {
            e.preventDefault();
            next();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <h2 id="sheet-wizard-title" className="flex min-w-0 items-center gap-2 text-xl font-medium text-ink">
            <Glyph size={18} className="shrink-0 text-giga" aria-hidden />
            <span className="truncate">{s.title}</span>
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        <div className="min-h-0 overflow-y-auto px-6 pb-2 pt-4">
          {/* Reading: the shape of what is coming, in Canvas-2, no motion. */}
          {!analysis && !s.error && (
            <div aria-busy aria-live="polite" className="flex flex-col gap-3">
              <p className="text-[13px] text-ink-faint">Reading the {noun}…</p>
              <div className="h-3.5 w-11/12 rounded bg-canvas-2" />
              <div className="h-3.5 w-3/4 rounded bg-canvas-2" />
              <div className="mt-3 h-5 w-2/3 rounded bg-canvas-2" />
              <div className="h-10 rounded-[10px] bg-canvas-2" />
              <div className="h-10 rounded-[10px] bg-canvas-2" />
              <div className="h-10 rounded-[10px] bg-canvas-2" />
            </div>
          )}

          {s.error && (
            <div className="rounded-xl border border-status-red-border bg-status-red-bg px-4 py-3 text-sm text-status-red">
              <p>Could not read the {noun}: {s.error}</p>
              <p className="mt-1 text-ink-muted">The deck can still be generated from the brief and the material as they are.</p>
            </div>
          )}

          {analysis && (
            <>
              {analysis.summary && <p className="text-sm leading-relaxed text-ink-muted">{analysis.summary}</p>}
              {questions.length === 0 && <p className="mt-4 text-sm text-ink">Nothing to ask: the {noun} reads on its own.</p>}
              {q && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[13px] text-ink-faint">
                    <span>
                      Question {step + 1} of {questions.length}
                    </span>
                    <span>{answeredCount(analysis, answers)} answered</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-canvas-2" aria-hidden>
                    <div
                      className="h-full rounded-full bg-giga transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-5 text-base font-medium leading-snug text-ink">{q.question}</p>
                  {q.why && <p className="mt-1 text-[13px] text-ink-muted">{q.why}</p>}

                  {q.kind === "text" ? (
                    <textarea
                      key={q.id}
                      autoFocus
                      rows={3}
                      value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                      onChange={(e) => set(q.id, e.target.value)}
                      placeholder="Your answer"
                      className={`${INPUT} mt-4 resize-y`}
                    />
                  ) : (
                    <div key={q.id} role={q.kind === "multi" ? "group" : "radiogroup"} aria-label={q.question} className="mt-4 flex flex-col gap-1">
                      {q.options.map((opt) => {
                        const current = answers[q.id];
                        const picked = Array.isArray(current) ? current.includes(opt) : current === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            role={q.kind === "multi" ? "checkbox" : "radio"}
                            aria-checked={picked}
                            onClick={() => {
                              if (q.kind === "multi") {
                                const list = Array.isArray(current) ? current : [];
                                set(q.id, picked ? list.filter((x) => x !== opt) : [...list, opt]);
                              } else {
                                set(q.id, picked ? "" : opt);
                              }
                            }}
                            className={`flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                              picked ? "bg-giga-tint text-giga" : "text-ink hover:bg-mist"
                            }`}
                          >
                            {/* The control the row is: a circle for one choice, a square for
                                several, filled with the accent and a tick when picked. Same
                                glyph language as the Chapters pill. */}
                            <span
                              aria-hidden
                              className={`flex h-4 w-4 shrink-0 items-center justify-center border transition-colors duration-100 ${
                                q.kind === "multi" ? "rounded-[4px]" : "rounded-full"
                              } ${picked ? "border-giga bg-giga text-white" : "border-mist-deep bg-surface"}`}
                            >
                              {picked && <Check size={11} strokeWidth={3} aria-hidden />}
                            </span>
                            <span className="min-w-0 break-words">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 pb-5 pt-3">
          {s.error ? (
            <>
              <Button variant="ghost" onClick={onSkip}>
                Continue without
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={onRetry}>
                Try again
              </Button>
            </>
          ) : !analysis ? (
            <>
              <span />
              <Button variant="ghost" onClick={onSkip}>
                Skip the questions
              </Button>
            </>
          ) : questions.length === 0 ? (
            <>
              <span />
              <Button variant="primary" onClick={onDone}>
                {finalLabel}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={skipQuestion}>
                Skip
              </Button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep((n) => n - 1)}>
                    Back
                  </Button>
                )}
                <Button variant="primary" iconRight={last ? undefined : ArrowRight} icon={last ? Check : undefined} onClick={next} title="⌘↵">
                  {last ? finalLabel : "Next"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
