import type { ArrayField, LayoutId, SlideContent } from "./schema";

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
        bullets: ["Partner 1", "Partner 2", "Partner 3", "Partner 4"],
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
    case "thank-you":
      return {
        layoutId,
        title: "Thank you!",
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
  }
}
