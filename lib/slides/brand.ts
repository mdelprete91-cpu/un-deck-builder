import type { UiStrings } from "./i18n";
export type BrandId = "giga" | "unicef" | "did" | "inclusion" | "di";

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
  /**
   * Categorical series for the donut, one hue per segment. Absent, the donut
   * falls back to `barShades`. On the UNICEF brands it is the qualitative
   * scheme of the UNICEF Brand Book (Mario, 15 Sep 2026).
   */
  chartSeries?: string[];
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
  /**
   * The words a renderer draws itself ("Done", "Thank you!"), in the deck's
   * language (lib/slides/i18n.ts UI_STRINGS). Set by the editor per deck,
   * absent on the brand constants: English then.
   */
  ui?: UiStrings;
  /** Logo on light surfaces (black variant) */
  logoLight: { src: string; filter?: string; scale?: number };
  /** Logo on dark/colored surfaces (white variant) */
  logoDark: { src: string; filter?: string; scale?: number };
  /** Full-color logo used on the cover slide */
  logoCover: { src: string; filter?: string; scale?: number };
  /**
   * The UNICEF DI template (DI Deck Template.pdf, Mario, 18 Oct 2026) and
   * only it sets these: its own look, not the two-surface rule of the other
   * UNICEF lockups. Absent, every renderer draws exactly what it drew before.
   */
  look?: "di";
  /** Light slides' page colour (the template's #F8F8F8); white when absent. */
  page?: string;
  /** The dark surface: big numbers, statements, section dividers. */
  dark?: string;
  /** The chapter name in the footer and the current item (agenda, progress). */
  highlight?: string;
  /** Website in the footer, next to the chapter name. */
  site?: string;
  /** The dot-map backgrounds, without text, from the template. */
  backgrounds?: { cover: string; agenda: string; dark: string; closing: string };
  /**
   * The chapter this slide sits in, set per slide by the caller from the
   * deck (chapterAt in lib/slides/chapters.ts), like `ui`. Only the DI
   * footer prints it.
   */
  chapter?: string;
}

const GIGA_LOCKUP = "/logos/giga-unicef-itu-horizontal.svg";
const UNICEF_LOGO = "/logos/unicef.svg";
const DID_UNBOXED = "/logos/unicef-digital-impact-unboxed.svg";
// The UNICEF mark, a hairline and the wordmark, as on the two-pager's masthead (Mario, 12 Oct 2026).
const INCLUSION_BLACK = "/logos/unicef-digital-inclusion-lockup-black.svg";
const INCLUSION_WHITE = "/logos/unicef-digital-inclusion-lockup-white.svg";

const TO_BLACK = "brightness(0)";
const TO_WHITE = "brightness(0) invert(1)";

/**
 * The Giga palette. Only the retired "giga" lockup still runs on it, so decks
 * saved with that lockup keep their colors. Every lockup on the Logo menu
 * (UNICEF, Digital Impact Division, Digital Inclusion) runs on CYAN_PALETTE
 * (Mario, 17 Sep 2026: UNICEF takes the same colors as the two sub-brands).
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

/** UNICEF cyan: the only colored surface the UNICEF lockups ever use. */
const UNICEF_CYAN = "#01AEEF";

/**
 * UNICEF, Digital Impact Division and Digital Inclusion share one palette and
 * run on two surfaces, nothing else (Mario's rule, 10 Aug 2026, extended to
 * the UNICEF lockup on 17 Sep 2026): a colored one,
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
  // UNICEF Brand Book secondary colours, in the order the segments get them.
  chartSeries: [UNICEF_CYAN, "#0058AB", "#80BD41", "#FF7100", "#FFC20E", "#6A1E74"],
  // The template's green quote surface is a colored surface too, so here it is
  // cyan like every other one; the author line goes dimmed white on it.
  quoteBg: UNICEF_CYAN,
  quoteAuthor: "rgba(255,255,255,.78)",
  // Section + image is a white slide here, in both its variants: the cyan is
  // carried by the photo panel and the title, not by the page (Mario, 10 Aug 2026).
  sectionImage: { bg: "#FFFFFF", title: UNICEF_CYAN, body: "#161616", surface: "light" },
} satisfies Partial<BrandTheme>;

/**
 * The UNICEF DI template (DI Deck Template.pdf, Mario, 18 Oct 2026): cyan,
 * a deep blue as the second chart series and a navy dark surface, on a light
 * grey page. Colours sampled from the PDF.
 */
