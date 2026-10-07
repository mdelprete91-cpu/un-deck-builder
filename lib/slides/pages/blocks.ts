import { esc, item } from "../layouts/shared";
import { ICON_LIBRARY, iconInner } from "../icons";
import { countryMapSrc, isCountryMap } from "../country-maps";
import { DEFAULT_PHOTO } from "../library";
import type { BrandTheme } from "../brand";
import type { ImagePos } from "../schema";
import { CALLOUT_TONES, panelTone, tableCells, tableHeads, type PageBlock, type PageBlockType, type PageItem } from "./schema";
import { PALETTE, type Density, edP, firstBaseline, FONT, GRID, LS, pt, TYPE } from "./a4";

/**
 * The block renderers. Each returns markup in normal flow, full page width,
 * with the 24pt side margins inside it; the stacker (render.ts) puts the gaps
 * between blocks. Geometry is build.py's, in pt.
 */
export interface BlockCtx {
  t: BrandTheme;
  d: Density;
  /** State path of this block, e.g. "stack.3". */
  path: string;
}
export type BlockRender = (b: PageBlock, ctx: BlockCtx) => string;

/** A neutral screen, for a screenshot slot not yet filled. */
export const SCREEN_PLACEHOLDER = "/pages/screen-placeholder.svg";

/** The dark data-viz strip of the Estonia pieces: the banner's default. */
export const DEFAULT_BANNER = "/pages/banner-dataviz.jpg";

const M = GRID.margin;
const ACCENT = "var(--accent)";

/** A full-width row: the 24pt margins on both sides. */
function full(inner: string, extra = ""): string {
  return `<div style="margin:0 ${pt(M)};width:${pt(GRID.full)};${extra}">${inner}</div>`;
}

/** Label column + text column, as build.py's `section()`. */
function railRow(left: string, right: string, extra = ""): string {
  return (
    `<div style="display:grid;grid-template-columns:${pt(GRID.label)} ${pt(GRID.body)};column-gap:${pt(GRID.gutter)};margin:0 ${pt(M)};${extra}">` +
    `<div style="min-width:0;">${left}</div><div style="min-width:0;">${right}</div></div>`
  );
}

/** A block's side column, or the full width when its side title was removed. */
function side(b: PageBlock, left: string, right: string, extra = ""): string {
  return b.wide ? full(right, extra) : railRow(left, right, extra);
}

/**
 * The accent label of a section. Pulled up so its first baseline sits on the
 * first baseline of the body beside it, as build.py's `label()` does.
 */
function railLabel(value: string | undefined, path: string, d: Density): string {
  if (value === undefined) return "";
  const shift = firstBaseline(12, 18) - firstBaseline(d.body, d.lh);
  return `<div ${edP(path)} style="${TYPE.label}color:${ACCENT};margin-top:${pt(-shift)};white-space:pre-line;">${esc(value)}</div>`;
}

/** An image slot that fills its box: cover crop with the reframe focal point. */
function photo(path: string, src: string | undefined, fallback: string, pos?: ImagePos, radius = 0): string {
  const p = pos ?? { x: 50, y: 50, zoom: 1 };
  return (
    `<div style="position:absolute;inset:0;overflow:hidden;border-radius:${pt(radius)};">` +
    `<img src="${esc(src || fallback)}" data-image="${path}" alt="" style="width:100%;height:100%;display:block;object-fit:cover;` +
    `object-position:${p.x}% ${p.y}%;transform:scale(${p.zoom});transform-origin:${p.x}% ${p.y}%;"></div>`
  );
}

/** A paragraph with an optional bold lead-in ("Namibia. By the end of 2024…"). */
function leadPara(path: string, it: PageItem, style: string, extra = ""): string {
  const lead = it.label ? `<span ${edP(`${path}.label`)} style="font-weight:700;">${esc(it.label)}</span> ` : "";
  return `<div style="${style}${extra}">${lead}<span ${edP(`${path}.body`)}>${esc(it.body)}</span></div>`;
}

