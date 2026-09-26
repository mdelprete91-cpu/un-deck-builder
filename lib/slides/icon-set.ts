import { ICON_LIBRARY } from "./icons";

/**
 * The icons the model may put on an icon card (Mario, 26 Sep 2026: a globe
 * on "Award" and a chart on "Approve" came from the fixed rotation). About
 * 150 Lucide names grouped by what UNICEF and Giga decks talk about, short
 * enough that a small model picks well and the prompt stays cheap (about 500
 * tokens). The picker in the editor still offers the whole library; a name
 * outside this list from the model is dropped and the card falls back to the
 * rotation, so a wrong name never breaks a slide.
 */
const GROUPS: Record<string, string[]> = {
  education: ["school", "graduation-cap", "book-open", "notebook-pen", "pencil", "backpack", "library", "presentation", "lightbulb", "brain"],
  connectivity: ["wifi", "wifi-off", "signal", "radio-tower", "satellite", "satellite-dish", "router", "cable", "antenna", "globe", "earth", "network", "cloud", "server", "smartphone", "laptop", "monitor"],
  data: ["database", "chart-column", "chart-line", "chart-pie", "trending-up", "trending-down", "activity", "gauge", "table", "file-spreadsheet", "search", "scan", "binary", "code"],
  maps: ["map", "map-pin", "map-pinned", "locate", "compass", "route", "mountain", "trees", "building", "house", "tent"],
  money: ["wallet", "banknote", "coins", "piggy-bank", "receipt", "hand-coins", "circle-dollar-sign", "landmark", "credit-card", "calculator"],
  people: ["users", "user", "user-check", "user-plus", "baby", "hand-heart", "handshake", "heart", "smile", "accessibility", "person-standing", "contact"],
  governance: ["scale", "gavel", "file-text", "file-check", "clipboard-list", "clipboard-check", "stamp", "shield", "shield-check", "lock", "key-round", "badge-check", "award", "flag", "vote"],
  risk: ["triangle-alert", "circle-alert", "octagon-alert", "shield-alert", "bug", "ban", "circle-x", "flame", "zap-off", "thermometer"],
  progress: ["circle-check", "check", "list-checks", "target", "flag-triangle-right", "rocket", "trophy", "milestone", "footprints", "arrow-right", "refresh-cw", "repeat", "layers"],
  time: ["calendar", "calendar-check", "clock", "hourglass", "timer", "history"],
  communication: ["message-square", "messages-square", "mail", "megaphone", "phone", "video", "share", "newspaper", "mic", "bell"],
  health: ["heart-pulse", "stethoscope", "hospital", "syringe", "pill", "ambulance", "droplet", "apple"],
  energy: ["zap", "sun", "battery-charging", "plug", "power", "leaf", "recycle", "wind"],
  work: ["briefcase", "wrench", "settings", "hammer", "package", "truck", "factory", "puzzle", "workflow", "git-branch", "boxes", "sparkles", "eye"],
};

/** Every curated name that exists in the installed Lucide. */
export const AI_ICONS: string[] = [...new Set(Object.values(GROUPS).flat())].filter((n) => n in ICON_LIBRARY);

const ALLOWED = new Set(AI_ICONS);

/** The model's icons for a slide: known names only, no repeats; a bad entry becomes "" (the rotation). */
export function cleanModelIcons(icons: string[] | undefined): string[] | undefined {
  if (!icons?.length) return undefined;
  const seen = new Set<string>();
  const out = icons.map((raw) => {
    const n = String(raw ?? "").trim().toLowerCase();
    if (!ALLOWED.has(n) || seen.has(n)) return "";
    seen.add(n);
    return n;
  });
  return out.some(Boolean) ? out : undefined;
}
