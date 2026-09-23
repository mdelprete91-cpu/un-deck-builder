/**
 * The words the brand voice bans and the model keeps using anyway: five
 * decks in twenty carried one on 23 Sep 2026, with the ban in the system
 * prompt. Each is replaced by a plain word of the same shape, on every
 * string the model wrote, before the slide reaches the client. A banned
 * word the brief itself uses is the user's and stays.
 */
const SWAPS: [RegExp, string][] = [
  [/\bleverag(?:e|es|ed|ing)\b/gi, "use"],
  [/\bsynerg(?:y|ies|istic)\b/gi, "shared gain"],
  [/\bcutting-edge\b/gi, "advanced"],
  [/\brevolutionary\b/gi, "new"],
  [/\bempower(?:s|ed|ing|ment)?\b/gi, "enable"],
  [/\bunlock(?:s|ed|ing)?\b/gi, "open up"],
];

const FORMS: Record<string, Record<string, string>> = {
  use: { leverage: "use", leverages: "uses", leveraged: "used", leveraging: "using" },
  enable: { empower: "enable", empowers: "enables", empowered: "enabled", empowering: "enabling", empowerment: "support" },
  "open up": { unlock: "open up", unlocks: "opens up", unlocked: "opened up", unlocking: "opening up" },
  "shared gain": { synergy: "shared gain", synergies: "shared gains", synergistic: "joint" },
};

function replaceWord(match: string, base: string): string {
  const forms = FORMS[base];
  const plain = forms?.[match.toLowerCase()] ?? base;
  return /^[A-Z]/.test(match) ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain;
}

export function cleanText(text: string, brief: string): string {
  let out = text;
  for (const [re, base] of SWAPS) {
    out = out.replace(re, (m) => (new RegExp(`\\b${m}\\b`, "i").test(brief) ? m : replaceWord(m, base)));
  }
  return out;
}

/** Every string in the slide, at any depth, through cleanText. */
export function cleanVoice<T>(value: T, brief: string): T {
  if (typeof value === "string") return cleanText(value, brief) as T;
  if (Array.isArray(value)) return value.map((v) => cleanVoice(v, brief)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanVoice(v, brief)])) as T;
  }
  return value;
}
