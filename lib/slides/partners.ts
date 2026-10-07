/**
 * The real Giga partners with a logo file in /public/partners.
 * Display names slugify exactly to the file names (see layouts/basic.ts
 * partners()): "Dubai Cares" → dubai-cares.svg, "España" → espana.svg.
 * Keep the two in sync when adding a logo.
 */
export const PARTNER_NAMES = [
  "Barcelona",
  "Catalunya",
  "Dell",
  "Dubai Cares",
  "Equinix",
  "Ericsson",
  "España",
  "FCDO",
  "IHS",
  "Internet Society",
  "Kili",
  "Liquid",
  "Mawingu",
  "Suisse",
] as const;

/** A partner's name as its logo file's name: "Dubai Cares" → "dubai-cares". */
export function partnerSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The logos the partner slide holds at most (three columns, five rows). */
export const MAX_PARTNERS = 15;
