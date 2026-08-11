export type BrandId = "giga" | "unicef" | "did" | "inclusion";

export interface BrandTheme {
  id: BrandId;
  label: string;
  /** Accent family (template: #277AFF / #0530AD / #D5E4FF / #8FB6FF / #6FA1FF) */
  accent: string;
  deep: string;
  light: string;
  soft: string;
  soft2: string;
  /** Image-panel placeholders per surface */
  panelDeep: string;
  panelLight: string;
  panelLightStroke: string;
  /** Bar chart shades, darkest→lightest */
  barShades: [string, string, string, string, string];
  /** Quote slide: the template's green surface, and the author line on it */
  quoteBg: string;
  quoteAuthor: string;
  /**
   * Section + image, the colored ("deep") variant. The Digital sub-brands run
   * these slides on white, so the whole variant travels with the brand.
   */
  sectionImage: {
    bg: string;
    title: string;
    body: string;
    surface: "light" | "dark";
  };
  footerLabel: string;
  /** Logo on light surfaces (black variant) */
  logoLight: { src: string; filter?: string; scale?: number };
  /** Logo on dark/colored surfaces (white variant) */
  logoDark: { src: string; filter?: string; scale?: number };
  /** Full-color logo used on the cover slide */
  logoCover: { src: string; filter?: string; scale?: number };
}

const GIGA_LOCKUP = "/logos/giga-unicef-itu-horizontal.svg";
const UNICEF_LOGO = "/logos/unicef.svg";
const DID_UNBOXED = "/logos/unicef-digital-impact-unboxed.svg";
const INCLUSION_BLACK = "/logos/unicef-digital-inclusion-black.svg";
const INCLUSION_WHITE = "/logos/unicef-digital-inclusion-white.svg";

const TO_BLACK = "brightness(0)";
const TO_WHITE = "brightness(0) invert(1)";

/**
 * Giga and UNICEF keep the Giga palette: switching between those two changes
 * only the logo lockup and the footer label, never the colors (Mario's rule,
 * 29 Jul 2026). The two Digital sub-brands run on cyan instead, see
 * CYAN_PALETTE.
 */
const GIGA_PALETTE = {
  accent: "#277AFF",
  deep: "#0530AD",
  light: "#D5E4FF",
  soft: "#8FB6FF",
  soft2: "#6FA1FF",
  panelDeep: "#0a3bc4",
  panelLight: "#bcd3fb",
  panelLightStroke: "#92b3ee",
  barShades: ["#277AFF", "#4C90FF", "#6CA4FF", "#8FB8FF", "#B5D0FF"],
  quoteBg: "#01B37C",
  quoteAuthor: "#0530AD",
  sectionImage: { bg: "#0530AD", title: "#FFFFFF", body: "#FFFFFF", surface: "dark" },
} satisfies Partial<BrandTheme>;

/** UNICEF cyan: the only colored surface the Digital sub-brands ever use. */
const UNICEF_CYAN = "#01AEEF";

/**
 * Digital Impact Division and Digital Inclusion share one palette and run on
 * two surfaces, nothing else (Mario's rule, 10 Aug 2026): a colored one,
 * always exactly #01AEEF, and white. So there is no second, darker blue here —
 * `deep` is the same cyan as `accent`, and the tinted surface (`light`, the
 * light variant of section-image) is plain white. `soft`/`soft2` only ever
 * tint text sitting on the cyan; dimmed white keeps the template's hierarchy
 * without introducing a second hue.
 */
const CYAN_PALETTE = {
  accent: UNICEF_CYAN,
  deep: UNICEF_CYAN,
  light: "#FFFFFF",
  soft: "rgba(255,255,255,.72)",
  soft2: "rgba(255,255,255,.78)",
  panelDeep: UNICEF_CYAN,
  panelLight: "#FFFFFF",
  panelLightStroke: UNICEF_CYAN,
  // Charts still need separable values: tints of the same cyan, no second hue.
  barShades: [UNICEF_CYAN, "#39C0F3", "#67CEF5", "#94DDF8", "#C0EBFB"],
  // The template's green quote surface is a colored surface too, so here it is
  // cyan like every other one; the author line goes dimmed white on it.
  quoteBg: UNICEF_CYAN,
  quoteAuthor: "rgba(255,255,255,.78)",
  // Section + image is a white slide here, in both its variants: the cyan is
  // carried by the photo panel and the title, not by the page (Mario, 10 Aug 2026).
  sectionImage: { bg: "#FFFFFF", title: UNICEF_CYAN, body: "#161616", surface: "light" },
} satisfies Partial<BrandTheme>;

// Key order drives the Logo select: Digital Impact Division first.
export const BRANDS: Record<BrandId, BrandTheme> = {
  did: {
    id: "did",
    label: "Digital Impact Division",
    ...CYAN_PALETTE,
    footerLabel: "Digital Impact Division",
    // Unboxed lockup (no cyan square), slightly scaled up to match the others
    logoLight: { src: DID_UNBOXED, filter: TO_BLACK, scale: 1.2 },
    logoDark: { src: DID_UNBOXED, filter: TO_WHITE, scale: 1.2 },
    logoCover: { src: DID_UNBOXED, scale: 1.2 },
  },
  giga: {
    id: "giga",
    label: "Giga",
    ...GIGA_PALETTE,
    footerLabel: "Digital Impact Division",
    logoLight: { src: GIGA_LOCKUP, filter: TO_BLACK },
    logoDark: { src: GIGA_LOCKUP, filter: TO_WHITE },
    logoCover: { src: GIGA_LOCKUP },
  },
  unicef: {
    id: "unicef",
    label: "UNICEF",
    ...GIGA_PALETTE,
    footerLabel: "UNICEF",
    logoLight: { src: UNICEF_LOGO, filter: TO_BLACK },
    logoDark: { src: UNICEF_LOGO, filter: TO_WHITE },
    logoCover: { src: UNICEF_LOGO },
  },
  inclusion: {
    id: "inclusion",
    label: "UNICEF Digital Inclusion",
    ...CYAN_PALETTE,
    footerLabel: "Digital Inclusion",
    // Bare wordmark, no UNICEF emblem: its type fills the whole viewBox, so at
    // the shared 60px logo height it renders roughly twice the type size of
    // the other lockups. Scaled down until its cap height matches "giga".
    logoLight: { src: INCLUSION_BLACK, filter: TO_BLACK, scale: 0.46 },
    logoDark: { src: INCLUSION_WHITE, filter: TO_WHITE, scale: 0.46 },
    logoCover: { src: INCLUSION_BLACK, scale: 0.46 },
  },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];

/** Narrow untrusted input (a reopened deck file) to a brand we actually ship. */
export function isBrandId(value: unknown): value is BrandId {
  return typeof value === "string" && Object.hasOwn(BRANDS, value);
}