const DI_CYAN = "#00AEEF";
const DI_DEEP = "#0B6BA8";
const DI_NAVY = "#1A293C";
const DI_PALETTE = {
  accent: DI_CYAN,
  deep: DI_CYAN,
  light: "#F8F8F8",
  soft: "rgba(255,255,255,.72)",
  soft2: "rgba(255,255,255,.78)",
  panelDeep: DI_CYAN,
  panelLight: "#FFFFFF",
  panelLightStroke: DI_CYAN,
  // A ramp, darkest first like the other palettes: charts take the first n
  // reversed (chartShades), so mixed hues here read as random bar colours.
  barShades: [DI_NAVY, DI_DEEP, DI_CYAN, "#67CEF5", "#C0EBFB"],
  chartSeries: [DI_CYAN, DI_DEEP, DI_NAVY, "#67CEF5", "#FE7910", "#80BD41"],
  // The quote runs on the page, its author in the chapter orange.
  quoteBg: "#F8F8F8",
  quoteAuthor: "#FE7910",
  sectionImage: { bg: DI_CYAN, title: "#FFFFFF", body: "#FFFFFF", surface: "dark" },
} satisfies Partial<BrandTheme>;

export const BRANDS: Record<BrandId, BrandTheme> = {
  di: {
    id: "di",
    label: "UNICEF DI",
    ...DI_PALETTE,
    footerLabel: "Digital Inclusion",
    logoLight: { src: "/templates/di/unicef-cyan.svg", scale: 1.2 },
    logoDark: { src: "/templates/di/unicef-white.svg", scale: 1.2 },
    logoCover: { src: "/templates/di/unicef-white.svg", scale: 1.2 },
    look: "di",
    page: "#F8F8F8",
    dark: DI_NAVY,
    highlight: "#FE7910",
    site: "digitalinclusion.global",
    backgrounds: {
      cover: "/templates/di/cover.jpg",
      agenda: "/templates/di/agenda.jpg",
      dark: "/templates/di/dark.jpg",
      closing: "/templates/di/closing.jpg",
    },
  },
  did: {
    id: "did",
    label: "UNICEF DID",
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
    ...CYAN_PALETTE,
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
    // The full lockup (UNICEF mark | Digital Inclusion), the same one the
    // two-pager prints, at the Digital Impact Division lockup's height: on
    // the A4 masthead the two stand 37pt tall side by side.
    logoLight: { src: INCLUSION_BLACK, filter: TO_BLACK, scale: 1.2 },
    logoDark: { src: INCLUSION_WHITE, filter: TO_WHITE, scale: 1.2 },
    logoCover: { src: INCLUSION_BLACK, scale: 1.2 },
  },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];

/**
 * What the Template menu offers, in this order: UNICEF DI first, the default
 * since 18 Oct 2026. "giga" (Mario, 15 Sep 2026) and the old "inclusion"
 * (Mario, 19 Oct 2026, replaced by UNICEF DI) are not on it: they stay in
 * BRANDS so a deck saved with them still opens and renders, but nobody starts
 * a new one with them.
 */
export const PICKER_BRAND_IDS: BrandId[] = ["di", "did", "unicef"];

/** Narrow untrusted input (a reopened deck file) to a brand we actually ship. */
export function isBrandId(value: unknown): value is BrandId {
  return typeof value === "string" && Object.hasOwn(BRANDS, value);
}
