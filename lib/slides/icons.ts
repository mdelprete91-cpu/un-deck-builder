import { icons } from "lucide";

type IconNode = readonly (readonly [string, Record<string, string | number | undefined>])[];

/** Lucide icon inner markup (the SVG wrapper is owned by the layout). */
function inner(node: IconNode): string {
  return node
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .filter(([k, v]) => k !== "key" && v != null)
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ")}/>`,
    )
    .join("");
}

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * The FULL Lucide set for icon-card slides, keyed by kebab slug
 * ("chart-column", "radio-tower"). Slugs live in the slide's `icons` array
 * and the markup is rendered inline, so every export (PDF/HTML/PPTX)
 * carries the icon with no runtime dependency.
 */
export const ICON_LIBRARY: Record<string, string> = {};
for (const [name, node] of Object.entries(icons)) {
  ICON_LIBRARY[kebab(name)] = inner(node as unknown as IconNode);
}

// Slugs from the first curated set that don't match Lucide's kebab names —
// decks saved with them keep rendering.
const LEGACY_ALIASES: Record<string, string> = {
  chart: "chart-column",
  graduation: "graduation-cap",
  dollar: "dollar-sign",
  check: "circle-check",
  book: "book-open",
};
for (const [alias, target] of Object.entries(LEGACY_ALIASES)) {
  ICON_LIBRARY[alias] ??= ICON_LIBRARY[target];
}

/** Picker list: every Lucide icon once (aliases hidden), alphabetical. */
export const ICON_NAMES = Object.keys(ICON_LIBRARY)
  .filter((n) => !(n in LEGACY_ALIASES))
  .sort();

/** Per-position defaults when a card has no chosen icon (the historic rotation). */
export const DEFAULT_ICONS = ["globe", "wifi", "school", "chart-column"];

export function iconInner(name: string | undefined, position: number): string {
  return ICON_LIBRARY[name ?? ""] ?? ICON_LIBRARY[DEFAULT_ICONS[position % DEFAULT_ICONS.length]];
}
