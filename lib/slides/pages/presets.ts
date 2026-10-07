import type { PageBlock, PageBlockType, PageItem } from "./schema";

/**
 * What a block looks like when the user adds it by hand: short placeholder
 * copy in the shape the block expects, so the page shows what goes where.
 */

/** The block menu's names, in the order the menu lists them. */
/** Without "compare", dropped for the table on 7 Oct 2026. */
export const BLOCK_LABELS: Record<Exclude<PageBlockType, "compare">, string> = {
  title: "Page title",
  heading: "Heading",
  section: "Text section",
  stats: "Stat cards",
  pillars: "Three pillars",
  figure: "Image or map",
  asks: "Opportunities",
  panels: "Two panels",
  photos: "Photo cards",
  banner: "Banner with title",
  contacts: "Contacts",
  lede: "Intro paragraph",
  callout: "Status note",
  split: "Panel with picture",
  screens: "Two screenshots",
  numbered: "Numbered asks",
  table: "Table",
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
    case "numbered":
      return it("", "What we ask, in a full sentence.");
    case "table":
      return it("Row", "Now", "Next");
    case "screens":
      return it("", "");
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
  contacts: () => ({ type: "contacts", rail: "Contact", lead: "", items: [it("Name Surname", "Role, team", "name@unicef.org")] }),
  heading: () => ({ type: "heading", heading: "What comes next" }),
  lede: () => ({ type: "lede", body: "One or two sentences that say what this piece is and why it matters now." }),
  callout: () => ({ type: "callout", lead: "Status:", body: "Concept and prototype. No production software yet." }),
  split: () => ({ type: "split", tag: "Phase 1", body: "What this phase covers, where and with whom, in two or three sentences." }),
  screens: () => ({ type: "screens", rail: "", items: [it("", ""), it("", "")] }),
  numbered: () => ({ type: "numbered", rail: "Our ask", items: [it("", "The first thing we ask, in a full sentence."), it("", "The second thing we ask.")] }),
  table: () => ({
    type: "table",
    rail: "",
    heading: "Category",
    sub: "Current",
    lead: "Future",
    items: [it("Row", "Where it stands", "Where it goes"), it("Row", "Where it stands", "Where it goes")],
  }),
};

export function defaultBlock(type: PageBlockType): PageBlock {
  return DEFAULTS[type]();
}

/** A blank page added by hand: one text section to start from. */
export function presetStack(): PageBlock[] {
  return [defaultBlock("section")];
}
