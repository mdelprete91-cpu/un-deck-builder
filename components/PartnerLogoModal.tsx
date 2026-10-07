"use client";

import { Library, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { PARTNER_NAMES, partnerSlug } from "@/lib/slides/partners";
import { whitenLogo } from "@/lib/slides/whiten";

/**
 * Adding or replacing a partner on the partner slide (Mario, 7 Oct 2026): a
 * dialog in the image picker's shape, with two tabs. Library: the partner
 * logos we ship, drawn white on the slide's cyan, a click puts one on the
 * slide. Upload: the partner's name and a PNG, JPEG or SVG; a raster is made
 * white (lib/slides/whiten.ts), and the preview shows it as the slide will.
 */
export default function PartnerLogoModal({
  accent,
  replacing,
  onSlide,
  onPick,
  onClose,
}: {
  /** The slide's surface, so the previews look like the slide. */
  accent: string;
  /** The partner being replaced, or null when adding. */
  replacing: string | null;
  /** The partners already on the slide: shown, not offered twice. */
  onSlide: string[];
  onPick: (name: string, logo?: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const taken = new Set(onSlide.map(partnerSlug));
  const read = async (file: File) => {
    setError(null);
    try {
      setLogo(await whitenLogo(file));
      // The file's name is a good first guess at the partner's.
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\blogo\b/i, "").trim());
    } catch {
      setError("That image could not be read. Try a PNG, JPEG or SVG.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="partner-logo-title"
        className="pop-in flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 id="partner-logo-title" className="text-xl font-medium text-ink">
            {replacing ? `Replace ${replacing}` : "Add a partner"}
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        <div role="tablist" aria-label="Logo source" className="mx-6 mt-4 flex h-10 items-center gap-1 rounded-full bg-canvas-2 p-1">
          {(
            [
              { id: "library", label: "Library", icon: Library },
              { id: "upload", label: "Upload a logo", icon: Upload },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={tab === s.id}
              onClick={() => setTab(s.id)}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                tab === s.id ? "bg-surface font-medium text-ink shadow-stripe" : "text-ink-muted hover:text-ink"
              }`}
            >
              <s.icon size={14} aria-hidden />
              {s.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto px-6 pb-6 pt-5">
          {tab === "library" ? (
            <div className="grid grid-cols-3 gap-2">
              {PARTNER_NAMES.map((n) => {
                const there = taken.has(partnerSlug(n));
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={there}
                    onClick={() => onPick(n)}
                    title={there ? `${n} is on the slide` : `Put ${n} on the slide`}
                    className="group relative flex aspect-[2/1] items-center justify-center rounded-xl p-3 transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 disabled:cursor-default"
                    style={{ background: accent }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/partners/${partnerSlug(n)}.svg`}
                      alt={n}
                      className={`max-h-[60%] max-w-[85%] object-contain ${there ? "opacity-35" : ""}`}
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                    {there && <span className="absolute bottom-1.5 left-0 right-0 text-center text-[11px] font-medium text-white/90">On the slide</span>}
                    <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-white/0 transition-colors group-hover:ring-white/60 group-disabled:ring-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && logo) onPick(name.trim(), logo);
              }}
            >
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) void read(f);
                }}
                className="flex aspect-[2/1] max-h-[30vh] w-full flex-col items-center justify-center gap-2 rounded-2xl text-sm text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
                style={{ background: accent }}
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="max-h-[55%] max-w-[70%] object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                ) : (
                  <>
                    <Upload size={20} aria-hidden />
                    <span className="font-medium">Choose or drop a PNG, JPEG or SVG</span>
                    <span className="text-xs text-white/80">It is made white to sit on the slide</span>
                  </>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void read(f);
                  e.target.value = "";
                }}
              />
              {error && <p role="alert" className="text-[13px] text-status-red">{error}</p>}
              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-muted">Partner name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Songbird"
                  className="h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-1">
                {logo && (
                  <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                    Choose another
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={!name.trim() || !logo}>
                  {replacing ? "Replace" : "Add to the slide"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
