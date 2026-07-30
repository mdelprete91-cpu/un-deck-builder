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
 * Every option keeps the Giga palette: switching brand changes only the logo
 * lockup and the footer label, never the colors (Mario's rule, 29 Jul 2026).
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
} satisfies Partial<BrandTheme>;

// Key order drives the Logo select: Digital Impact Division first.
export const BRANDS: Record<BrandId, BrandTheme> = {
  did: {
    id: "did",
    label: "Digital Impact Division",
    ...GIGA_PALETTE,
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
    ...GIGA_PALETTE,
    footerLabel: "Digital Inclusion",
    logoLight: { src: INCLUSION_BLACK, filter: TO_BLACK },
    logoDark: { src: INCLUSION_WHITE, filter: TO_WHITE },
    logoCover: { src: INCLUSION_BLACK },
  },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];
