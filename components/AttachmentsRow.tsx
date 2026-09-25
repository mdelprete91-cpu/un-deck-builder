"use client";

import { File as FileIcon, FileSpreadsheet, FileText, Image as ImageIcon, X } from "lucide-react";
import { formatBytes, type Attachment } from "@/lib/slides/attachments";

/**
 * The chips for the brief's reference files, one per attachment. It renders
 * nothing on its own: the file picker, the "+" button and the drop target
 * belong to `PromptBox`, which owns the composer this row sits in.
 */
export default function AttachmentsRow({
  attachments,
  disabled,
  onRemove,
}: {
  attachments: Attachment[];
  disabled?: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {attachments.map((a) => (
        <span
          key={a.id}
          title={
            a.kind === "text" && a.textOnly
              ? `${a.name}: too big to send whole, its text goes instead${a.truncated ? " (first part only)" : ""}`
              : a.kind === "text" && a.truncated
                ? `${a.name} (long file, first part only)`
                : a.name
          }
          className="group inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-giga-tint pl-2 pr-1 text-xs font-medium text-giga"
        >
          <FileGlyph attachment={a} />
          <span className="max-w-[150px] truncate">{a.name}</span>
          <span className="text-[10px] font-normal text-ink-muted">
            {a.kind === "text" && a.textOnly ? "text only" : formatBytes(a.bytes)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            disabled={disabled}
            aria-label={`Remove ${a.name}`}
            className="flex h-5 w-5 items-center justify-center rounded-full text-giga transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 disabled:opacity-40"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

function FileGlyph({ attachment: a }: { attachment: Attachment }) {
  if (a.kind === "image") return <ImageIcon size={12} aria-hidden />;
  if (a.kind === "text" && a.spreadsheet) return <FileSpreadsheet size={12} aria-hidden />;
  if (a.kind === "text") return <FileText size={12} aria-hidden />;
  return <FileIcon size={12} aria-hidden />;
}