/** Headline image with the title over it (build.py:307). */
const banner: BlockRender = (b, { path }) =>
  full(
    `<div style="position:relative;min-height:${pt(112)};border-radius:${pt(6)};overflow:hidden;display:flex;align-items:center;">` +
      photo(`${path}.image`, b.image, DEFAULT_BANNER, b.imagePos, 6) +
      // A left-hand scrim so white type reads on any photo, not only the dark strip.
      `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.25) 60%,rgba(0,0,0,0) 100%);pointer-events:none;"></div>` +
      `<div ${edP(`${path}.heading`)} style="position:relative;margin:${pt(19)} ${pt(20)};width:${pt(380)};${TYPE.banner}color:${PALETTE.white};white-space:pre-line;">${esc(b.heading ?? "")}</div>` +
      `</div>`,
  );

/** Page title, one phrase in the accent (build.py:336). */
const title: BlockRender = (b, { path }) => {
  const text = b.heading ?? "";
  const hl = (b.highlight ?? "").trim();
  const at = hl ? text.indexOf(hl) : -1;
  const inner =
    at >= 0
      ? `${esc(text.slice(0, at))}<span style="color:${ACCENT};">${esc(hl)}</span>${esc(text.slice(at + hl.length))}`
      : esc(text);
  return full(`<div ${edP(`${path}.heading`)} style="${TYPE.title}color:${PALETTE.ink};white-space:pre-line;">${inner}</div>`);
};

/** The workhorse: a labelled run of paragraphs and bullets (build.py `section`). */
const section: BlockRender = (b, { path, d }) => {
  const items = b.items ?? [];
  // A numbered point counts within its own run ("1. 2. 3." on Spectrum's asks).
  let n = 0;
  const body = items
    .map((it, i) => {
      const p = `${path}.items.${i}`;
      const listed = it.kind === "bullet" || it.kind === "number";
      n = it.kind === "number" ? n + 1 : 0;
      const tight = listed && items[i - 1]?.kind === it.kind;
      const gap = i === 0 ? "" : `margin-top:${pt(tight ? d.para / 2 : d.para)};`;
      const indent = it.kind === "number" ? 17 : it.kind === "bullet" ? 12 : 0;
      const marker =
        it.kind === "bullet"
          ? `<span style="position:absolute;left:${pt(2)};top:${pt(d.lh / 2 - 1.5)};width:${pt(3)};height:${pt(3)};border-radius:50%;background:${PALETTE.ink};"></span>`
          : it.kind === "number"
            ? `<span style="position:absolute;left:0;top:0;width:${pt(14)};text-align:right;${TYPE.body(d)}color:${PALETTE.ink};">${n}.</span>`
            : "";
      return (
        `<div ${item(p)} style="position:relative;${gap}">` +
        leadPara(p, it, `${TYPE.body(d)}color:${PALETTE.ink};white-space:pre-line;${indent ? `padding-left:${pt(indent)};position:relative;` : ""}`).replace(/<\/div>$/, `${marker}</div>`) +
        `</div>`
      );
    })
    .join("");
  return side(b, railLabel(b.rail, `${path}.rail`, d), body);
};

/** A title inside the page, opening a new part: the page title's voice, smaller. */
const heading: BlockRender = (b, { path }) =>
  full(`<div ${edP(`${path}.heading`)} style="${TYPE.heading}color:${PALETTE.ink};white-space:pre-line;">${esc(b.heading ?? "")}</div>`);

/** The paragraph under a page title, across the full width (Lunar). */
const lede: BlockRender = (b, { path, d }) =>
  full(`<div ${edP(`${path}.body`)} style="${TYPE.body(d)}color:${PALETTE.ink};white-space:pre-line;">${esc(b.body ?? "")}</div>`);

/** A bordered note on the state of things, its lead word in orange (Spectrum, Lunar: "Status:"). */
// A mini banner on a tint of its colour (Mario, 7 Oct 2026), orange unless picked.
const callout: BlockRender = (b, { path, d }) => {
  const tone = CALLOUT_TONES[b.tone ?? "orange"] ?? CALLOUT_TONES.orange;
  return full(
    `<div style="box-sizing:border-box;background:${tone.tint};border-radius:${pt(6)};padding:${pt(8)} ${pt(12)};${TYPE.body(d)}color:${PALETTE.ink};">` +
      `<span ${edP(`${path}.lead`)} style="font-weight:700;color:${tone.solid};">${esc(b.lead ?? "")}</span> ` +
      `<span ${edP(`${path}.body`)} style="white-space:pre-line;">${esc(b.body ?? "")}</span></div>`,
  );
};

