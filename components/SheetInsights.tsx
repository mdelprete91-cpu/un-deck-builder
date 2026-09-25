"use client";

import { FileSpreadsheet, LoaderCircle, MessageCircleQuestion } from "lucide-react";
import Button from "@/components/Button";
import type { Attachment } from "@/lib/slides/attachments";
import { answeredCount } from "@/lib/slides/sheet-questions";

/**
 * The line under a spreadsheet chip: where the sheet's questions stand
 * (reading, failed, n of m answered) and the way back into the wizard
 * (`components/SheetWizard.tsx`). The questions themselves are the model's,
 * written for this file; this row only reports and reopens.
 */
export default function SheetInsights({
  attachments,
  disabled,
  onOpen,
}: {
  attachments: Attachment[];
  disabled?: boolean;
  onOpen: (id: string) => void;
}) {
  const sheets = attachments.filter((a): a is Extract<Attachment, { kind: "text" }> => a.kind === "text" && !!a.spreadsheet);
  if (sheets.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {sheets.map((a) => {
        const reading = !a.analysis && !a.analysisError;
        const total = a.analysis?.questions.length ?? 0;
        const done = a.analysis ? answeredCount(a.analysis, a.answers ?? {}) : 0;
        const status = reading
          ? "Reading the sheet…"
          : a.analysisError
            ? "Could not read the sheet"
            : total === 0
              ? "No questions, the sheet reads on its own"
              : done === 0
                ? `${total} question${total === 1 ? "" : "s"} to answer`
                : `${done} of ${total} answered`;
        return (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-hairline-light bg-canvas py-1 pl-3 pr-1">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink">
              {reading ? (
                <LoaderCircle size={12} className="shrink-0 animate-spin text-ink-faint" aria-hidden />
              ) : (
                <FileSpreadsheet size={12} className="shrink-0 text-giga" aria-hidden />
              )}
              <span className="truncate">{status}</span>
            </span>
            {!reading && (
              <Button variant="ghost" icon={MessageCircleQuestion} onClick={() => onOpen(a.id)} disabled={disabled}>
                {a.analysisError ? "Retry" : done > 0 ? "Edit" : total === 0 ? "See" : "Answer"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
