"use client";

import { Image as ImageIcon, Map as MapIcon, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import LiveMapPanel from "@/components/LiveMapPanel";
import type { MapSlot } from "@/lib/giga-maps/slot";
import Button from "@/components/Button";

type Section = "current" | "upload" | "maps";

const SECTIONS: { id: Section; label: string; icon: typeof Upload }[] = [
  { id: "current", label: "Current", icon: ImageIcon },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "maps", label: "Maps", icon: MapIcon },
];

/**
 * What goes in a slide's image slot: a photo from the user's machine, or a
 * map rendered on the spot from live Giga Maps data. One narrow dialog,
 * sized by what it shows: the title and the close, a segmented control for
 * the sections, the section under it. It opens on Upload, the common case,
 * and on Current when the slot already holds a photo. The rail-and-panel
 * version (24 Sep 2026) was a 1024x540 box with the settings in one corner
 * and the map letterboxed in another; this one is 576px wide and no taller
 * than its content. The old Giga Maps screenshots are no longer offered; a
 * deck that already carries one (`slide.map`) still renders it.
 */
export default function ImagePickerModal({
  slot,
  current = null,
  onRemove,
  onUpload,
  onPickGenerated,
  onClose,
}: {
  slot: MapSlot;
  /** The photo in the slot now, if any: shown first, with a way to remove it. */
  current?: string | null;
  onRemove?: () => void;
  onUpload: () => void;
  onPickGenerated: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>(current ? "current" : "upload");
  const sections = current ? SECTIONS : SECTIONS.filter((s) => s.id !== "current");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="image-picker-title"
        className="pop-in flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 id="image-picker-title" className="text-xl font-medium text-ink">
            Image
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        {/* The sections as a segmented control: a Canvas-2 track, the current
            one a white pill with the stripe shadow, like the theme switch. The
            frames below are 16:9 but never taller than a third of the screen,
            so the whole dialog fits a 13-inch laptop without scrolling. */}
        <div role="tablist" aria-label="Image source" className="mx-6 mt-4 flex h-10 items-center gap-1 rounded-full bg-canvas-2 p-1">
          {sections.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(s.id)}
                className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                  active ? "bg-surface font-medium text-ink shadow-stripe" : "text-ink-muted hover:text-ink"
                }`}
              >
                <s.icon size={14} aria-hidden />
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 overflow-y-auto px-6 pb-6 pt-5">
          {section === "current" && current && (
            <div className="flex flex-col gap-4">
              <div className="flex aspect-[16/9] max-h-[33vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-canvas-2 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="danger" icon={Trash2} onClick={onRemove}>
                  Remove image
                </Button>
                <Button variant="primary" icon={Upload} onClick={onUpload}>
                  Replace with a photo
                </Button>
              </div>
            </div>
          )}

          {section === "upload" && (
            <div className="flex aspect-[16/9] max-h-[33vh] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-canvas-2">
              <Upload size={20} className="text-ink-faint" aria-hidden />
              <p className="text-sm text-ink-muted">A JPG or PNG from your computer.</p>
              <Button variant="primary" onClick={onUpload}>
                Choose a photo
              </Button>
            </div>
          )}

          {section === "maps" && <LiveMapPanel slot={slot} onUse={onPickGenerated} onCancel={onClose} />}
        </div>
      </div>
    </div>
  );
}