/** A framed panel: a pill and text on the left, a picture or map on the right (Songbird's Phase 1). */
const split: BlockRender = (b, { path, d }) => {
  const isMap = isCountryMap(b.map);
  const pic = isMap
    ? `<div style="position:absolute;inset:0;background:#1C1C1C;"><img src="${countryMapSrc(b.map!)}" data-image="${path}.image" alt="" style="width:100%;height:100%;object-fit:contain;display:block;"></div>`
    : photo(`${path}.image`, b.image, DEFAULT_PHOTO, b.imagePos);
  return full(
    `<div style="display:grid;grid-template-columns:${pt(193)} minmax(0,1fr);min-height:${pt(209)};box-sizing:border-box;border:1pt solid ${PALETTE.card};border-radius:${pt(6)};overflow:hidden;">` +
      `<div style="padding:${pt(12)} ${pt(12)} ${pt(14)};">` +
      `<span ${edP(`${path}.tag`)} style="display:inline-block;padding:${pt(3)} ${pt(10)};border-radius:999px;background:${ACCENT};color:${PALETTE.white};font-family:${FONT.open};font-weight:600;font-size:9pt;line-height:13pt;">${esc(b.tag ?? "")}</span>` +
      `<div ${edP(`${path}.body`)} style="${TYPE.body(d)}color:${PALETTE.ink};margin-top:${pt(12)};white-space:pre-line;">${esc(b.body ?? "")}</div></div>` +
      `<div style="position:relative;background:#EDF4FC;">${pic}</div></div>`,
  );
};

/** Two screenshots with arrows between them, the second on a tinted panel (Spectrum, Lunar). */
const screens: BlockRender = (b, { path, d }) => {
  const [a, c] = b.items ?? [];
  const shot = (i: number, it: PageItem | undefined, panel: boolean) =>
    `<div style="position:relative;min-width:0;${panel ? `background:#E3F4FC;border-radius:${pt(6)};padding:${pt(8)};` : ""}">` +
    `<div style="position:relative;height:${pt(panel ? 154 : 170)};border-radius:${pt(6)};overflow:hidden;${panel ? "" : `border:1pt solid ${PALETTE.card};box-sizing:border-box;`}">` +
    // A screenshot reads from its top left corner, where an app keeps its header.
    photo(`${path}.items.${i}.image`, it?.image, SCREEN_PLACEHOLDER, it?.imagePos ?? { x: 0, y: 0, zoom: 1 }, 6) +
    `</div></div>`;
  const arrow = `<svg viewBox="0 0 24 24" width="${pt(16)}" height="${pt(16)}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;color:${ACCENT};">${ICON_LIBRARY["arrow-right"]}</svg>`;
  const arrows = `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:${pt(14)};">${arrow}${arrow}${arrow}</div>`;
  const row = `<div style="display:grid;grid-template-columns:minmax(0,1fr) ${pt(28)} minmax(0,1.5fr);align-items:center;">${shot(0, a, false)}${arrows}${shot(1, c, true)}</div>`;
  return b.rail && !b.wide ? railRow(railLabel(b.rail, `${path}.rail`, d), row) : full(row);
};

/** Numbered asks in accent circles, in the text column (Songbird's US/FCC ask). */
const numbered: BlockRender = (b, { path, d }) => {
  const rows = (b.items ?? [])
    .map(
      (it, i) =>
        `<div ${item(`${path}.items.${i}`)} style="position:relative;display:grid;grid-template-columns:${pt(16)} minmax(0,1fr);column-gap:${pt(9)};${i ? `margin-top:${pt(12)};` : ""}">` +
        `<span style="width:${pt(16)};height:${pt(16)};margin-top:${pt((d.lh - 16) / 2)};border-radius:50%;background:${ACCENT};color:${PALETTE.white};font-family:${FONT.open};font-weight:600;font-size:8pt;line-height:${pt(16)};text-align:center;">${i + 1}</span>` +
        `<div ${edP(`${path}.items.${i}.body`)} style="${TYPE.body(d)}color:${PALETTE.ink};white-space:pre-line;">${esc(it.body)}</div></div>`,
    )
    .join("");
  return side(b, railLabel(b.rail, `${path}.rail`, d), rows);
};

