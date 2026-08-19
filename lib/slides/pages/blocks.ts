import type { BrandTheme } from "../brand";
import { esc, item } from "../layouts/shared";
import { iconInner } from "../icons";
import type { PageBlock, PageBlockType } from "./schema";
import { edP, fitAttr, GRID, PALETTE, pt, TYPE } from "./a4";

/**
 * The block renderers. Each one draws itself from y=0 inside a wrapper the
 * stacker positions, using page x coordinates (24, 136, …) so the grid stays
 * literal, and reports its own height in pt so the stacker knows where the
 * next block starts.
 *
 * Every number here comes from the ten approved boards. Nothing is rounded to
 * something tidier and nothing is invented.
 */
export interface BlockCtx {
  t: BrandTheme;
  /** State path of this block, e.g. "stack.3". */
  path: string;
}
export interface Rendered {
  html: string;
  height: number;
}
export type BlockRender = (b: PageBlock, ctx: BlockCtx) => Rendered;

/**
 * Average glyph advance in em, measured over all the text of the ten boards
 * (Open Sans regular came out at 0.457 across 8, 9 and 10pt).
 * Used to guess how many lines a string takes, because a renderer is a pure
 * string function and cannot measure the DOM.
 */
const EM = { body: 0.457, semi: 0.49, bold: 0.508, title: 0.455 } as const;

/**
 * Lines never fill their column — the last word of each wraps early — so the
 * estimate is deliberately generous. Overestimating costs a little white
 * space; underestimating would make autofit shrink the text, which is visible.
 */
const FILL = 0.9;

/** Estimated line count for `text` in a column `width` pt wide. */
export function lineCount(value: string, width: number, size: number, em: number = EM.body): number {
  const perLine = Math.max(4, (width / (size * em)) * FILL);
  return (value || "")
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
}

/** Vertical rhythm, measured off the boards. */
const LH = { title: 39, body: 16, tight: 15, rail: 18, caption: 12 } as const;

/** List indent: bullet and number markers sit in this gutter. */
const INDENT = 15;

/** A rounded box: fill, stroke, or the accent tint used behind figures. */
function box(
  x: number,
  y: number,
  w: number,
  h: number,
  o: { radius?: number; fill?: string; stroke?: string; tint?: boolean } = {},
): string {
  const r = o.radius ?? 5.5;
  const base = `position:absolute;left:${pt(x)};top:${pt(y)};width:${pt(w)};height:${pt(h)};border-radius:${pt(r)};`;
  const parts: string[] = [];
  // The tint is a separate layer at 20% rather than a baked rgba, so it stays
  // the brand accent whatever the theme is.
  if (o.tint) parts.push(`<div style="${base}background:var(--accent);opacity:.2;"></div>`);
  if (o.fill) parts.push(`<div style="${base}background:${o.fill};"></div>`);
  if (o.stroke) parts.push(`<div style="${base}border:1pt solid ${o.stroke};box-sizing:border-box;"></div>`);
  return parts.join("");
}

/** A text node with its own fit budget, in page coordinates. */
function text(
  path: string,
  value: string,
  x: number,
  y: number,
  w: number,
  height: number,
  style: string,
  color: string = PALETTE.ink,
): string {
  return (
    `<div ${edP(path, height)} style="position:absolute;left:${pt(x)};top:${pt(y)};width:${pt(w)};` +
    `${style}color:${color};white-space:pre-line;">${esc(value)}</div>`
  );
}

/** A line that opens with a bold lead-in: two editable spans, one fit budget. */
function leadLine(
  basePath: string,
  lead: string | undefined,
  bodyText: string,
  x: number,
  y: number,
  w: number,
  height: number,
  style: string,
  extraAttrs = "",
): string {
  const inner = lead
    ? `<span ${edP(`${basePath}.label`)} style="font-weight:700;">${esc(lead)}</span> ` +
      `<span ${edP(`${basePath}.body`)}>${esc(bodyText)}</span>`
    : `<span ${edP(`${basePath}.body`)}>${esc(bodyText)}</span>`;
  return (
    `<div ${extraAttrs} ${fitAttr(height)} style="position:absolute;left:${pt(x)};top:${pt(y)};width:${pt(w)};` +
    `${style}color:${PALETTE.ink};white-space:pre-line;">${inner}</div>`
  );
}

