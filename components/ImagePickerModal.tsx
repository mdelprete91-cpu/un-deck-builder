"use client";

import { Images, Map as MapIcon, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COUNTRY_MAPS, countryMapThumb } from "@/lib/slides/country-maps";
import LiveMapPanel from "@/components/LiveMapPanel";
import type { MapSlot } from "@/lib/giga-maps/slot";
import Button from "@/components/Button";

type Section = "upload" | "maps" | "screenshots";

const SECTIONS: { id: Section; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "maps", label: "Maps", icon: MapIcon },
  { id: "screenshots", label: "Screenshots", icon: Images },
];

/**
 * What goes in a slide's image slot: a photo from the user's machine, a map
 * rendered on the spot from live Giga Maps data, or one of the older Giga
 * Maps screenshots. Three sections behind one button, laid out like a
 * settings dialog: a rail on the left with the close and the sections, the
 * section itself on the right under its title.
 */
export default function ImagePickerModal({
  current,
  slot,
  onUpload,
  onPickMap,
  onPickGenerated,
  onClearMap,
  onClose,
}: {
  current?: string;
  slot: MapSlot;
  onUpload: () => void;
  onPickMap: (slug: string) => void;
  onPickGenerated: (dataUrl: string) => void;
  onClearMap: () => void;
  onClose: () => void;
}) {
  // Land on the screenshots when the slide already shows one: that is the
  // state you are in when you want a different country.
  const [section, setSection] = useState<Section>(current ? "screenshots" : "maps");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRY_MAPS.filter((c) => c.name.toLowerCase().includes(q)) : COUNTRY_MAPS;
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        className="pop-in flex h-[540px] max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rail: the close, then the sections as rows. */}
        <aside className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-hairline-light bg-canvas p-3">
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="mb-2" />
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
          <h2 className="text-xl font-medium text-ink">
            {section === "upload" ? "Upload a photo" : section === "maps" ? "Country map" : "Screenshots"}
          </h2>
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

          {section === "screenshots" && (
            <>
              <div className="mb-3 flex items-center gap-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a country"
                  className="h-9 w-full rounded-full border border-hairline bg-white px-4 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
                />
                <span className="shrink-0 text-xs text-ink-muted">{matches.length}</span>
              </div>

              {/* auto-rows-max, or the rows stretch to fill and squash the tiles:
                  a grid item with overflow:hidden has no automatic minimum size. */}
              <div className="-mx-1 grid min-h-0 flex-1 auto-rows-max grid-cols-3 gap-2 overflow-y-auto px-1 pb-1">
                {matches.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => onPickMap(c.slug)}
                    className={`group overflow-hidden rounded-xl border text-left transition-all duration-150 hover:border-ink/30 ${
                      current === c.slug ? "border-ink" : "border-hairline-light"
                    }`}
                  >
                    {/* Plain <img>: these are small static thumbnails we ship
                        ourselves, and the slide renderers emit raw HTML anyway,
                        so next/image would only apply inside this one modal. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={countryMapThumb(c.slug)}
                      alt=""
                      loading="lazy"
                      className="h-24 w-full bg-[#1C1C1C] object-contain transition-transform duration-150 group-hover:scale-[1.03]"
                    />
                    <span className="block truncate px-2.5 py-1.5 text-xs font-medium text-ink">
                      {c.name}
                      {/* Say it here rather than after the pick: an empty country
                          on a partnership slide reads as "no schools", which is
                          not what the export means. */}
                      {c.empty && <span className="font-normal text-ink-muted"> · no schools yet</span>}
                    </span>
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="col-span-3 py-10 text-center text-sm text-ink-muted">
                    No country matches “{query}”. Giga has maps for {COUNTRY_MAPS.length} countries.
                  </p>
                )}
              </div>

              {current && (
                <div className="mt-3 flex justify-end">
                  <Button variant="danger" onClick={onClearMap}>
                    Remove map
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