/** A three-column table with a grey header row, in the text column (Lunar). */
const table: BlockRender = (b, { path, d }) => {
  // Two to five columns; a long cell wraps onto more lines (Mario, 7 Oct 2026).
  const heads = tableHeads(b);
  const own = !!b.heads?.length;
  const cell = `padding:${pt(8)} ${pt(heads.length > 3 ? 8 : 10)};font-family:${FONT.open};font-size:${pt(d.small + 0.5)};line-height:${pt(d.smallLh + 1.5)};${LS}color:${PALETTE.ink};overflow-wrap:anywhere;white-space:pre-line;`;
  const grid = `display:grid;grid-template-columns:repeat(${heads.length},minmax(0,1fr));`;
  const headPath = (j: number) => (own ? `${path}.heads.${j}` : `${path}.${(["heading", "sub", "lead"] as const)[j]}`);
  const cellPath = (i: number, j: number) => (own ? `${path}.items.${i}.cells.${j}` : `${path}.items.${i}.${(["label", "body", "extra"] as const)[j]}`);
  const head =
    `<div style="${grid}background:#F4F4F4;border-radius:${pt(4)} ${pt(4)} 0 0;">` +
    heads.map((h, j) => `<div ${edP(headPath(j))} style="${cell}font-weight:600;">${esc(h)}</div>`).join("") +
    `</div>`;
  const rows = (b.items ?? [])
    .map(
      (it, i) =>
        `<div ${item(`${path}.items.${i}`)} style="position:relative;${grid}border-bottom:0.5pt solid ${PALETTE.hairline};">` +
        tableCells(b, it).map((c, j) => `<div ${edP(cellPath(i, j))} style="${cell}">${esc(c)}</div>`).join("") +
        `</div>`,
    )
    .join("");
  const t = `<div style="border:0.5pt solid ${PALETTE.hairline};border-bottom:none;border-radius:${pt(4)};">${head}${rows}</div>`;
  return side(b, railLabel(b.rail, `${path}.rail`, d), t);
};

/** Figures in stroked cards, one accented (build.py `stat`). */
const stats: BlockRender = (b, { path }) => {
  const items = b.items ?? [];
  const n = items.length;
  // Never more than three in a row (Mario, 7 Oct 2026): four make two rows of two.
  const cols = n === 4 || n === 2 ? 2 : 3;
  const dense = false;
  const cards = items
    .map((it, i) => {
      const on = b.accent === i;
      return (
        `<div ${item(`${path}.items.${i}`)} style="position:relative;box-sizing:border-box;min-height:${pt(82)};padding:${pt(dense ? 10 : 12.5)} ${pt(dense ? 10 : 12.5)} ${pt(11)};` +
        `border:1pt solid ${on ? PALETTE.orangeBorder : PALETTE.card};border-radius:${pt(6)};">` +
        `<div ${edP(`${path}.items.${i}.label`)} style="${TYPE.stat}${dense ? "font-size:22pt;line-height:28pt;" : ""}color:${on ? PALETTE.orange : PALETTE.ink};overflow-wrap:anywhere;">${esc(it.label)}</div>` +
        `<div ${edP(`${path}.items.${i}.body`)} style="font-family:${FONT.open};font-size:9pt;line-height:12pt;${LS}color:${PALETTE.ink};margin-top:${pt(4)};">${esc(it.body)}</div>` +
        `</div>`
      );
    })
    .join("");
  return side(
    b,
    "",
    `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${pt(GRID.cardGap)};">${cards}</div>`,
  );
};

/** A full-width image or country map with an optional caption (build.py:339). */
const figure: BlockRender = (b, { path, d }) => {
  const isMap = isCountryMap(b.map);
  const img = isMap
    ? `<div style="position:absolute;inset:0;background:#1C1C1C;border-radius:${pt(6)};overflow:hidden;"><img src="${countryMapSrc(b.map!)}" data-image="${path}.image" alt="" style="width:100%;height:100%;object-fit:contain;display:block;"></div>`
    : photo(`${path}.image`, b.image, DEFAULT_PHOTO, b.imagePos, 6);
  const caption =
    b.body !== undefined && b.body !== ""
      ? `<div ${edP(`${path}.body`)} style="${TYPE.small(d)}color:${PALETTE.grey};margin-top:${pt(6)};">${esc(b.body)}</div>`
      : b.body !== undefined
        ? `<div ${edP(`${path}.body`)} data-empty-field style="${TYPE.small(d)}color:${PALETTE.grey};margin-top:${pt(6)};display:none;"></div>`
        : "";
  return full(`<div style="position:relative;height:${pt(178)};">${img}</div>${caption}`);
};