function railLabel(value: string | undefined, path: string): { html: string; height: number } {
  if (!value) return { html: "", height: 0 };
  const height = lineCount(value, GRID.rail.w, 12, EM.semi) * LH.rail;
  return {
    html: text(`${path}.rail`, value, GRID.rail.x, 0, GRID.rail.w, height, TYPE.rail, "var(--accent)"),
    height,
  };
}

const title: BlockRender = (b, { path }) => {
  const value = b.heading ?? "";
  const height = lineCount(value, GRID.full.w, 30, EM.title) * LH.title;
  return {
    html: text(`${path}.heading`, value, GRID.full.x, 0, GRID.full.w, height, TYPE.title),
    height,
  };
};

/**
 * The paragraph under a title. Takes a bold lead-in like a prose line does,
 * because that is how the boards open ("UNICEF's Digital Inclusion team
 * advises, advocates and acts…").
 */
const lede: BlockRender = (b, { path }) => {
  const whole = [b.lead, b.body].filter(Boolean).join(" ");
  const height = lineCount(whole, GRID.full.w, 10) * LH.body;
  const inner = b.lead
    ? `<span ${edP(`${path}.lead`)} style="font-weight:700;">${esc(b.lead)}</span> ` +
      `<span ${edP(`${path}.body`)}>${esc(b.body ?? "")}</span>`
    : `<span ${edP(`${path}.body`)}>${esc(b.body ?? "")}</span>`;
  return {
    html:
      `<div ${fitAttr(height)} style="position:absolute;left:${pt(GRID.full.x)};top:0;width:${pt(GRID.full.w)};` +
      `${TYPE.body}color:${PALETTE.ink};white-space:pre-line;">${inner}</div>`,
    height,
  };
};

/**
 * The workhorse: an accent label in the rail beside a run of lines in the
 * content column. A line is a paragraph, a bullet or a numbered item, and it
 * can open with a bold lead-in.
 *
 * The lead-in is a second editable span inside the line rather than markup
 * inside one editable node: `SlideFrame` commits `innerText`, so a `<b>` the
 * user typed over would vanish with no error. The fit budget sits on the line
 * itself, and the spans inherit the shrunken size.
 */
const railProse: BlockRender = (b, { path }) => {
  const rail = railLabel(b.rail, path);
  const parts: string[] = [rail.html];
  let y = 0;
  let counter = 0;
  (b.items ?? []).forEach((it, i) => {
    const listed = it.kind === "bullet" || it.kind === "number";
    if (it.kind === "number") counter += 1;
    else if (it.kind !== "bullet") counter = 0;
    const left = GRID.content.x + (listed ? INDENT : 0);
    const width = GRID.content.w - (listed ? INDENT : 0);
    const ip = `${path}.items.${i}`;
    const height = lineCount([it.label, it.body].filter(Boolean).join(" "), width, 10) * LH.body;
    if (listed) {
      const marker = it.kind === "number" ? `${counter}.` : "•";
      parts.push(
        `<div style="position:absolute;left:${pt(GRID.content.x)};top:${pt(y)};width:${pt(INDENT)};` +
          `${TYPE.body}color:${PALETTE.ink};">${marker}</div>`,
      );
    }
    parts.push(leadLine(ip, it.label, it.body, left, y, width, height, TYPE.body, item(ip)));
    y += height;
  });
  return { html: parts.join(""), height: Math.max(rail.height, y) };
};

/**
 * The status box: a peach-bordered panel with an orange lead-in. Two of the
 * ten boards open with one, both 546x73 with the text inset 12.5.
 */
