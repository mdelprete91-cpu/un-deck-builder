"use client";

import { useEffect, useMemo, useState } from "react";
import type { DataLayer, GigaMapCountry, MapTheme } from "@/lib/giga-maps/config";
import { DATA_LAYERS } from "@/lib/giga-maps/config";
import { fetchGigaMapCountries, renderGigaMapDataUrl } from "@/lib/giga-maps/render";
import type { MapSlot } from "@/lib/giga-maps/slot";

/**
 * Generates a country map from live Giga Maps data, in the browser, at the
 * exact size of the slide's image slot. The result is a JPEG data URL that
 * goes through SET_IMAGE like an upload: same storage budget, same export.
 *
 * MapLibre needs a visible tab to render (requestAnimationFrame is paused in
 * background tabs), which is why generation is an explicit button and not
 * something that starts on open.
 */
export default function LiveMapPanel({
  slot,
  onUse,
}: {
  slot: MapSlot;
  onUse: (dataUrl: string) => void;
}) {
  const [countries, setCountries] = useState<GigaMapCountry[]>([]);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<GigaMapCountry | null>(null);
  const [layer, setLayer] = useState<DataLayer>("school");
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGigaMapCountries()
      .then((list) => {
        if (cancelled) return;
        setCountries(list);
        setCountry(list.find((c) => c.code === "br") ?? list[0] ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCountriesError(err instanceof Error ? err.message : "Could not load countries");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any change to the inputs invalidates the preview: what you see is what
  // gets inserted, never a stale render of the previous settings.
  const pickCountry = (c: GigaMapCountry) => {
    setCountry(c);
    setPreview(null);
  };
  const pickLayer = (l: DataLayer) => {
    setLayer(l);
    setPreview(null);
  };
  const pickTheme = (t: MapTheme) => {
    setTheme(t);
    setPreview(null);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? countries.filter((c) => c.name.toLowerCase().includes(q)) : countries;
    // Countries with data first: that is what people are looking for.
    return [...list].sort((a, b) => {
      const da = a.schoolsTotal + a.healthTotal > 0 ? 0 : 1;
      const db = b.schoolsTotal + b.healthTotal > 0 ? 0 : 1;
      return da - db || a.name.localeCompare(b.name);
    });
  }, [countries, query]);

  const noData =
    !!country &&
    ((layer === "school" && country.schoolsTotal === 0) ||
      (layer === "health" && country.healthTotal === 0) ||
      (layer === "all" && country.schoolsTotal + country.healthTotal === 0));

  const generate = async () => {
    if (!country || busy) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await renderGigaMapDataUrl({
        countryCode: country.code,
        layer,
        theme,
        width: slot.width,
        height: slot.height,
      });
      setPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The map could not be rendered");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* Country list */}
      <div className="flex w-56 shrink-0 flex-col">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a country"
          className="mb-2 h-10 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted/70 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
        />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-hairline">
          {countriesError && <p className="p-3 text-xs text-status-red">{countriesError}</p>}
          {!countriesError && countries.length === 0 && (
            <p className="p-3 text-xs text-ink-muted">Loading countries…</p>
          )}
          {matches.map((c) => {
            const has = c.schoolsTotal + c.healthTotal > 0;
            return (
              <button
                key={c.code}
                onClick={() => pickCountry(c)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-giga-tint ${
                  country?.code === c.code ? "bg-giga-tint font-semibold text-giga" : "text-ink"
                } ${has ? "" : "opacity-60"}`}
              >
                <span className="truncate">{c.name}</span>
                <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-ink-muted">{c.code}</span>
              </button>
            );
          })}
          {countries.length > 0 && matches.length === 0 && (
            <p className="p-3 text-xs text-ink-muted">No country matches “{query}”.</p>
          )}
        </div>
      </div>

      {/* Settings + preview */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(DATA_LAYERS) as DataLayer[]).map((key) => (
            <Pill key={key} active={layer === key} onClick={() => pickLayer(key)}>
              {DATA_LAYERS[key].label}
            </Pill>
          ))}
          <span className="mx-1 h-5 w-px bg-hairline" />
          <Pill active={theme === "dark"} onClick={() => pickTheme("dark")}>
            Dark
          </Pill>
          <Pill active={theme === "light"} onClick={() => pickTheme("light")}>
            Light
          </Pill>
        </div>

        {country && (
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">{country.name}</span>: {fmt(country.schoolsTotal)} schools,{" "}
            {fmt(country.healthTotal)} health centers mapped.{" "}
            {noData && <span className="text-[#D14807]">Nothing to plot for this selection yet.</span>}
          </p>
        )}

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-canvas"
          style={{ aspectRatio: `${slot.width} / ${slot.height}`, maxHeight: 360 }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <p className="px-6 text-center text-xs text-ink-muted">
              {busy ? "Rendering from live Giga Maps data…" : `Rendered at ${slot.width} × ${slot.height} to fit this slide.`}
            </p>
          )}
        </div>

        {error && <p className="text-xs text-status-red">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={!country || busy}
            className="rounded-full border border-hairline bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-giga-tint disabled:opacity-50"
          >
            {busy ? "Rendering…" : preview ? "Render again" : "Render map"}
          </button>
          <button
            onClick={() => preview && onUse(preview)}
            disabled={!preview || busy}
            className="rounded-full bg-giga px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-giga/90 disabled:opacity-50"
          >
            Use this map
          </button>
          <span className="ml-auto text-[10px] text-ink-muted">Basemap © OpenMapTiles © OpenStreetMap · data Giga</span>
        </div>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
        active ? "border-giga bg-giga-tint text-giga" : "border-hairline bg-white text-ink hover:bg-giga-tint"
      }`}
    >
      {children}
    </button>
  );
}