/** Three areas of work with an icon each (build.py:359). */
const pillars: BlockRender = (b, { path, d }) => {
  const cols = (b.items ?? [])
    .map((it, i) => {
      const icon = it.icon && ICON_LIBRARY[it.icon] ? ICON_LIBRARY[it.icon] : iconInner(it.icon, i);
      return (
        `<div ${item(`${path}.items.${i}`)} style="position:relative;padding-right:${pt(8)};">` +
        `<svg data-icon-pick="${path}.items.${i}.icon" viewBox="0 0 24 24" width="${pt(18)}" height="${pt(18)}" fill="none" stroke="${"currentColor"}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;color:${ACCENT};width:${pt(18)};height:${pt(18)};">${icon}</svg>` +
        `<div ${edP(`${path}.items.${i}.label`)} style="${TYPE.head(d)}color:${PALETTE.ink};margin-top:${pt(10)};">${esc(it.label)}</div>` +
        `<div ${edP(`${path}.items.${i}.body`)} style="font-family:${FONT.open};font-size:${pt(d.small)};line-height:${pt(d.smallLh + 2)};${LS}color:${PALETTE.ink};margin-top:${pt(3)};">${esc(it.body)}</div>` +
        `</div>`
      );
    })
    .join("");
  // A side title when the piece gives one ("How UNICEF works", US partnerships piece).
  return side(b, railLabel(b.rail || undefined, `${path}.rail`, d), `<div style="display:grid;grid-template-columns:repeat(${Math.max(2, (b.items ?? []).length)},minmax(0,1fr));column-gap:${pt(5)};">${cols}</div>`);
};

/** Before / today, by group (investment.py `progress_table`). */
const compare: BlockRender = (b, { path, d }) => {
  // Drawn as the table block is (Mario, 7 Oct 2026: the column heads floated
  // above the first group and its black rule was too heavy): one grey header
  // row, a group as a light band across the table, hairlines between rows.
  const cell = `padding:${pt(6)} ${pt(10)};font-family:${FONT.open};font-size:9pt;line-height:12.5pt;${LS}`;
  const grid = `display:grid;grid-template-columns:${pt(GRID.label - 10)} minmax(0,1fr) minmax(0,1fr);`;
  const items = b.items ?? [];
  let lastGroup: string | undefined;
  const rows = items
    .map((it, i) => {
      const p = `${path}.items.${i}`;
      const g = (it.group ?? "").trim();
      const head =
        g && g !== lastGroup
          ? `<div ${edP(`${p}.group`)} style="${cell}font-weight:700;background:${PALETTE.panel};border-bottom:0.5pt solid ${PALETTE.hairline};">${esc(g)}</div>`
          : "";
      lastGroup = g;
      return (
        head +
        `<div ${item(p)} style="position:relative;${grid}border-bottom:0.5pt solid ${PALETTE.hairline};">` +
        `<div ${edP(`${p}.label`)} style="${cell}color:${PALETTE.grey};">${esc(it.label)}</div>` +
        `<div ${edP(`${p}.body`)} style="${cell}color:${PALETTE.ink};">${esc(it.body)}</div>` +
        `<div ${edP(`${p}.extra`)} style="${cell}color:${PALETTE.ink};">${esc(it.extra)}</div>` +
        `</div>`
      );
    })
    .join("");
  const headRow =
    `<div style="${grid}background:#F4F4F4;border-bottom:0.5pt solid ${PALETTE.hairline};">` +
    `<div></div>` +
    `<div ${edP(`${path}.sub`)} style="${cell}font-weight:600;color:${PALETTE.grey};">${esc(b.sub ?? "")}</div>` +
    `<div ${edP(`${path}.lead`)} style="${cell}font-weight:600;color:${ACCENT};">${esc(b.lead ?? "")}</div>` +
    `</div>`;
  return full(
    `<div ${edP(`${path}.heading`)} style="${TYPE.label}color:${ACCENT};">${esc(b.heading ?? "")}</div>` +
      `<div style="margin-top:${pt(d.para + 2)};border:0.5pt solid ${PALETTE.hairline};border-bottom:none;border-radius:${pt(4)};overflow:hidden;">${headRow}${rows}</div>`,
  );
};