const statusCallout: BlockRender = (b, { path }) => {
  const inset = 12.5;
  const w = GRID.full.w - inset * 2;
  const lines = lineCount([b.lead, b.body].filter(Boolean).join(" "), w, 10) * LH.tight;
  const height = Math.max(73, lines + 13);
  const inner =
    `<span ${edP(`${path}.lead`)} style="font-weight:600;color:${PALETTE.orange};">${esc(b.lead || "Status:")}</span> ` +
    `<span ${edP(`${path}.body`)}>${esc(b.body ?? "")}</span>`;
  return {
    html:
      box(GRID.full.x + 0.5, 0, GRID.full.w, height, { stroke: PALETTE.orangeBorder }) +
      `<div ${fitAttr(height - 13)} style="position:absolute;left:${pt(GRID.full.x + inset)};top:2.5pt;` +
      `width:${pt(w)};${TYPE.bodyTight}color:${PALETTE.ink};white-space:pre-line;">${inner}</div>`,
    height,
  };
};

/**
 * Stat cards, three to a row. One card can be accented (peach border, orange
 * number), which is how the boards flag the number that matters.
 */
const statCards: BlockRender = (b, { path }) => {
  const items = b.items ?? [];
  const { xs, w } = GRID.cards3;
  const inset = 12;
  const textW = w - inset * 2;
  const rows = Math.ceil(items.length / 3);
  const rowHeights: number[] = [];
  for (let r = 0; r < rows; r++) {
    const captionLines = Math.max(
      ...items.slice(r * 3, r * 3 + 3).map((it) => lineCount(it.body, textW, 9)),
      1,
    );
    rowHeights.push(45.5 + captionLines * LH.caption + 12.5);
  }
  const parts: string[] = [];
  let bottom = 0;
  items.forEach((it, i) => {
    const row = Math.floor(i / 3);
    const top = rowHeights.slice(0, row).reduce((a, h) => a + h + 5, 0);
    const x = xs[i % 3];
    const h = rowHeights[row];
    const accented = b.accent === i;
    const ip = `${path}.items.${i}`;
    parts.push(
      box(x, top, w, h, { stroke: accented ? PALETTE.orangeBorder : PALETTE.hairline }) +
        `<span ${item(ip)} style="position:absolute;left:${pt(x)};top:${pt(top)};width:${pt(w)};height:${pt(h)};"></span>` +
        text(`${ip}.label`, it.label, x + inset, top + 14, textW, 30, TYPE.stat, accented ? PALETTE.orange : PALETTE.ink) +
        text(`${ip}.body`, it.body, x + inset, top + 45.5, textW, h - 58, TYPE.caption),
    );
    bottom = top + h;
  });
  return { html: parts.join(""), height: bottom };
};

/** Icon, label, paragraph: three columns of what a team actually does. */
const iconColumns: BlockRender = (b, { path }) => {
  const items = (b.items ?? []).slice(0, 3);
  const { xs, w } = GRID.icons3;
  const bodyLines = Math.max(...items.map((it) => lineCount(it.body, w, 10)), 1);
  const height = 48.5 + bodyLines * LH.body;
  const parts = items.map((it, i) => {
    const x = xs[i];
    const ip = `${path}.items.${i}`;
    return (
      `<svg data-icon-pick="${ip}.icon" width="21" height="21" viewBox="0 0 24 24" fill="none" ` +
      `stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ` +
      `style="position:absolute;left:${pt(x + 1.5)};top:0;">${iconInner(it.icon, i)}</svg>` +
      `<span ${item(ip)} style="position:absolute;left:${pt(x)};top:0;width:${pt(w)};height:${pt(height)};"></span>` +
      text(`${ip}.label`, it.label, x, 31.5, w, LH.body, TYPE.head) +
      text(`${ip}.body`, it.body, x, 48.5, w, bodyLines * LH.body, TYPE.body)
    );
  });
  return { html: parts.join(""), height };
};

/** A photo slot with reframe support, in page coordinates. */
function photo(src: string | undefined, path: string, x: number, y: number, w: number, h: number, pos: { x: number; y: number; zoom: number } | undefined, radius: string): string {
  const p = pos ?? { x: 50, y: 50, zoom: 1 };
  return (
    `<div style="position:absolute;left:${pt(x)};top:${pt(y)};width:${pt(w)};height:${pt(h)};overflow:hidden;border-radius:${radius};">` +
    `<img src="${esc(src || "/giga-placeholder.jpg")}" data-image="${path}" alt="" class="af" ` +
    `style="width:100%;height:100%;object-fit:cover;object-position:${p.x}% ${p.y}%;transform:scale(${p.zoom});transform-origin:${p.x}% ${p.y}%;"></div>`
  );
}

