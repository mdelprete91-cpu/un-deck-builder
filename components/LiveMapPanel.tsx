"use client";

import { ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DataLayer, GigaMapCountry, MapTheme } from "@/lib/giga-maps/config";
import { CONNECTIVITY_LEGEND } from "@/lib/giga-maps/config";
import { fetchGigaMapCountries, renderGigaMapDataUrl } from "@/lib/giga-maps/render";
import type { MapSlot } from "@/lib/giga-maps/slot";
import Button from "@/components/Button";

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

  const status = error
    ? error
    : countriesError
      ? countriesError
      : !country
        ? "Loading countries…"
        : nothingToPlot
          ? "Nothing to plot for this choice yet"
          : busy || !preview
            ? `Rendering ${country.name}…`
            : `${fmt(country.schoolsTotal)} schools${country.healthTotal ? ` · ${fmt(country.healthTotal)} health centers` : ""}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* The preview is the whole point, so it gets the room; the three
          settings sit beside it as a short column, one status line under
          them for whatever the map has to say. */}
      <div className="grid min-h-0 grid-cols-[1fr_240px] gap-6">
        <div
          className="relative mx-auto max-h-[440px] overflow-hidden rounded-2xl bg-canvas-2"
          style={{
            aspectRatio: `${slot.width} / ${slot.height}`,
            maxWidth: "100%",
            width: `calc(440px * ${slot.width / slot.height})`,
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${country?.name ?? "Country"} map preview`} className="block h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-[10%] rounded-xl bg-mist motion-safe:animate-pulse" aria-hidden />
          )}
          {preview && !busy && (
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              {CONNECTIVITY_LEGEND.slice(0, 2).map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink shadow-stripe"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          )}
          {preview && busy && (
            <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink shadow-stripe">
              Updating…
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5" ref={pickerRef}>
            <Eyebrow>Country</Eyebrow>
            <div className="relative">
              <Button
                variant="secondary"
                iconRight={ChevronsUpDown}
                onClick={() => setPickerOpen((o) => !o)}
                disabled={!country}
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                className="w-full"
              >
                <span className="flex-1 truncate text-left">
                  {country?.name ?? (countriesError ? "Unavailable" : "Loading…")}
                </span>
              </Button>
              {pickerOpen && (
                <div role="listbox" className="pop-in absolute left-0 top-full z-10 mt-1.5 flex w-[300px] flex-col rounded-2xl bg-white p-2 shadow-menu">
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
                    className="h-9 w-full bg-transparent px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
                  />
                  <div className="max-h-64 overflow-y-auto border-t border-hairline-light pt-1">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Eyebrow>Show</Eyebrow>
            <Segmented
              options={SHOW_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
              value={layer}
              onChange={change(setLayer)}
            />
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
          </div>

          <p
            className={`mt-auto text-xs ${error || countriesError || nothingToPlot ? "text-status-red" : "text-ink-muted"}`}
            aria-live="polite"
          >
            {status}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hairline-light pt-4">
        <Button variant="ghost" onClick={onLibrary}>
          Use a screenshot instead
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => preview && onUse(preview)} disabled={!preview || busy}>
            Use this map
          </Button>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-normal text-ink-faint">{children}</span>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-2.5 pb-1 pt-2 text-xs text-ink-faint">
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
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/15 ${
        active ? "bg-mist font-medium text-ink" : muted ? "text-ink-muted" : "text-ink"
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
      className="grid rounded-full bg-mist p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <Button
          key={o.key}
          variant={value === o.key ? "secondary" : "ghost"}
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className="w-full"
        >
          {o.swatch && (
            <span className="h-2.5 w-2.5 rounded-[3px] border border-hairline" style={{ background: o.swatch }} />
          )}
          {o.label}
        </Button>
      ))}
    </div>
  );
}
