import type { PageBlock, PageBlockType, PageItem } from "./schema";

/**
 * Placeholder content for manual insert: the twin of `defaults.ts`, one level
 * down. Every string is real text rather than "Lorem", because the user edits
 * in place and an empty node is a node they cannot find.
 */
export function newPageItem(type: PageBlockType): PageItem {
  switch (type) {
    case "rail-prose":
      return { kind: "para", label: "", body: "A new paragraph.", extra: "" };
    case "stat-cards":
      return { label: "00%", body: "What the number counts", extra: "" };
    case "icon-columns":
      return { label: "Heading", body: "One sentence about it.", extra: "" };
    case "photo-cards":
      return { label: "Title", body: "A short caption", extra: "" };
    case "two-col-panels":
      return { label: "Column", body: "The text of this column.", extra: "" };
    case "table":
      return { label: "Row", body: "Value", extra: "Value" };
    case "numbered-badges":
      return { label: "", body: "What we are asking for.", extra: "" };
    case "contacts":
      return { label: "Name Surname", body: "/ Role, Team", extra: "name@unicef.org" };
    default:
      return { label: "", body: "", extra: "" };
  }
}

const DEFAULTS: Record<PageBlockType, () => PageBlock> = {
  title: () => ({ type: "title", heading: "A title for this page" }),
  lede: () => ({
    type: "lede",
    lead: "The lead-in",
    body: "is one paragraph saying what this page is about.",
  }),
  "rail-prose": () => ({
    type: "rail-prose",
    rail: "Section",
    items: [
      { kind: "para", label: "", body: "The opening paragraph of this section.", extra: "" },
      { kind: "bullet", label: "", body: "A point worth listing on its own.", extra: "" },
    ],
  }),
  "status-callout": () => ({
    type: "status-callout",
    lead: "Status:",
    body: "Concept and prototype. No production software, no live issuances.",
  }),
  "stat-cards": () => ({
    type: "stat-cards",
    accent: -1,
    items: [
      { label: "2.6B", body: "People remain offline", extra: "" },
      { label: "1.3B", body: "Children lack internet at home", extra: "" },
      { label: "5x", body: "What Africa pays vs the global average", extra: "" },
    ],
  }),
  "icon-columns": () => ({
    type: "icon-columns",
    items: [
      { label: "Technology", body: "Map and measure connectivity inequality.", extra: "", icon: "wifi" },
      { label: "Procurement", body: "Develop service profiles and tender templates.", extra: "", icon: "file-text" },
      { label: "Financing", body: "Build national financing paths.", extra: "", icon: "hand-coins" },
    ],
  }),
  "photo-cards": () => ({
    type: "photo-cards",
    items: [
      { label: "Schools", body: "Giga, proven at scale", extra: "" },
      { label: "Health", body: "Primary care and referral systems", extra: "" },
    ],
  }),
  "two-col-panels": () => ({
    type: "two-col-panels",
    accent: 1,
    items: [
      { label: "Where we are", body: "What is already running.", extra: "" },
      { label: "What we are asking", body: "What is still open.", extra: "" },
    ],
  }),
  "figure-split": () => ({
    type: "figure-split",
    tag: "Phase 1",
    body: "What the figure beside this text shows, in two or three lines.",
  }),
  "screens-flow": () => ({
    type: "screens-flow",
    items: [
      { label: "", body: "", extra: "" },
      { label: "", body: "", extra: "" },
      { label: "", body: "", extra: "" },
    ],
  }),
  table: () => ({
    type: "table",
    heading: "Category",
    sub: "Current",
    lead: "Future",
    items: [
      { label: "Cellular", body: "LTE demo", extra: "5G small cells" },
      { label: "Local network", body: "Wi-Fi study", extra: "Mesh Wi-Fi" },
    ],
  }),
  "numbered-badges": () => ({
    type: "numbered-badges",
    items: [
      { label: "", body: "The first thing we are asking for.", extra: "" },
      { label: "", body: "The second thing we are asking for.", extra: "" },
    ],
  }),
  contacts: () => ({
    type: "contacts",
    rail: "Contact",
    items: [
      { label: "Name Surname", body: "/ Role, Team", extra: "name@unicef.org" },
    ],
  }),
  divider: () => ({ type: "divider" }),
};

/** A block ready to insert. */
export function defaultBlock(type: PageBlockType): PageBlock {
  return DEFAULTS[type]();
}

export interface PagePreset {
  id: string;
  label: string;
  /** What the preset puts on the page, in order. */
  blocks: () => PageBlock[];
}

/**
 * "Add page" offers these compositions, taken from the shapes the ten boards
 * actually use. Everything in a preset can then be added to, removed or
 * reordered — a preset is a starting point, not a layout.
 *
 * A page that opens with a title gets the masthead (see `hasHeader`), so the
 * first preset is the one that starts a piece and the others continue it.
 */
export const PAGE_PRESETS: PagePreset[] = [
  {
    id: "opening",
    label: "Opening page",
    blocks: () => [defaultBlock("title"), defaultBlock("lede"), defaultBlock("rail-prose")],
  },
  {
    id: "opening-status",
    label: "Opening + status",
    blocks: () => [
      defaultBlock("title"),
      defaultBlock("status-callout"),
      defaultBlock("rail-prose"),
    ],
  },
  {
    id: "prose-stats",
    label: "Text + stats",
    blocks: () => [defaultBlock("rail-prose"), defaultBlock("stat-cards"), defaultBlock("icon-columns")],
  },
  {
    id: "photos",
    label: "Photo grid",
    blocks: () => [defaultBlock("rail-prose"), defaultBlock("photo-cards")],
  },
  {
    id: "compare",
    label: "Two columns",
    blocks: () => [defaultBlock("two-col-panels")],
  },
  {
    id: "figure",
    label: "Figure + text",
    blocks: () => [defaultBlock("rail-prose"), defaultBlock("figure-split")],
  },
  {
    id: "table",
    label: "Table",
    blocks: () => [defaultBlock("rail-prose"), defaultBlock("table")],
  },
  {
    id: "asks",
    label: "Asks + contacts",
    blocks: () => [defaultBlock("numbered-badges"), defaultBlock("divider"), defaultBlock("contacts")],
  },
  {
    id: "blank",
    label: "Blank page",
    blocks: () => [defaultBlock("title")],
  },
];

export function presetStack(id: string): PageBlock[] {
  const preset = PAGE_PRESETS.find((p) => p.id === id) ?? PAGE_PRESETS[0];
  return preset.blocks();
}