/** Photo cards: image on top, title and caption on the grey panel below. */
const photoCards: BlockRender = (b, { path }) => {
  const items = b.items ?? [];
  const { xs, w } = GRID.photos2;
  const cardH = 162;
  const inset = 16;
  const parts: string[] = [];
  items.forEach((it, i) => {
    const x = xs[i % 2];
    const top = Math.floor(i / 2) * (cardH + 8);
    const ip = `${path}.items.${i}`;
    parts.push(
      box(x, top, w, cardH, { radius: 6, fill: PALETTE.panel }) +
        photo(it.image, `${ip}.image`, x, top, w, 101, it.imagePos, `${pt(6)} ${pt(6)} 0 0`) +
        `<span ${item(ip)} style="position:absolute;left:${pt(x)};top:${pt(top)};width:${pt(w)};height:${pt(cardH)};"></span>` +
        text(`${ip}.label`, it.label, x + inset, top + 117, w - inset * 2, LH.body, TYPE.head) +
        text(`${ip}.body`, it.body, x + inset, top + 134, w - inset * 2, LH.caption * 2, TYPE.caption),
    );
  });
  const rows = Math.max(1, Math.ceil(items.length / 2));
  return { html: parts.join(""), height: rows * cardH + (rows - 1) * 8 };
};

/**
 * The two headed columns of the partnership boards: one neutral, one filled
 * with the attention colour, each holding its own run of prose.
 */
const twoColPanels: BlockRender = (b, { path }) => {
  const bandH = 31;
  const parts: string[] = [];
  let maxBody = 0;
  (b.items ?? []).slice(0, 2).forEach((it, i) => {
    const col = GRID.cols2[i];
    const filled = b.accent === i;
    const ip = `${path}.items.${i}`;
    const lines = lineCount(it.body, col.w - 20, 10) * LH.tight;
    maxBody = Math.max(maxBody, lines);
    parts.push(
      box(col.x, 0, col.w, bandH, { radius: 0, fill: filled ? PALETTE.orange : PALETTE.panel }) +
        text(`${ip}.label`, it.label, col.x + 16, 8.5, col.w - 32, LH.body, TYPE.rail, filled ? PALETTE.white : PALETTE.ink) +
        text(`${ip}.body`, it.body, col.x + 10, bandH + 12, col.w - 20, lines, TYPE.bodyTight),
    );
  });
  return { html: parts.join(""), height: bandH + 12 + maxBody };
};

/** A framed figure: text panel on the left, image on the right, optional pill. */
const figureSplit: BlockRender = (b, { path }) => {
  const height = 209;
  const imgX = 230;
  const imgW = GRID.full.x + GRID.full.w - imgX;
  const inset = 12.5;
  const textTop = b.tag ? 44 : inset;
  const textW = imgX - GRID.full.x - inset * 2;
  const bodyLines = lineCount(b.body ?? "", textW, 10) * LH.body;
  return {
    html:
      box(GRID.full.x + 0.5, 0, GRID.full.w, height, { fill: PALETTE.white, stroke: PALETTE.hairline }) +
      photo(b.image, `${path}.image`, imgX, 0, imgW, height, b.imagePos, `0 ${pt(5.5)} ${pt(5.5)} 0`) +
      (b.tag
        ? box(GRID.full.x + inset, inset, 53, 22, { radius: 11, fill: "var(--accent)" }) +
          text(`${path}.tag`, b.tag, GRID.full.x + inset, inset + 5, 53, LH.body, `${TYPE.caption}text-align:center;`, PALETTE.white)
        : "") +
      text(`${path}.body`, b.body ?? "", GRID.full.x + inset, textTop, textW, Math.min(bodyLines, height - textTop - inset), TYPE.body),
    height,
  };
};

