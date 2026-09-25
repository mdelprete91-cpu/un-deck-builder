"use client";

import { FileSpreadsheet } from "lucide-react";
import { MAX_INSIGHTS_CHARS, type Attachment } from "@/lib/slides/attachments";

/**
 * The one question the composer asks about an attached spreadsheet: what
 * should the deck draw from it. A sheet is rows, not an argument, and the
 * model cannot guess which of forty columns matters. The answer lives on
 * the attachment (session state, like the file) and travels with the same
 * Generate press, under the table in the user turn. Empty is allowed: the
 * model then reads the sheet against the brief alone.
 */
export default function SheetInsights({
  attachments,
  disabled,
  onChange,
  onSubmit,
}: {
  attachments: Attachment[];
  disabled?: boolean;
  onChange: (id: string, insights: string) => void;
  /** ⌘↵ inside the field generates, like it does in the brief. */
  onSubmit: () => void;
}) {
  const sheets = attachments.filter((a) => a.kind === "text" && a.spreadsheet);
  if (sheets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {sheets.map((a) => (
        <label key={a.id} className="block rounded-2xl border border-hairline-light bg-canvas px-3 py-2.5">
          {/* The name wraps rather than truncates: the sidebar is narrow and a
              file name cut to "co…" is no name at all. */}
          <span className="flex items-start gap-1.5 text-xs font-medium leading-4 text-ink">
            <FileSpreadsheet size={12} className="mt-0.5 shrink-0 text-giga" aria-hidden />
            <span className="min-w-0 break-words">
              What should the deck draw from <span className="text-giga">{a.name}</span>?
            </span>
          </span>
          <input
            value={a.kind === "text" ? (a.insights ?? "") : ""}
            onChange={(e) => onChange(a.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
            disabled={disabled}
            maxLength={MAX_INSIGHTS_CHARS}
            placeholder="E.g. connected schools by region, and the growth since 2023"
            className="mt-1.5 block w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15 disabled:opacity-60"
          />
        </label>
      ))}
    </div>
  );
}
