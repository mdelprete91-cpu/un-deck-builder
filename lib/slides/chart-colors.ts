/**
 * The sixteen colours a bar or a donut segment can be given by hand, over the
 * brand's automatic series. Giga's blues first, then the UNICEF Brand Book
 * secondary colours, then neutrals. Nothing outside this list reaches a slide:
 * the picker offers exactly these, and `normalizeSlide` drops any other hex.
 * (Mario, 22 Sep 2026: a chart may need a colour the series does not give.)
 */
export const CHART_COLORS: { hex: string; name: string }[] = [
  { hex: "#0530AD", name: "Giga deep blue" },
  { hex: "#277AFF", name: "Giga Blue" },
  { hex: "#6FA1FF", name: "Giga light blue" },
  { hex: "#B5D0FF", name: "Giga pale blue" },
  { hex: "#01AEEF", name: "UNICEF cyan" },
  { hex: "#67CEF5", name: "UNICEF light cyan" },
  { hex: "#0058AB", name: "UNICEF dark blue" },
  { hex: "#6A1E74", name: "UNICEF purple" },
  { hex: "#80BD41", name: "UNICEF green" },
  { hex: "#01B37C", name: "Giga green" },
  { hex: "#FFC20E", name: "UNICEF yellow" },
  { hex: "#FF7100", name: "UNICEF orange" },
  { hex: "#E2231A", name: "UNICEF red" },
  { hex: "#5D5D5D", name: "Dark grey" },
  { hex: "#8F8F8F", name: "Grey" },
  { hex: "#C9C9C9", name: "Light grey" },
];

export const CHART_COLOR_HEXES = new Set(CHART_COLORS.map((c) => c.hex));

/**
 * Hexes a deck may still carry from an earlier palette, mapped to the colour
 * that replaced them. (Mario, 24 Sep 2026: orange moved from the Brand Book
 * #F26A21 to #FF7100.)
 */
const LEGACY_CHART_COLORS: Record<string, string> = {
  "#F26A21": "#FF7100",
};

/**
 * The canonical upper-case hex for a picked colour, following a retired hex
 * to its replacement; undefined for anything outside the palette.
 */
export function toChartColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const hex = value.toUpperCase();
  const mapped = LEGACY_CHART_COLORS[hex] ?? hex;
  return CHART_COLOR_HEXES.has(mapped) ? mapped : undefined;
}