/** Screens with arrows between them: a before, a flow, an after. */
const screensFlow: BlockRender = (b, { path }) => {
  const items = b.items ?? [];
  const height = 197;
  const panelX = 303.5;
  const panelW = GRID.full.x + GRID.full.w - panelX;
  const inset = 11;
  const parts: string[] = [];
  if (items[0]) {
    parts.push(photo(items[0].image, `${path}.items.0.image`, GRID.content.x - 0.5, 1, 120, 165, items[0].imagePos, pt(5.5)));
  }
  // Three arrows down the gap, exactly as the boards draw them.
  [33, 71, 109].forEach((y) => {
    parts.push(
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" ` +
        `stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:${pt(265.9)};top:${pt(y)};">${iconInner("arrow-right", 0)}</svg>`,
    );
  });
  parts.push(box(panelX, 0, panelW, height, { radius: 6.5, tint: true, stroke: "var(--accent)" }));
  const rest = items.slice(1);
  let y = inset;
  rest.forEach((it, i) => {
    const single = rest.length === 1;
    const h = single ? height - inset * 2 : i === 0 ? 108 : 144;
    parts.push(
      photo(it.image, `${path}.items.${i + 1}.image`, panelX + inset, y, single ? panelW - inset * 2 : 120, Math.min(h, height - y - inset), it.imagePos, pt(5.5)),
    );
    y += 111;
  });
  return { html: parts.join(""), height };
};

/** A three-column table: grey header row, hairline rules, one outer round. */
const tableBlock: BlockRender = (b, { path }) => {
  const cols = GRID.icons3;
  const headH = 30;
  const cellPad = 10;
  const rows = b.items ?? [];
  const parts: string[] = [];
  const headerFields = ["heading", "sub", "lead"] as const;
  const headerCells = [b.heading, b.sub, b.lead];
  cols.xs.forEach((x, c) => {
    parts.push(
      box(x, 0, cols.w, headH, { radius: 0, fill: PALETTE.panelSoft, stroke: PALETTE.hairline }) +
        text(`${path}.${headerFields[c]}`, headerCells[c] ?? "", x + cellPad, 9, cols.w - cellPad * 2, LH.body, TYPE.head),
    );
  });
  let y = headH;
  const cellFields = ["label", "body", "extra"] as const;
  rows.forEach((it, r) => {
    const cells = [it.label, it.body, it.extra];
    const h = Math.max(30, Math.max(...cells.map((v) => lineCount(v, cols.w - cellPad * 2, 10))) * LH.body + 14);
    cols.xs.forEach((x, c) => {
      parts.push(
        box(x, y, cols.w, h, { radius: 0, stroke: PALETTE.hairline }) +
          text(`${path}.items.${r}.${cellFields[c]}`, cells[c], x + cellPad, y + 9, cols.w - cellPad * 2, h - 14, TYPE.body),
      );
    });
    parts.push(
      `<span ${item(`${path}.items.${r}`)} style="position:absolute;left:${pt(cols.xs[0])};top:${pt(y)};width:${pt(GRID.content.w)};height:${pt(h)};"></span>`,
    );
    y += h;
  });
  parts.push(box(GRID.content.x, 0, GRID.content.w, y, { radius: 6, stroke: PALETTE.hairline }));
  return { html: parts.join(""), height: y };
};

/** Numbered asks: an accent disc and a paragraph. */
const numberedBadges: BlockRender = (b, { path }) => {
  const items = b.items ?? [];
  const d = 22;
  const textX = GRID.content.x + 34;
  const textW = GRID.full.x + GRID.full.w - textX;
  const parts: string[] = [];
  let y = 0;
  items.forEach((it, i) => {
    const ip = `${path}.items.${i}`;
    const lines = lineCount(it.body, textW, 10) * LH.body;
    parts.push(
      box(GRID.content.x + 3, y, d, d, { radius: d / 2, fill: "var(--accent)" }) +
        `<div style="position:absolute;left:${pt(GRID.content.x + 3)};top:${pt(y + 4)};width:${pt(d)};${TYPE.caption}color:${PALETTE.white};text-align:center;">${i + 1}</div>` +
        `<span ${item(ip)} style="position:absolute;left:${pt(GRID.content.x)};top:${pt(y)};width:${pt(GRID.content.w)};height:${pt(Math.max(d, lines))};"></span>` +
        text(`${ip}.body`, it.body, textX, y + 3, textW, lines, TYPE.body),
    );
    y += Math.max(d, lines) + 14;
  });
  return { html: parts.join(""), height: Math.max(0, y - 14) };
};

