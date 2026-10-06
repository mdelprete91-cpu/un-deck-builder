import type { PageBlock, PageBlockType, PageItem } from "./schema";

/**
 * What a block looks like when the user adds it by hand: short placeholder
 * copy in the shape the block expects, so the page shows what goes where.
 */

/** The block menu's names, in the order the menu lists them. */
export const BLOCK_LABELS: Record<PageBlockType, string> = {
  section: "Text section",
  stats: "Stat cards",
  pillars: "Three pillars",
  figure: "Image or map",
  compare: "Before / today table",
  asks: "Opportunities",
  panels: "Two panels",
  photos: "Photo cards",
  banner: "Banner with title",
  title: "Page title",
  contacts: "Contacts",
};

const it = (label: string, body: string, extra = ""): PageItem => ({ label, body, extra });

/** A new row for a block's repeating array (the "+" on a focused block). */
export function newPageItem(type: PageBlockType): PageItem {
  switch (type) {
    case "section":
      return { kind: "para", ...it("", "A new paragraph.") };
    case "stats":
      return it("00", "What this number counts");
    case "pillars":
      return it("Area", "What we do in this area, in a sentence or two.");
    case "compare":
      return it("Area", "Before", "Today");
    case "asks":
      return it("Opportunity", "What it is, and how a partner could help.");
    case "photos":
      return it("Title", "A short line");
    case "contacts":
      return it("Name Surname", "Role, team", "name@unicef.org");
    default:
      return it("", "");
  }
}

const DEFAULTS: Record<PageBlockType, () => PageBlock> = {
  banner: () => ({ type: "banner", heading: "A headline that says what this piece is about" }),
  title: () => ({ type: "title", heading: "How this works", highlight: "this" }),
  section: () => ({
    type: "section",
    rail: "Section label",
    items: [{ kind: "para", ...it("", "Running text for this section. Say one thing per paragraph, with the figures that back it.") }],
  }),
  stats: () => ({
    type: "stats",
    accent: -1,
    items: [it("54", "Countries engaged"), it("2.3M", "Schools mapped"), it("44k+", "Schools connected")],
  }),
  figure: () => ({ type: "figure", body: "" }),
  pillars: () => ({
    type: "pillars",
    items: [
      { ...it("Mapping", "What we do, in a sentence or two."), icon: "map-pin" },
      { ...it("Procurement", "What we do, in a sentence or two."), icon: "handshake" },
      { ...it("Financing", "What we do, in a sentence or two."), icon: "hand-coins" },
    ],
  }),
  compare: () => ({
    type: "compare",
    heading: "Progress since the start",
    sub: "Before",
    lead: "Today",
    items: [
      { ...it("Area", "Where it stood", "Where it stands"), group: "Country" },
      { ...it("Area", "Where it stood", "Where it stands"), group: "Country" },
    ],
  }),
  asks: () => ({
    type: "asks",
    heading: "Opportunities for partnership",
    items: [it("Opportunity", "What it is, and how a partner could help.")],
  }),
  photos: () => ({
    type: "photos",
    rail: "In the field",
    items: [it("Title", "A short line"), it("Title", "A short line")],
  }),
  panels: () => ({
    type: "panels",
    accent: 1,
    items: [it("What is running", "- A first point\n- A second point"), it("What we ask", "- A first ask\n- A second ask")],
  }),
  contacts: () => ({ type: "contacts", rail: "Contact", items: [it("Name Surname", "Role, team", "name@unicef.org")] }),
};

export function defaultBlock(type: PageBlockType): PageBlock {
  return DEFAULTS[type]();
}

/** A blank page added by hand: one text section to start from. */
export function presetStack(): PageBlock[] {
  return [defaultBlock("section")];
}
