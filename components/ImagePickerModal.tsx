"use client";

import { ChevronLeft, Map as MapIcon, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COUNTRY_MAPS, countryMapThumb } from "@/lib/slides/country-maps";
import LiveMapPanel from "@/components/LiveMapPanel";
import type { MapSlot } from "@/lib/giga-maps/slot";
import Button from "@/components/Button";

/**
 * What goes in a slide's image slot: a photo from the user's machine, a map
 * rendered on the spot from live Giga Maps data, or one of the older Giga
 * Maps screenshots. Three paths behind one button, because from the slide's
 * point of view they fill the same hole.
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
  // Land straight on the library when the slide already shows a map: that is
  // the state you are in when you want a different country.
  const [tab, setTab] = useState<"choose" | "maps" | "live">(current ? "maps" : "choose");
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
      onClick={onClose}
    >
      <div
        className="pop-in flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl bg-white p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        {/* One header for every screen: a back chevron where there is a
            screen to go back to, the title, the close. */}
        <div className="mb-4 flex items-center gap-2">
          {tab !== "choose" && (
            <Button
              variant="ghost"
              iconOnly
              icon={ChevronLeft}
              onClick={() => setTab("choose")}
              title="Back"
              aria-label="Back"
              className="-ml-2"
            />
          )}
          <h2 className="flex-1 text-xl font-medium text-ink">
            {tab === "choose" ? "Slide image" : tab === "live" ? "Country map" : "Screenshots"}
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        {tab === "choose" ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onUpload}
              className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-8 text-center transition-colors duration-150 hover:bg-mist"
            >
              <Upload size={22} aria-hidden />
              <span className="text-sm font-medium text-ink">Upload image</span>
              <span className="text-xs text-ink-muted">A photo from your computer</span>
            </button>
            <button
              onClick={() => setTab("live")}
              className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-8 text-center transition-colors duration-150 hover:bg-mist"
            >
              <MapIcon size={22} aria-hidden />
              <span className="text-sm font-medium text-ink">Maps</span>
              <span className="text-xs text-ink-muted">Live from Giga Maps</span>
            </button>
            <Button
              variant="ghost"
              onClick={() => setTab("maps")}
              className="col-span-2 justify-self-start"
            >
              Pre-made screenshots
            </Button>
          </div>
        ) : tab === "live" ? (
          <>
            <LiveMapPanel slot={slot} onUse={onPickGenerated} onCancel={onClose} onLibrary={() => setTab("maps")} />
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
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
                  className={`group overflow-hidden rounded-lg border text-left transition-all duration-150 hover:border-giga ${
                    current === c.slug ? "border-giga ring-[3px] ring-giga/15" : "border-hairline"
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
                  <span className="block truncate px-2 pt-1.5 text-xs font-medium text-ink">
                    {c.name}
                  </span>
                  {/* Say it here rather than after the pick: an empty country
                      on a partnership slide reads as "no schools", which is
                      not what the export means. */}
                  <span className="block px-2 pb-1.5 text-[10px] text-ink-muted">
                    {c.empty ? "No schools plotted yet" : " "}
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
              <Button
                variant="danger"
                onClick={onClearMap}
                className="mt-3 self-start"
              >
                Remove map
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