/** Who to write to: name in bold, role, and a real mailto link. */
const contacts: BlockRender = (b, { path }) => {
  const rail = railLabel(b.rail, path);
  const parts: string[] = [rail.html];
  let y = 0;
  (b.items ?? []).forEach((it, i) => {
    const ip = `${path}.items.${i}`;
    parts.push(leadLine(ip, it.label, it.body, GRID.content.x, y, GRID.content.w, LH.body, TYPE.body, item(ip)));
    y += LH.body;
    if (it.extra) {
      // The address becomes a link only when it looks like one: esc() would
      // happily pass a "javascript:" string straight into the href.
      const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(it.extra.trim()) ? it.extra.trim() : "";
      const label = `<span ${edP(`${ip}.extra`)} style="text-decoration:underline;">${esc(it.extra)}</span>`;
      parts.push(
        `<div style="position:absolute;left:${pt(GRID.content.x)};top:${pt(y)};width:${pt(GRID.content.w)};${TYPE.body}color:${PALETTE.ink};">` +
          (mail ? `<a href="mailto:${esc(mail)}" style="color:inherit;text-decoration:none;">${label}</a>` : label) +
          `</div>`,
      );
      y += LH.body;
    }
    y += 16;
  });
  return { html: parts.join(""), height: Math.max(rail.height, Math.max(0, y - 16)) };
};

/** A hairline across the page, the way the contact block is introduced. */
const divider: BlockRender = () => ({
  html: `<div style="position:absolute;left:${pt(20)};top:0;width:${pt(551)};height:1pt;background:${PALETTE.rule};"></div>`,
  height: 1,
});

export const BLOCKS: Record<PageBlockType, { label: string; render: BlockRender }> = {
  title: { label: "Title", render: title },
  lede: { label: "Intro paragraph", render: lede },
  "rail-prose": { label: "Label + text", render: railProse },
  "status-callout": { label: "Status callout", render: statusCallout },
  "stat-cards": { label: "Stat cards", render: statCards },
  "icon-columns": { label: "Icon columns", render: iconColumns },
  "photo-cards": { label: "Photo cards", render: photoCards },
  "two-col-panels": { label: "Two columns", render: twoColPanels },
  "figure-split": { label: "Figure + text", render: figureSplit },
  "screens-flow": { label: "Screens", render: screensFlow },
  table: { label: "Table", render: tableBlock },
  "numbered-badges": { label: "Numbered asks", render: numberedBadges },
  contacts: { label: "Contacts", render: contacts },
  divider: { label: "Divider", render: divider },
};

/**
 * Space above a block when it follows another one.
 *
 * Measured off the boards through the CSS box model — first baseline minus
 * half-leading and ascent — not off eyeballed bounding boxes: text to text is
 * a consistent 6pt, 8 under a title, and a framed block sits about 18 clear.
 */
export const SPACE_BEFORE: Record<PageBlockType, number> = {
  title: 8,
  lede: 8,
  "rail-prose": 6,
  "status-callout": 12,
  "stat-cards": 18.5,
  "icon-columns": 17.5,
  "photo-cards": 18,
  "two-col-panels": 18,
  "figure-split": 24,
  "screens-flow": 24,
  table: 14,
  "numbered-badges": 14,
  contacts: 16,
  divider: 20,
};

/** Framed blocks sit a little clear of the text that follows them, too. */
const BOXED: ReadonlySet<PageBlockType> = new Set<PageBlockType>([
  "status-callout",
  "stat-cards",
  "icon-columns",
  "photo-cards",
  "two-col-panels",
  "figure-split",
  "screens-flow",
  "table",
]);

/**
 * The gap between two stacked blocks. A title carries its own trailing space
 * (8pt on the boards) whatever follows it.
 */
export function spaceBetween(prev: PageBlockType, next: PageBlockType): number {
  if (prev === "title") return 8;
  return SPACE_BEFORE[next] + (BOXED.has(prev) ? 2.5 : 0);
}
