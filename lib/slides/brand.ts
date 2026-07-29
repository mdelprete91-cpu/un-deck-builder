export type BrandId = "giga" | "unicef" | "did";

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
  logoLight: { src: string; filter?: string };
  /** Logo on dark/colored surfaces (white variant) */
  logoDark: { src: string; filter?: string };
  /** Full-color logo used on the cover slide */
  logoCover: { src: string; filter?: string };
}

const GIGA_LOCKUP = "/logos/giga-unicef-itu-horizontal.svg";
const UNICEF_LOGO = "/logos/unicef.svg";
const DID_BLACK = "/logos/unicef-digital-impact-division-black.svg";
const DID_WHITE = "/logos/unicef-digital-impact-division-white.svg";

const TO_BLACK = "brightness(0)";
const TO_WHITE = "brightness(0) invert(1)";

export const BRANDS: Record<BrandId, BrandTheme> = {
  giga: {
    id: "giga",
    label: "Giga",
    accent: "#277AFF",
    deep: "#0530AD",
    light: "#D5E4FF",
    soft: "#8FB6FF",
    soft2: "#6FA1FF",
    panelDeep: "#0a3bc4",
    panelLight: "#bcd3fb",
    panelLightStroke: "#92b3ee",
    barShades: ["#277AFF", "#4C90FF", "#6CA4FF", "#8FB8FF", "#B5D0FF"],
    footerLabel: "Digital impact division",
    logoLight: { src: GIGA_LOCKUP, filter: TO_BLACK },
    logoDark: { src: GIGA_LOCKUP, filter: TO_WHITE },
    logoCover: { src: GIGA_LOCKUP },
  },
  unicef: {
    id: "unicef",
    label: "UNICEF",
    accent: "#1CABE2",
    deep: "#00538C",
    light: "#D9F0FA",
    soft: "#8FD4F1",
    soft2: "#74CBEE",
    panelDeep: "#0968a8",
    panelLight: "#bfe4f5",
    panelLightStroke: "#93cfeb",
    barShades: ["#1CABE2", "#48BCE8", "#74CBEE", "#A0DBF3", "#CCEAF9"],
    footerLabel: "UNICEF",
    logoLight: { src: UNICEF_LOGO, filter: TO_BLACK },
    logoDark: { src: UNICEF_LOGO, filter: TO_WHITE },
    logoCover: { src: UNICEF_LOGO },
  },
  did: {
    id: "did",
    label: "Digital Impact Division",
    accent: "#1CABE2",
    deep: "#00538C",
    light: "#D9F0FA",
    soft: "#8FD4F1",
    soft2: "#74CBEE",
    panelDeep: "#0968a8",
    panelLight: "#bfe4f5",
    panelLightStroke: "#93cfeb",
    barShades: ["#1CABE2", "#48BCE8", "#74CBEE", "#A0DBF3", "#CCEAF9"],
    footerLabel: "Digital impact division",
    logoLight: { src: DID_BLACK },
    logoDark: { src: DID_WHITE },
    logoCover: { src: DID_BLACK },
  },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];
