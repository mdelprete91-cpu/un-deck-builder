"use client";

import { Map as MapIcon, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import LiveMapPanel from "@/components/LiveMapPanel";
import type { MapSlot } from "@/lib/giga-maps/slot";
import Button from "@/components/Button";

type Section = "upload" | "maps";

const SECTIONS: { id: Section; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "maps", label: "Maps", icon: MapIcon },
];

/**
 * What goes in a slide's image slot: a photo from the user's machine, or a
 * map rendered on the spot from live Giga Maps data. Two sections behind one
 * button, laid out like a settings dialog: a rail on the left with the close
 * and the sections, the section itself on the right under its title. The old
 * Giga Maps screenshots are no longer offered; a deck that already carries
 * one (`slide.map`) still renders it.
 */
export default function ImagePickerModal({
  slot,
  onUpload,
  onPickGenerated,
  onClose,
}: {
  slot: MapSlot;
  onUpload: () => void;
  onPickGenerated: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>("maps");

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
        className="pop-in flex h-[540px] max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rail: the sections as rows. */}
        <aside className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-hairline-light bg-canvas p-3 pt-5">
          {SECTIONS.map((s) => (
            <Button
              key={s.id}
              variant={section === s.id ? "secondary" : "ghost"}
              icon={s.icon}
              onClick={() => setSection(s.id)}
              aria-current={section === s.id ? "page" : undefined}
              className="w-full justify-start"
            >
              {s.label}
            </Button>
          ))}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col px-7 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-ink">
              {section === "upload" ? "Upload a photo" : "Country map"}
            </h2>
            <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
          </div>
          <div className="mt-4 mb-5 border-t border-hairline-light" />

          {section === "upload" && (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-canvas-2">
                <Upload size={20} className="text-ink-faint" aria-hidden />
                <p className="text-sm text-ink-muted">A JPG or PNG from your computer.</p>
                <Button variant="primary" onClick={onUpload}>
                  Choose a photo
                </Button>
              </div>
            </div>
          )}

          {section === "maps" && <LiveMapPanel slot={slot} onUse={onPickGenerated} onCancel={onClose} />}

        </section>
      </div>
    </div>
  );
}
