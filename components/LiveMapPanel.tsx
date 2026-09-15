"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DataLayer, GigaMapCountry, MapTheme } from "@/lib/giga-maps/config";
import { CONNECTIVITY_LEGEND } from "@/lib/giga-maps/config";
import { fetchGigaMapCountries, renderGigaMapDataUrl } from "@/lib/giga-maps/render";
import type { MapSlot } from "@/lib/giga-maps/slot";

/**
 * Country map from live Giga Maps data, rendered in the browser at the exact
 * size of the slide's image slot. The preview is the hero: it re-renders on
 * its own whenever country, facilities or style change, and "Use this map"
 * hands the JPEG data URL to SET_IMAGE like an upload.
 *
 * MapLibre draws on requestAnimationFrame, which browsers pause in background
 * tabs, so a render started while the tab is hidden simply completes when the
 * tab is visible again; the modal is always on screen while this runs.
 */

const SHOW_OPTIONS: { key: DataLayer; label: string }[] = [
  { key: "school", label: "Schools" },
  { key: "health", label: "Health" },
  { key: "all", label: "Both" },
];

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function LiveMapPanel({
  slot,
  onUse,
  onCancel,
  onLibrary,
}: {
  slot: MapSlot;
  onUse: (dataUrl: string) => void;
  onCancel: () => void;
  onLibrary: () => void;
}) {
  const [countries, setCountries] = useState<GigaMapCountry[]>([]);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [country, setCountry] = useState<GigaMapCountry | null>(null);
  const [layer, setLayer] = useState<DataLayer>("school");
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderToken = useRef(0);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Render whenever the inputs change. A token discards results from a
  // render that was superseded while it was still running.
  useEffect(() => {
    if (!country) return;
    const token = ++renderToken.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      renderGigaMapDataUrl({
        countryCode: country.code,
        layer,
        theme,
        width: slot.width,
        height: slot.height,
      })
        .then((dataUrl) => {
          if (renderToken.current !== token) return;
          setPreview(dataUrl);
        })
        .catch((err: unknown) => {
          if (renderToken.current !== token) return;
          setPreview(null);
          setError(err instanceof Error ? err.message : "The map could not be rendered");
        })
        .finally(() => {
          if (renderToken.current === token) setBusy(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [country, layer, theme, slot.width, slot.height]);

  // Close the country list on an outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const { withData, without } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? countries.filter((c) => c.name.toLowerCase().includes(q)) : countries;
    return {
      withData: list.filter((c) => c.schoolsTotal + c.healthTotal > 0),
      without: list.filter((c) => c.schoolsTotal + c.healthTotal === 0),
    };
  }, [countries, query]);

  const nothingToPlot =
    !!country &&
    ((layer === "school" && country.schoolsTotal === 0) ||
      (layer === "health" && country.healthTotal === 0) ||
      (layer === "all" && country.schoolsTotal + country.healthTotal === 0));

  const pick = (c: GigaMapCountry) => {
    setCountry(c);
    setPickerOpen(false);
    setQuery("");
  };
  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPreview(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      {/* Preview. Until the map arrives this is a canvas-colored skeleton,
          never a dark slab: dark surfaces belong to slide content only. */}
      <div className="flex flex-col gap-1.5">
        <div
          className="relative mx-auto overflow-hidden rounded-xl border border-hairline bg-canvas"
          style={{
            aspectRatio: `${slot.width} / ${slot.height}`,
            width: `min(100%, calc(320px * ${slot.width / slot.height}))`,
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${country?.name ?? "Country"} map preview`} className="block h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-[10%] rounded-lg bg-mist motion-safe:animate-pulse" aria-hidden />
          )}
          {preview && !busy && (
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              {CONNECTIVITY_LEGEND.slice(0, 2).map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-stripe"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          )}
          {preview && busy && (
            <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-stripe">
              Updating…
            </span>
          )}
        </div>
        <p className="min-h-[16px] text-center text-[11px] text-ink-muted" aria-live="polite">
          {error
            ? <span className="text-status-red">{error}</span>
            : busy || !preview
              ? country
                ? `Rendering ${country.name} from live Giga Maps data…`
                : countriesError ?? "Loading countries…"
              : "Ready. This is exactly what goes on the slide."}
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5" ref={pickerRef}>
          <Eyebrow>Country</Eyebrow>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              disabled={!country}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-white pl-2 pr-2.5 text-left transition-[box-shadow,border-color] duration-150 hover:border-ink/20 focus-visible:border-giga focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-manrope rounded bg-mist px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {country?.code ?? "…"}
                </span>
                <span className="truncate text-sm font-semibold text-ink">
                  {country?.name ?? (countriesError ? "Unavailable" : "Loading…")}
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5c7187" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
              </svg>
            </button>
            {pickerOpen && (
              <div role="listbox" className="pop-in absolute left-0 top-full z-10 mt-1 flex w-[300px] flex-col gap-1.5 rounded-xl border border-hairline bg-white p-2 shadow-stripe-lg">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Escape closes the list, not the whole modal.
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setPickerOpen(false);
                    }
                  }}
                  placeholder="Search a country"
                  className="h-9 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted/70 focus:border-giga focus:ring-[3px] focus:ring-giga/15"
                />
                <div className="max-h-64 overflow-y-auto">
                  {withData.length > 0 && <GroupLabel>With Giga data</GroupLabel>}
                  {withData.map((c) => (
                    <CountryRow key={c.code} c={c} active={country?.code === c.code} onPick={() => pick(c)} />
                  ))}
                  {without.length > 0 && <GroupLabel>Other countries</GroupLabel>}
                  {without.map((c) => (
                    <CountryRow key={c.code} c={c} active={country?.code === c.code} onPick={() => pick(c)} muted />
                  ))}
                  {withData.length + without.length === 0 && (
                    <p className="px-2.5 py-3 text-xs text-ink-muted">No country matches “{query}”.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <Caption>
            {countriesError
              ? countriesError
              : country
                ? `${fmt(country.schoolsTotal)} schools · ${country.healthTotal ? `${fmt(country.healthTotal)} health centers` : "no health centers yet"}`
                : " "}
          </Caption>
        </div>

        <div className="flex flex-col gap-1.5">
          <Eyebrow>Show</Eyebrow>
          <Segmented
            options={SHOW_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
            value={layer}
            onChange={change(setLayer)}
          />
          <Caption>
            {nothingToPlot ? (
              <span className="text-[#D14807]">Nothing to plot for this choice yet</span>
            ) : layer === "school" ? (
              "Every mapped school as a dot"
            ) : (
              "Health centers draw as squares"
            )}
          </Caption>
        </div>

        <div className="flex flex-col gap-1.5">
          <Eyebrow>Style</Eyebrow>
          <Segmented
            options={[
              { key: "dark", label: "Dark", swatch: "#141414" },
              { key: "light", label: "Light", swatch: "#f4f4f2" },
            ]}
            value={theme}
            onChange={change(setTheme)}
          />
          <Caption>Names and roads are hidden</Caption>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-0.5 flex items-center justify-between border-t border-hairline pt-3">
        <button
          type="button"
          onClick={onLibrary}
          className="rounded-full px-3 py-2 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15"
        >
          Use a pre-made screenshot instead
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="font-manrope h-10 whitespace-nowrap rounded-full border border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => preview && onUse(preview)}
            disabled={!preview || busy}
            className="font-manrope inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-giga px-[18px] text-sm font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-giga-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/25 active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-giga"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Use this map
          </button>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-manrope text-xs font-semibold text-ink-muted">{children}</span>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <span className="min-h-[16px] text-[11px] text-ink-muted">{children}</span>;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-manrope block px-2 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">
      {children}
    </span>
  );
}

function CountryRow({
  c,
  active,
  muted,
  onPick,
}: {
  c: GigaMapCountry;
  active: boolean;
  muted?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onPick}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 ${
        active ? "bg-mist font-semibold text-ink" : muted ? "text-ink-muted" : "text-ink"
      }`}
    >
      <span className="truncate">{c.name}</span>
      <span className="ml-2 shrink-0 text-[11px] text-ink-muted">
        {muted ? "no data" : `${fmt(c.schoolsTotal)}${c.healthTotal ? ` · ${fmt(c.healthTotal)}` : ""}`}
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; swatch?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid h-10 rounded-full bg-mist p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={`font-manrope flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 ${
            value === o.key ? "bg-white text-ink shadow-stripe" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.swatch && (
            <span className="h-2.5 w-2.5 rounded-[3px] border border-hairline" style={{ background: o.swatch }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
