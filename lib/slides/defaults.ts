import type { ArrayField, LayoutId, SlideContent } from "./schema";
import { presetStack } from "./pages/presets";
import { DEFAULT_CHANNELS } from "./schema";
import { PARTNER_NAMES } from "./partners";

/** Placeholder element appended by "Add element" in the editor. */
export function newItem(field: ArrayField): unknown {
  switch (field) {
    case "bullets":
      return "New item";
    case "stats":
      return { value: "00%", label: "Insert text here" };
    case "bars":
      return { label: "Year", value: 50 };
    case "contacts":
      return { name: "Name Surname", role: "Role, Giga", location: "Geneva, Switzerland", email: "giga@unicef.org" };
    default:
      return { label: "Label", body: "One sentence describing the point" };
  }
}

const LOREM_ROW = "One sentence describing the opportunity or possibility";
const LOREM_BODY =
  "Visibility, ESG impact reporting, access to a network of 2.2M+ mapped schools across 46 countries.";

/** Placeholder content used when a layout is inserted manually. */
export function defaultContent(layoutId: LayoutId): SlideContent {
  switch (layoutId) {
    case "cover":
      return { layoutId, title: "Presentation title", subtitle: "Subtitle goes here" };
    case "agenda":
      return { layoutId, title: "Agenda", bullets: ["First topic", "Second topic", "Third topic"] };
    case "three-columns":
      return {
        layoutId,
        title: "Agenda",
        blocks: Array.from({ length: 3 }, () => ({ label: "What", body: LOREM_BODY })),
      };
    case "callout":
      return {
        layoutId,
        title: "The Partnership Callout",
        blocks: [
          { label: "What", body: "One sentence describing the opportunity" },
          { label: "Give", body: "One sentence on what the partner provides" },
          { label: "Get", body: "One sentence on what the partner receives" },
          { label: "KPIs", body: "One sentence on how success is tracked" },
        ],
      };
    case "section-divider":
      return { layoutId, title: "Section title" };
    case "big-stat":
      return { layoutId, stat: "2.2M+", support: "Schools mapped across 146 countries." };
    case "quote":
      return { layoutId, quote: "Connectivity is a right, not a privilege.", author: "Author" };
    case "section-image-deep":
    case "section-image-light":
    case "section-image-dark":
      return { layoutId, title: "Section title", body: LOREM_ROW };
    case "four-cards":
      return {
        layoutId,
        title: "Example: Connectivity Credits System",
        blocks: [
          { label: "What", body: LOREM_BODY },
          { label: "Give", body: LOREM_BODY },
          { label: "Get", body: LOREM_BODY },
          { label: "KPIs", body: LOREM_BODY },
        ],
      };
    case "list":
      return {
        layoutId,
        title: "Deploy the multi-sector Connectivity Map",
        blocks: [
          { label: "KR1", body: "Add health facility data to the Connectivity Map using government-sourced datasets: 3 datasets (Gambia, Zambia, Sierra Leone) live." },
          { label: "KR2", body: "Incorporate additional government datasets and open-source health data as an advocacy tool, using the gap between open and verified data to make the case for investment." },
          { label: "KR3", body: "Pilot real-time telemetry data from health centers on the Map in 3 countries." },
          { label: "KR4", body: "Backend architecture ready to support additional facility types beyond schools and health." },
          { label: "KR5", body: "Product and UX design delivers a map experience that generalizes cleanly across facility types, not just schools and health." },
          { label: "KR6", body: "Lay technical and data groundwork for additional domains: emergency, migration, refugee." },
        ],
      };
    case "steps":
      return {
        layoutId,
        title: "Process",
        blocks: Array.from({ length: 4 }, (_, i) => ({ label: `Step ${i + 1}`, body: LOREM_ROW })),
      };
    case "body-copy":
      return {
        layoutId,
        title: "Title",
        blocks: [
          { label: "", body: LOREM_BODY },
          { label: "", body: LOREM_BODY },
        ],
      };
    case "map":
      return { layoutId, title: "Where we work" };
    case "photo":
      return { layoutId, title: "In the field" };
    case "donut-chart":
      return {
        layoutId,
        title: "Breakdown",
        bars: [
          { label: "Item 1", value: 52 },
          { label: "Item 2", value: 48 },
        ],
      };
    case "partner":
      return {
        layoutId,
        title: "Our partners",
        bullets: [...PARTNER_NAMES],
      };
    case "icon-cards":
      return {
        layoutId,
        title: "What we do",
        blocks: [
          { label: "Map", body: LOREM_ROW },
          { label: "Connect", body: LOREM_ROW },
          { label: "Finance", body: LOREM_ROW },
          { label: "Measure", body: LOREM_ROW },
        ],
      };
    case "stat-grid":
      return {
        layoutId,
        title: "Key numbers",
        stats: Array.from({ length: 6 }, () => ({ value: "61%", label: "Insert text here" })),
      };
    case "brand-equity":
      return {
        layoutId,
        title: "Business value: brand equity",
        body: LOREM_BODY,
        stats: Array.from({ length: 6 }, () => ({ value: "48%", label: "Insert text here" })),
      };
    case "two-stats":
      return {
        layoutId,
        title: "Key numbers",
        stats: [
          { value: "36%", label: LOREM_ROW },
          { value: "56%", label: LOREM_ROW },
        ],
      };
    case "single-stat":
      return { layoutId, title: "Key number", stat: "100%", support: LOREM_ROW };
    case "chart-columns-wide":
      return {
        layoutId,
        title: "Schools mapped by country",
        bars: ["Kenya", "Nigeria", "Brazil", "Rwanda", "Kazakhstan", "Sierra Leone", "Honduras", "El Salvador", "Zimbabwe", "Uzbekistan", "Botswana", "Namibia"].map(
          (label, i) => ({ label, value: Math.round(12000 / (i + 1)) }),
        ),
      };
    case "chart-bars-horizontal":
      return {
        layoutId,
        title: "Connected schools by country",
        bars: [
          { label: "Kenya", value: 6100 },
          { label: "Brazil", value: 4800 },
          { label: "Nigeria", value: 3200 },
          { label: "Rwanda", value: 2350 },
          { label: "Honduras", value: 1200 },
        ],
      };
    case "chart-line":
      return {
        layoutId,
        title: "Connected schools over time",
        series: ["Connected", "Mapped"],
        bars: [
          { label: "2021", value: 400, values: [400, 4000] },
          { label: "2022", value: 1200, values: [1200, 6500] },
          { label: "2023", value: 2600, values: [2600, 9000] },
          { label: "2024", value: 4800, values: [4800, 11000] },
          { label: "2025", value: 7100, values: [7100, 12000] },
        ],
      };
    case "chart-columns-grouped":
      return {
        layoutId,
        title: "Connected schools, 2024 vs 2025",
        series: ["2024", "2025"],
        bars: [
          { label: "East Africa", value: 4200, values: [4200, 6100] },
          { label: "West Africa", value: 1800, values: [1800, 2350] },
          { label: "LatAm", value: 9800, values: [9800, 11200] },
          { label: "Asia", value: 12000, values: [12000, 15400] },
        ],
      };
    case "chart-columns-stacked":
      return {
        layoutId,
        title: "Schools by connectivity type",
        series: ["Fibre", "Mobile", "Satellite"],
        bars: [
          { label: "East Africa", value: 2100, values: [2100, 3200, 800] },
          { label: "West Africa", value: 600, values: [600, 1200, 550] },
          { label: "LatAm", value: 6500, values: [6500, 3900, 800] },
          { label: "Asia", value: 9000, values: [9000, 5400, 1000] },
        ],
      };
    case "chart-bars":
      return {
        layoutId,
        title: "Trend",
        bars: [
          { label: "2022", value: 1200 },
          { label: "2023", value: 4800 },
          { label: "2024", value: 7400 },
          { label: "2025", value: 9800 },
        ],
      };
    case "timeline":
      return {
        layoutId,
        title: "Timeline",
        blocks: Array.from({ length: 4 }, () => ({ label: "2026", body: LOREM_ROW })),
      };
    case "timeline-phases":
      return {
        layoutId,
        title: "Timeline",
        blocks: Array.from({ length: 5 }, () => ({ label: "Month", body: LOREM_ROW })),
      };
    case "example-image-left":
    case "example-image-right":
      return {
        layoutId,
        title: "Example: Giga Platform",
        blocks: [
          { label: "What", body: LOREM_BODY },
          { label: "Give", body: LOREM_BODY },
        ],
      };
    case "photo-full":
      return { layoutId };

    case "thank-you":
      return {
        layoutId,
        title: "Thanks",
        channels: DEFAULT_CHANNELS.map((c) => ({ ...c })),
        contacts: [
          {
            name: "Name Surname",
            role: "Role, Giga",
            location: "Geneva, Switzerland",
            email: "name@unicef.org",
          },
        ],
      };
    case "tiers-1":
    case "tiers-2":
      return { layoutId, title: "Partnership tiers" };
    // A two-pager page is inserted through the preset picker, which passes the
    // stack it built; this is the bare fallback for any other caller.
    case "a4-page":
      return { layoutId, stack: presetStack("blank"), footerLabel: "" };
  }
}
