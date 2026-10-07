"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { PROGRAMME_LOGOS } from "@/lib/slides/pages/logos";

/**
 * The programme logo of a two-pager's first page (Mario, 7 Oct 2026): pick
 * one we ship, upload one, or remove it, which brings the date back. Placed
 * at the click, in the Download menu's card.
 */
export default function LogoMenu({
  x,
  y,
  current,
  onPick,
  onUpload,
  onRemove,
  onClose,
}: {
  x: number;
  y: number;
  current?: string;
  onPick: (src: string) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const left = Math.min(x - 200, (typeof window !== "undefined" ? window.innerWidth : 1600) - 260);
  const row = "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist";
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div role="menu" aria-label="Programme logo" className="pop-in fixed z-50 w-60 rounded-2xl bg-surface p-1.5 shadow-menu" style={{ left: Math.max(8, left), top: y + 12 }}>
        <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-muted">Logo at the top right</p>
        {PROGRAMME_LOGOS.map((l) => (
          <button key={l.id} role="menuitemradio" aria-checked={current === l.src} onClick={() => onPick(l.src)} className={row}>
            <span className="grid h-7 w-12 shrink-0 place-items-center rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.src} alt="" className="max-h-6 max-w-11" />
            </span>
            {l.name}
          </button>
        ))}
        <button role="menuitem" onClick={() => fileRef.current?.click()} className={row}>
          <ImageUp size={16} className="shrink-0 text-ink-muted" aria-hidden />
          Upload an image…
        </button>
        {current && (
          <button role="menuitem" onClick={onRemove} className={`${row} text-status-red`}>
            <Trash2 size={16} className="shrink-0" aria-hidden />
            Remove, show the date
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}
