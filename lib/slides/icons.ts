import {
  BookOpen,
  ChartColumn,
  CircleCheck,
  Cloud,
  Database,
  DollarSign,
  Globe,
  GraduationCap,
  Handshake,
  Laptop,
  Lightbulb,
  Map,
  MapPin,
  Network,
  RadioTower,
  Rocket,
  Satellite,
  School,
  Shield,
  Signal,
  Target,
  Users,
  Wifi,
  Zap,
} from "lucide";

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

/**
 * The curated icon set for icon-card slides: Giga-relevant Lucide icons,
 * stored by slug in the slide's `icons` array and rendered inline so every
 * export (PDF/HTML/PPTX) carries them with no runtime dependency.
 */
export const ICON_LIBRARY: Record<string, string> = {
  globe: inner(Globe),
  wifi: inner(Wifi),
  school: inner(School),
  chart: inner(ChartColumn),
  "map-pin": inner(MapPin),
  map: inner(Map),
  users: inner(Users),
  handshake: inner(Handshake),
  shield: inner(Shield),
  zap: inner(Zap),
  rocket: inner(Rocket),
  lightbulb: inner(Lightbulb),
  graduation: inner(GraduationCap),
  laptop: inner(Laptop),
  satellite: inner(Satellite),
  "radio-tower": inner(RadioTower),
  signal: inner(Signal),
  database: inner(Database),
  cloud: inner(Cloud),
  dollar: inner(DollarSign),
  target: inner(Target),
  check: inner(CircleCheck),
  book: inner(BookOpen),
  network: inner(Network),
};

export const ICON_NAMES = Object.keys(ICON_LIBRARY);

/** Per-position defaults when a card has no chosen icon (the historic rotation). */
export const DEFAULT_ICONS = ["globe", "wifi", "school", "chart"];

export function iconInner(name: string | undefined, position: number): string {
  return ICON_LIBRARY[name ?? ""] ?? ICON_LIBRARY[DEFAULT_ICONS[position % DEFAULT_ICONS.length]];
}
