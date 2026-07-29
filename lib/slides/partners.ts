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
