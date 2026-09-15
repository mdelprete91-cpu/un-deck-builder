"use client";

import { useRef, useState } from "react";
import { ATTACHMENT_ACCEPT, formatBytes, type Attachment } from "@/lib/slides/attachments";

/**
 * The row inside the prompt box that holds the brief's reference files:
 * one chip per attachment plus the "Attach files" affordance. Files can also
 * be dropped anywhere on the prompt box; the parent wires that and passes
 * `dragging` so the whole box can show it.
 */
export default function AttachmentsRow({
  attachments,
  disabled,
  onAdd,
  onRemove,
}: {
  attachments: Attachment[];
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-2.5 py-2">
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:bg-giga-tint hover:text-giga focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 disabled:pointer-events-none disabled:opacity-40"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.48-8.48" />
        </svg>
        {busy ? "Reading…" : attachments.length ? "Add more" : "Attach files"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length === 0) return;
          setBusy(true);
          try {
            await onAdd(files);
          } finally {
            setBusy(false);
          }
        }}
      />
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