/** A full-width head, then one labelled row per opportunity (investment.py:239). */
const asks: BlockRender = (b, { path, d }) => {
  const rows = (b.items ?? [])
    .map(
      (it, i) =>
        `<div ${item(`${path}.items.${i}`)} style="position:relative;display:grid;grid-template-columns:${pt(GRID.label)} ${pt(GRID.body)};column-gap:${pt(GRID.gutter)};margin-top:${pt(i === 0 ? d.para + 2 : 12)};">` +
        `<div ${edP(`${path}.items.${i}.label`)} style="${TYPE.head(d)}font-weight:700;color:${PALETTE.ink};">${esc(it.label)}</div>` +
        `<div ${edP(`${path}.items.${i}.body`)} style="${TYPE.body(d)}color:${PALETTE.ink};white-space:pre-line;">${esc(it.body)}</div></div>`,
    )
    .join("");
  return full(`<div ${edP(`${path}.heading`)} style="${TYPE.label}color:${ACCENT};">${esc(b.heading ?? "")}</div>${rows}`);
};

/** Photo cards, two across the text column (template frame 6). */
const photos: BlockRender = (b, { path, d }) => {
  const cards = (b.items ?? [])
    .map(
      (it, i) =>
        `<div ${item(`${path}.items.${i}`)} style="position:relative;background:${PALETTE.panel};border-radius:${pt(6)};overflow:hidden;">` +
        `<div style="position:relative;height:${pt(101)};">${photo(`${path}.items.${i}.image`, it.image, DEFAULT_PHOTO, it.imagePos)}</div>` +
        `<div style="padding:${pt(8)} ${pt(10)} ${pt(10)};">` +
        `<div ${edP(`${path}.items.${i}.label`)} style="font-family:${FONT.open};font-weight:600;font-size:11pt;line-height:15pt;${LS}color:${PALETTE.ink};">${esc(it.label)}</div>` +
        `<div ${edP(`${path}.items.${i}.body`)} style="${TYPE.small(d)}color:${PALETTE.ink};margin-top:${pt(2)};">${esc(it.body)}</div>` +
        `</div></div>`,
    )
    .join("");
  return side(
    b,
    railLabel(b.rail, `${path}.rail`, d),
    `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:${pt(8)};">${cards}</div>`,
  );
};

/**
 * Two columns compared, as on the US partnerships piece (Mario, 7 Oct 2026):
 * each under its own head, grey or a colour (the ask in orange by default,
 * any of CALLOUT_TONES picked in the side bar). A column is written in lines:
 * "# " a bold subhead, "- " a bullet, "**Name**: text" a bold lead, the rest
 * paragraphs. The markers stay in the text, drawn at size 0, so an edit read
 * back with innerText keeps them. A long block runs on to the next page as a
 * continuation without its heads (flowOver splits it by line, data-line).
 */
