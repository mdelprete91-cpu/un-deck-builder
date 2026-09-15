"use client";

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
          title={a.kind === "text" && a.truncated ? `${a.name} (long file, first part only)` : a.name}
          className="group inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-giga-tint pl-2 pr-1 text-xs font-semibold text-giga"
        >
          <FileGlyph kind={a.kind} />
          <span className="max-w-[150px] truncate">{a.name}</span>
          <span className="text-[10px] font-normal text-ink-muted">{formatBytes(a.bytes)}</span>
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            disabled={disabled}
            aria-label={`Remove ${a.name}`}
            className="flex h-5 w-5 items-center justify-center rounded-full text-giga transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 disabled:opacity-40"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}

function FileGlyph({ kind }: { kind: Attachment["kind"] }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "image") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M21 16l-5-5-9 9" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      {kind === "text" && <path d="M9 13h6M9 17h6" />}
    </svg>
  );
}