const panels: BlockRender = (b, { path, d }) => {
  // Zero size and zero line height: in the text, never in the layout.
  const hide = (m: string) => `<span style="font-size:0;line-height:0;">${esc(m)}</span>`;
  // **bold** anywhere in a line.
  const inline = (t: string) =>
    t
      .split(/(\*\*[^*]+\*\*)/)
      .map((part) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part);
        return m ? `${hide("**")}<strong style="font-weight:700;">${esc(m[1])}</strong>${hide("**")}` : esc(part);
      })
      .join("");
  const cols = (b.items ?? [])
    .map((it, i) => {
      const tone = panelTone(b, i);
      const grey = tone === "grey";
      const c = CALLOUT_TONES[tone as keyof typeof CALLOUT_TONES];
      const lines = it.body.split("\n").filter((l) => l.trim());
      const body = lines
        .map((l, j) => {
          const line = `data-line="${i}.${j}"`;
          if (/^#\s/.test(l))
            return `<div ${line} style="font-weight:700;margin-top:${pt(j ? 12 : 2)};">${hide("# ")}${esc(l.replace(/^#\s/, ""))}</div>`;
          if (/^[-•]\s/.test(l))
            return (
              `<div ${line} style="position:relative;padding-left:${pt(12)};margin-top:${pt(4)};">` +
              `<span style="position:absolute;left:${pt(2)};top:${pt(d.lh / 2 - 1.5)};width:${pt(3)};height:${pt(3)};border-radius:50%;background:${PALETTE.ink};"></span>` +
              `${hide("- ")}${inline(l.replace(/^[-•]\s/, ""))}</div>`
            );
          return `<div ${line} style="margin-top:${pt(j ? 4 : 2)};">${inline(l)}</div>`;
        })
        .join("");
      const head = b.cont
        ? ""
        : `<div ${edP(`${path}.items.${i}.label`)} style="${TYPE.head(d)}padding:${pt(8)} ${pt(12)};background:${grey ? PALETTE.panel : c.solid};color:${grey ? PALETTE.ink : PALETTE.white};">${esc(it.label)}</div>`;
      return (
        `<div ${item(`${path}.items.${i}`)} style="position:relative;display:flex;flex-direction:column;border-radius:${pt(b.cont ? 0 : 6)} ${pt(b.cont ? 0 : 6)} ${pt(6)} ${pt(6)};overflow:hidden;background:${grey ? PALETTE.white : c.tint};">` +
        head +
        `<div ${edP(`${path}.items.${i}.body`)} style="flex:1;${TYPE.body(d)}color:${PALETTE.ink};padding:${pt(b.cont ? 4 : 8)} ${pt(12)} ${pt(12)};">${body}</div>` +
        `</div>`
      );
    })
    .join("");
  return full(`<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:${pt(8)};">${cols}</div>`);
};

/** Who to write to, under a hairline, last on the last page. */
const contacts: BlockRender = (b, { path, d }) => {
  // One person a row, as on Spectrum: "Name / role", the address under it.
  const people = (b.items ?? [])
    .map(
      (it, i) =>
        `<div ${item(`${path}.items.${i}`)} style="position:relative;${i || b.lead ? `margin-top:${pt(12)};` : ""}${TYPE.body(d)}color:${PALETTE.ink};">` +
        `<span ${edP(`${path}.items.${i}.label`)} style="font-weight:700;">${esc(it.label)}</span> / ` +
        `<span ${edP(`${path}.items.${i}.body`)}>${esc(it.body)}</span>` +
        `<div ${edP(`${path}.items.${i}.extra`)} style="color:${PALETTE.ink};text-decoration:underline;text-underline-offset:2pt;">${esc(it.extra)}</div></div>`,
    )
    .join("");
  const lead = b.lead ? `<div ${edP(`${path}.lead`)} style="${TYPE.body(d)}font-weight:700;color:${PALETTE.ink};">${esc(b.lead)}</div>` : "";
  return (
    `<div style="margin:0 ${pt(M)} ${pt(18)};height:0;border-top:0.75pt solid ${PALETTE.card};"></div>` +
    side(b, railLabel(b.rail, `${path}.rail`, d), lead + people)
  );
};

export const BLOCKS: Record<PageBlockType, BlockRender> = {
  banner,
  title,
  heading,
  section,
  stats,
  figure,
  pillars,
  compare,
  asks,
  photos,
  panels,
  contacts,
  lede,
  callout,
  split,
  screens,
  numbered,
  table,
};

/**
 * Space above a block, after `prev`. The section gap of the density, with
 * build.py's exceptions: stats sit closer to the text they belong to, and a
 * banner or title is followed by a little more air.
 */
export function spaceBefore(prev: PageBlockType, next: PageBlockType, d: Density): number {
  // The intro paragraph sits under its title, as on Lunar.
  if (next === "lede") return Math.round(d.gap * 0.45);
  if (next === "stats" || next === "pillars") return Math.round(d.gap * 0.75);
  if (prev === "banner") return d.gap + 4;
  if (prev === "title") return d.gap - 4;
  // What a heading opens sits under it.
  if (prev === "heading") return Math.round(d.gap * 0.5);
  return d.gap;
}
