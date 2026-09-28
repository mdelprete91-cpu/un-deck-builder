import type { Slide, Block, LayoutId } from "../schema";
import { TAKEAWAY_LAYOUTS } from "../schema";
import { ICON_LIBRARY } from "../icons";
import type { BrandTheme } from "../brand";
import { MANROPE, OPEN_SANS, HAIRLINE, esc, ed, dly, item, columns, section, footer, heading60 } from "./shared";
import { seriesColors } from "./charts";

/**
 * Dense layouts (28 Sep 2026, drawn for Mario to approve): the slides of a
 * consulting-style investment case, where a slide carries 150-250 words and
 * every figure has to stay (the Gambia joint investment case, 38 slides).
 * They are the existing grammar at a denser scale, nothing new in colour or
 * type: the 60px title of four-cards and list (two lines here), the #F7F7F7
 * card of four-cards, the accent label of the callout, the list's hairline,
 * the chart's grid and series colours, and one accent band for the key
 * message, the surface the closing slide already uses.
 *
 * Body text is Open Sans 500 at 24px, the smallest step that keeps a column
 * of 70 words readable; every text group sizes its children in em from one
 * container that carries the `data-fit` budget, so a whole list shrinks as
 * one and never overlaps what is below. The containers keep 28px on the
 * right so the editor's delete ✕ (it overhangs an item by 24px) is never
 * read as overflow.
 */

/**
 * Where the content starts: under a two-line 60px title (100 + 144 + 28), or
 * 72px higher when the title is short enough for one line (at most 50
 * characters; Manrope 500 at 60px averages about 29px a character on 1720px).
 * The title's budget follows, so a guess that is wrong shrinks the title
 * rather than running it into the content.
 */
export const oneLine = (s: Slide, width = 1720) => (s.title ?? "").trim().length <= Math.floor((64 * width) / 1720);
export const topOf = (s: Slide, width = 1720) => (oneLine(s, width) ? 172 : 244);
// Dense slides sit higher than the standard ones (title at 72, not 100) so
// the content ends 30px clear of the logo, not touching it.
export const TITLE_TOP = 72;
export const BOTTOM = 900;
export const BAND_H = 124;
export const GAP = 24;
export const DENSE = `font-family:${OPEN_SANS};font-weight:500;font-size:24px;line-height:1.4;color:#000000;`;
export const HEAD = (px: number, color = "var(--accent)") =>
  `font-family:${MANROPE};font-weight:600;font-size:${px}px;line-height:1.3;letter-spacing:-.01em;color:${color};`;
export const CARD = "#F7F7F7";

export function title(s: Slide, color = "#000000", width = 1720, left = 100): string {
  return heading60(s.title ?? "", "title", color, left, width, oneLine(s, width) ? 76 : 150, TITLE_TOP);
}

/**
 * A block's points with their edit paths: `items` when it has them, else its
 * `body` as one point (a block added with "Add element" has only a body).
 */
export function pointsOf(b: Block, i: number): { text: string; path: string }[] {
  if (b.items?.length) return b.items.map((text, j) => ({ text, path: `blocks.${i}.items.${j}` }));
  return b.body?.trim() ? [{ text: b.body, path: `blocks.${i}.body` }] : [];
}

/**
 * A bullet list in em: a point is an accent dot and its text; a point that
 * starts with a dash is a sub-point, indented, the en dash its marker. The
 * dash is part of the text, so editing never loses the level.
 */
export function bullets(
  points: { text: string; path: string }[],
  fit: number,
  group?: string,
  head?: { path: string; text?: string; color?: string },
  /** On an accent surface: white text and dots. */
  ink?: { text: string; dot: string },
): string {
  const rows = points
    .map(({ text, path }) => {
      const sub = /^[-–]\s/.test(text);
      return sub
        ? `<div style="padding-left:.94em;"><div ${ed(path)} style="padding-left:.9em;text-indent:-.9em;">${esc(text.replace(/^-\s/, "– "))}</div></div>`
        : `<div style="display:flex;gap:.6em;">` +
            `<span style="flex:0 0 auto;width:.34em;height:.34em;margin-top:.53em;border-radius:50%;background:${ink?.dot ?? "var(--accent)"};"></span>` +
            `<div ${ed(path)} style="flex:1;min-width:0;">${esc(text)}</div>` +
            `</div>`;
    })
    .join("");
  // The header, when there is one, is inside the budget: header and points
  // shrink as one, and a short header leaves its room to the points.
  const top = head
    ? `<div ${ed(head.path)} style="font-family:${MANROPE};font-weight:600;font-size:1.25em;line-height:1.3;letter-spacing:-.01em;color:${head.color ?? "var(--accent)"};margin-bottom:.35em;">${esc(head.text)}</div>`
    : "";
  return `<div data-fit="${fit}"${group ? ` data-fit-group="${group}"` : ""} style="${DENSE}${ink ? `color:${ink.text};` : ""}padding-right:28px;display:flex;flex-direction:column;gap:.45em;">${top}${rows}</div>`;
}

/** The key message under the content: white on the accent, full width. */
export function band(s: Slide, y: number): string {
  return (
    `<div class="ars" style="position:absolute;left:100px;top:${y}px;width:1720px;height:${BAND_H}px;box-sizing:border-box;background:var(--accent);padding:0 48px;display:flex;align-items:center;${dly(30)}">` +
    `<div ${ed("support", 92)} style="width:100%;${HEAD(30, "#FFFFFF")}">${esc(s.support)}</div>` +
    `</div>`
  );
}

export const hasBand = (s: Slide) => !!s.support?.trim();

/**
 * Bullet columns (slides 4, 6, 17, 23, 24, 26, 27 of the Gambia case): one to
 * three cards side by side, a header in the accent and up to eight points
 * each, and the key message in the band below when there is one.
 */
export function bulletColumns(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 3);
  const { xs, width } = columns(Math.max(blocks.length, 1));
  const bottom = hasBand(s) ? BOTTOM - BAND_H - GAP : BOTTOM;
  const h = bottom - TOP;
  const cards = blocks
    .map(
      (b, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:${TOP}px;width:${width}px;height:${h}px;box-sizing:border-box;background:${CARD};padding:32px 8px 28px 36px;display:flex;flex-direction:column;gap:18px;${dly(8 + i * 8)}">` +
        bullets(pointsOf(b, i), h - 60, "cols", { path: `blocks.${i}.label`, text: b.label }) +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) + cards + (hasBand(s) ? band(s, bottom + GAP) : "") + footer(t, "light"),
  );
}

/**
 * The takeaway (Mario approved it on figures-panel, 28 Sep 2026): the key
 * message's band (the same 124px accent surface, white Manrope 30px) with a
 * white icon circle at its left, one sentence closing the slide. `path` is
 * the field it edits: `takeaway` on the layouts in TAKEAWAY_LAYOUTS
 * (schema.ts), `support` where a layout owns the band (cascade's goal). The
 * band is the deletable item; its ✕ removes the field (DELETE_ITEM).
 */
export function takeawayBand(t: BrandTheme, text: string | undefined, y: number, path = "takeaway", glyph = "lightbulb"): string {
  const c = 72;
  return (
    `<div class="ars" ${item(path)} style="position:absolute;left:100px;top:${y}px;width:1720px;height:${BAND_H}px;box-sizing:border-box;background:var(--accent);padding:0 48px 0 26px;display:flex;align-items:center;gap:28px;${dly(30)}">` +
    `<div style="flex:0 0 auto;width:${c}px;height:${c}px;border-radius:50%;background:#FFFFFF;display:flex;align-items:center;justify-content:center;">${icon(glyph, Math.round(c * 0.52), t.accent)}</div>` +
    `<div ${ed(path, BAND_H - 32)} style="flex:1;min-width:0;${HEAD(30, "#FFFFFF")}">${esc(text)}</div>` +
    `</div>`
  );
}

/** A Lucide icon at a size and colour (the layouts own the wrapper, as on icon-cards). */
function icon(name: string, px: number, color: string, stroke = 2): string {
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="display:block;">${ICON_LIBRARY[name] ?? ""}</svg>`;
}

export const hasTakeaway = (s: Slide) => TAKEAWAY_LAYOUTS.has(s.layoutId) && !!s.takeaway?.trim();

/**
 * Figures and commentary (slides 12, 30, 34): rows named in the left column
 * (Outcome, Benefits, Costs), their figures in the middle, each a value in
 * the accent over its caption, and the commentary on the same row at the
 * right. `subtitle` and `support` head the two columns; `takeaway` closes
 * the slide in its band.
 *
 * Every part is deletable in the editor and the rest re-flows:
 * - a row (its ✕ at the top left), a figure, a commentary point, a row's
 *   whole commentary (its ✕ at the commentary's top left), the headers row
 *   (both headers go together), the takeaway band;
 * - a row without figures gives its commentary the figures' column;
 * - with no commentary on any row the figures take the full width, in a grid
 *   of as many columns as the busiest row has figures (two to four), and the
 *   commentary header is not drawn;
 * - without the headers the rule goes with them and the rows move up;
 * - with a takeaway the rows end above the band and the figures pair up two
 *   to a line to give the height back (a figure with no value is a lead
 *   line, "(cumulative 5-years):", and takes the whole line); without one
 *   the slide is the approved figures-panel, geometry for geometry.
 */
export function figuresPanel(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 4);
  const X = { label: 100, figures: 360, comment: 1180 };
  const W = { label: 236, figures: 780, comment: 640 };
  const takeaway = hasTakeaway(s);
  const commented = blocks.some((b, i) => pointsOf(b, i).length > 0);
  const figW = commented ? W.figures : 1820 - X.figures;
  const headed = !!s.subtitle?.trim() || (commented && !!s.support?.trim());
  // Full width: one grid column per figure of the busiest row, two to four.
  const across = Math.min(4, Math.max(2, ...blocks.map((b) => (b.stats ?? []).filter((f) => f.value.trim()).length)));
  const grid = !commented ? across : takeaway ? 2 : 0;
  const heads = headed
    ? `<div class="ars" ${item("subtitle,support")} style="position:absolute;left:${X.figures}px;top:${TOP}px;width:${figW}px;${dly(6)}"><div ${ed("subtitle", 40)} style="${HEAD(30)}">${esc(s.subtitle)}</div></div>` +
      (commented
        ? `<div class="ars" ${item("subtitle,support")} style="position:absolute;left:${X.comment}px;top:${TOP}px;width:${W.comment}px;${dly(6)}"><div ${ed("support", 40)} style="${HEAD(30)}">${esc(s.support)}</div></div>`
        : "") +
      `<div style="position:absolute;left:100px;top:${TOP + 56}px;width:1720px;height:2px;background:var(--accent);"></div>`
    : "";
  const rows = blocks
    .map((b, i) => {
      const stats = b.stats ?? [];
      const figures = stats
        .map(
          (f, j) =>
            `<div ${item(`blocks.${i}.stats.${j}`)}${grid && !f.value.trim() ? ` style="grid-column:1/-1;"` : ""}><div ${ed(`blocks.${i}.stats.${j}.value`)} style="font-family:${MANROPE};font-weight:600;font-size:1.25em;line-height:1.25;letter-spacing:-.01em;color:var(--accent);">${esc(f.value)}</div>` +
            `<div ${ed(`blocks.${i}.stats.${j}.label`)} style="margin-top:.1em;">${esc(f.label)}</div></div>`,
        )
        .join("");
      const points = pointsOf(b, i);
      const comment = points
        .map(
          ({ text, path }) =>
            `<div ${item(path)} style="display:flex;gap:.6em;"><span style="flex:0 0 auto;width:.34em;height:.34em;margin-top:.53em;border-radius:50%;background:var(--accent);"></span><div ${ed(path)} style="flex:1;min-width:0;">${esc(text)}</div></div>`,
        )
        .join("");
      const figStyle = grid
        ? `display:grid;grid-template-columns:repeat(${grid},minmax(0,1fr));align-content:start;gap:.55em 32px;`
        : `display:flex;flex-direction:column;gap:.55em;`;
      return (
        `<div class="ars" ${item(`blocks.${i}`, "left")} style="display:flex;gap:24px;padding:.75em 0;border-bottom:1px solid ${HAIRLINE};${dly(10 + i * 6)}">` +
        `<div ${ed(`blocks.${i}.label`)} style="flex:0 0 ${W.label}px;font-family:${MANROPE};font-weight:600;font-size:1.2em;line-height:1.3;color:#000000;">${esc(b.label)}</div>` +
        (stats.length ? `<div style="${commented ? `flex:0 0 ${W.figures}px` : "flex:1;min-width:0"};${figStyle}">${figures}</div>` : "") +
        // The commentary keeps its 40px as a margin, so its ✕ (top left)
        // sits by the first point, clear of the figures' and the row's.
        (points.length
          ? `<div ${item(`blocks.${i}.items`, "left")} style="flex:1;min-width:0;margin-left:${stats.length ? 40 : 0}px;display:flex;flex-direction:column;gap:.45em;">${comment}</div>`
          : commented
            ? `<div style="flex:1;min-width:0;"></div>`
            : "") +
        `</div>`
      );
    })
    .join("");
  const zoneTop = headed ? TOP + 72 : TOP;
  const zoneBottom = takeaway ? BOTTOM - BAND_H - GAP : BOTTOM;
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      heads +
      `<div data-fit="${zoneBottom - zoneTop}" style="position:absolute;left:100px;top:${zoneTop}px;width:1748px;box-sizing:border-box;padding-right:28px;${DENSE}display:flex;flex-direction:column;">${rows}</div>` +
      (takeaway ? takeawayBand(t, s.takeaway, BOTTOM - BAND_H) : "") +
      footer(t, "light"),
  );
}

/**
 * Scenarios (slide 3): two or three options one under the other, each named
 * on an accent tile with its points beside it, and the conclusion in a panel
 * on the right (`subtitle` heads it, `bullets` are its points). Without
 * conclusion points the rows run the full width.
 */
export function scenarios(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 3);
  const n = Math.max(blocks.length, 1);
  const panel = (s.bullets ?? []).some((b) => b.trim());
  const right = panel ? 1260 : 1820;
  const rowH = Math.floor((BOTTOM - TOP - GAP * (n - 1)) / n);
  const TILE = 280;
  const rows = blocks
    .map((b, i) => {
      const y = TOP + i * (rowH + GAP);
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:100px;top:${y}px;width:${right - 100}px;height:${rowH}px;${dly(8 + i * 8)}">` +
        `<div style="position:absolute;left:0;top:0;width:${TILE}px;height:${rowH}px;box-sizing:border-box;background:var(--accent);padding:28px;display:flex;align-items:center;">` +
        `<div ${ed(`blocks.${i}.label`, rowH - 56)} style="${HEAD(32, "#FFFFFF")}">${esc(b.label)}</div></div>` +
        `<div style="position:absolute;left:${TILE}px;top:0;width:${right - 100 - TILE}px;height:${rowH}px;box-sizing:border-box;background:${CARD};padding:26px 8px 20px 36px;">` +
        bullets(pointsOf(b, i), rowH - 46, "scenarios") +
        `</div></div>`
      );
    })
    .join("");
  const side = panel
    ? `<div class="ars" style="position:absolute;left:1300px;top:${TOP}px;width:520px;height:${BOTTOM - TOP}px;box-sizing:border-box;border-top:4px solid var(--accent);padding:28px 0 0 0;display:flex;flex-direction:column;gap:18px;${dly(24)}">` +
      bullets(
        (s.bullets ?? []).map((text, j) => ({ text, path: `bullets.${j}` })),
        BOTTOM - TOP - 32,
        undefined,
        { path: "subtitle", text: s.subtitle, color: "#000000" },
      ) +
      `</div>`
    : "";
  return section(t, "#FFFFFF", "#000000", title(s) + rows + side + footer(t, "light"));
}

/**
 * Matrix (slides 8 and 10): one to three rows, each named on an accent tile,
 * across two to five cells with a heading and a line or two (the impact
 * pathways, each with its figure for the country). Cells are the row's
 * `stats`: `label` is the heading, `value` the text. A key message in the
 * band below when there is one.
 */
export function matrix(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const blocks = (s.blocks ?? []).slice(0, 3);
  const n = Math.max(blocks.length, 1);
  const bottom = hasBand(s) ? BOTTOM - BAND_H - GAP : BOTTOM;
  const rowH = Math.floor((bottom - TOP - GAP * (n - 1)) / n);
  const TILE = 240;
  const CGAP = 16;
  const rows = blocks
    .map((b, i) => {
      const cells = (b.stats ?? []).slice(0, 5);
      const m = Math.max(cells.length, 1);
      const cw = Math.floor((1720 - TILE - CGAP - CGAP * (m - 1)) / m);
      const y = TOP + i * (rowH + GAP);
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:100px;top:${y}px;width:1720px;height:${rowH}px;${dly(8 + i * 8)}">` +
        `<div style="position:absolute;left:0;top:0;width:${TILE}px;height:${rowH}px;box-sizing:border-box;background:var(--accent);padding:24px;display:flex;align-items:center;">` +
        `<div ${ed(`blocks.${i}.label`, rowH - 48)} style="${HEAD(30, "#FFFFFF")}">${esc(b.label)}</div></div>` +
        cells
          .map(
            (c, j) =>
              `<div style="position:absolute;left:${TILE + CGAP + j * (cw + CGAP)}px;top:0;width:${cw}px;height:${rowH}px;box-sizing:border-box;background:${CARD};padding:22px 4px 18px 24px;">` +
              `<div data-fit="${rowH - 40}" data-fit-group="matrix" style="${DENSE}font-size:22px;padding-right:20px;">` +
              `<div ${ed(`blocks.${i}.stats.${j}.label`)} style="font-family:${MANROPE};font-weight:600;font-size:1.05em;line-height:1.3;color:var(--accent);">${esc(c.label)}</div>` +
              `<div ${ed(`blocks.${i}.stats.${j}.value`)} style="margin-top:.4em;">${esc(c.value)}</div>` +
              `</div></div>`,
          )
          .join("") +
        `</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) + rows + (hasBand(s) ? band(s, bottom + GAP) : "") + footer(t, "light"),
  );
}

/** A 2px accent connector, horizontal or vertical. */
const rule = (x: number, y: number, w: number, h: number) =>
  `<div style="position:absolute;left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;background:var(--accent);"></div>`;

/** Boxes of one tier: `m` entries sharing `w` px from `x`, `IN` px apart. */
function tierBoxes(x: number, w: number, m: number, gap: number): { x: number; w: number }[] {
  const bw = (w - (m - 1) * gap) / m;
  return Array.from({ length: m }, (_, j) => ({ x: x + j * (bw + gap), w: bw }));
}

/**
 * Cascade (the Gambia case's "National reform momentum", approved 28 Sep
 * 2026): policies cascading to objectives, converging on one goal.
 *
 * Data model, kept flat on purpose:
 * - each block is a group: `label` heads it on an accent bar spanning its
 *   columns; `items` are its policies (the upper tier; a block added with
 *   Element has only `body`, drawn as its one policy); `stats[j].value` are
 *   its objectives (the lower tier, `label` unused);
 * - `support` is the goal, on the band with its icon circle.
 * A group takes as many columns as its longer tier, and the shorter tier
 * shares the group's width evenly: two objectives under four policies span
 * two policies each, one policy over two objectives spans both. No explicit
 * links: the order and the counts are the mapping.
 *
 * Re-flow after a deletion: the groups share the 1720px by their column
 * counts; a group with only one tier gives it the full height (no arrows);
 * the arrows run from the centres of the tier with more entries, or of the
 * other tier when one of those would land between two boxes; the lowest box
 * of every column drops onto one rule that falls into the goal, and without
 * a goal the rule goes and the tiers take the height.
 */
export function cascade(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const groups = (s.blocks ?? []).slice(0, 4).map((b, i) => ({
    label: b.label,
    policies: pointsOf(b, i),
    objectives: (b.stats ?? []).map((st, j) => ({ text: st.value, path: `blocks.${i}.stats.${j}` })),
  }));
  const spans = groups.map((g) => Math.max(g.policies.length, g.objectives.length, 1));
  const total = spans.reduce((a, b) => a + b, 0);
  const IN = 16; // between the columns of a group
  const OUT = 36; // between groups
  const inner = spans.reduce((a, n) => a + (n - 1) * IN, 0) + (groups.length - 1) * OUT;
  const cw = (1720 - inner) / Math.max(total, 1);
  const goal = !!s.support?.trim();
  const bandY = BOTTOM - BAND_H;
  const JOIN = 44; // the drops and the rule over the band
  const floor = goal ? bandY - JOIN : BOTTOM;
  const HDR = 64;
  const polY = TOP + HDR + 16;
  const ARROW = 56;
  const polH = Math.round((floor - polY - ARROW) * 0.44);
  const objY = polY + polH + ARROW;

  // A policy over its objectives is centred in its card; a card that runs
  // the whole height (the group has one tier) reads from the top, like every
  // other dense card. A card wider than half the slide centres its text,
  // under the arrow and over the drop.
  const card = (text: string, path: string, x: number, y: number, w: number, h: number, kind: "policy" | "objective", cs: number, middle = false) =>
    `<div class="ars" ${item(path)} style="position:absolute;left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;box-sizing:border-box;background:${CARD};` +
    (kind === "objective" ? `border-top:4px solid var(--accent);padding:18px 4px 16px 18px;` : `padding:20px 4px 16px 18px;`) +
    `align-items:${middle ? "center" : "flex-start"};${w > 900 ? "text-align:center;" : ""}` +
    `display:flex;${dly(cs)}">` +
    `<div ${ed(kind === "policy" ? path : `${path}.value`, Math.round(h) - 40)} data-fit-group="cascade-${kind}" style="${kind === "policy" ? `font-family:${MANROPE};font-weight:600;font-size:24px;line-height:1.3;letter-spacing:-.01em;color:#000000;` : DENSE}width:100%;padding-right:10px;">${esc(text)}</div></div>`;

  let x = 100;
  const drops: number[] = [];
  const html = groups
    .map((g, i) => {
      const gx = x;
      const gw = spans[i] * cw + (spans[i] - 1) * IN;
      x += gw + OUT;
      const P = g.policies.length;
      const O = g.objectives.length;
      // Inside the group's box: positions relative to (gx, TOP).
      const rel = (bx: number) => bx - gx;
      const pBoxes = tierBoxes(gx, gw, Math.max(P, 1), IN);
      const oBoxes = tierBoxes(gx, gw, Math.max(O, 1), IN);
      const both = P > 0 && O > 0;
      const pH = both ? polH : floor - polY;
      const oY = both ? objY : polY;
      const policies = g.policies.map((p, j) => card(p.text, p.path, rel(pBoxes[j].x), polY - TOP, pBoxes[j].w, pH, "policy", 12 + i * 6 + j * 2, both)).join("");
      const objectives = g.objectives.map((o, j) => card(o.text, o.path, rel(oBoxes[j].x), oY - TOP, oBoxes[j].w, floor - oY, "objective", 18 + i * 6 + j * 2)).join("");
      // Arrows from the centres of the finer tier, unless one would land
      // between two boxes of the other; then from the other's centres.
      let arrows = "";
      if (both) {
        const centres = (bs: { x: number; w: number }[]) => bs.map((b) => b.x + b.w / 2);
        const lands = (cx: number, bs: { x: number; w: number }[]) => bs.some((b) => cx >= b.x + 24 && cx <= b.x + b.w - 24);
        const [fine, coarse] = P >= O ? [pBoxes, oBoxes] : [oBoxes, pBoxes];
        const xs = centres(fine).every((cx) => lands(cx, coarse)) ? centres(fine) : centres(coarse);
        arrows = xs
          .map((ax) => `<div class="af" style="position:absolute;left:${Math.round(rel(ax) - 20)}px;top:${polY + polH + (ARROW - 40) / 2 - TOP}px;width:40px;height:40px;${dly(16 + i * 6)}">${icon("arrow-down", 40, t.accent, 2.2)}</div>`)
          .join("");
      }
      for (const b of O ? oBoxes : pBoxes) drops.push(b.x + b.w / 2);
      return (
        `<div ${item(`blocks.${i}`)} style="position:absolute;left:${Math.round(gx)}px;top:${TOP}px;width:${Math.round(gw)}px;height:${floor - TOP}px;">` +
        `<div class="ars" style="position:absolute;left:0;top:0;width:${Math.round(gw)}px;height:${HDR}px;box-sizing:border-box;background:var(--accent);padding:0 20px;display:flex;align-items:center;justify-content:center;text-align:center;${dly(8 + i * 6)}">` +
        `<div ${ed(`blocks.${i}.label`, HDR - 8)} data-fit-group="cascade-head" style="${HEAD(26, "#FFFFFF")}">${esc(g.label)}</div></div>` +
        policies +
        arrows +
        objectives +
        `</div>`
      );
    })
    .join("");
  // Convergence: a drop under every column onto one rule, and one drop from
  // the middle of the slide into the goal's band.
  const joinY = floor + JOIN / 2;
  const left = Math.min(960, ...drops);
  const right = Math.max(960, ...drops);
  const join = goal
    ? `<div class="af" style="${dly(26)}">` +
      drops.map((cx) => rule(cx - 1, floor, 2, JOIN / 2)).join("") +
      rule(left - 1, joinY - 1, right - left + 2, 2) +
      rule(959, joinY, 2, JOIN / 2) +
      `</div>`
    : "";
  return section(t, "#FFFFFF", "#000000", title(s) + html + join + (goal ? takeawayBand(t, s.support, bandY, "support", "target") : "") + footer(t, "light"));
}

/** A figure that may be negative (costs drawn below zero). */
export function signed(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
export const short = (n: number) => {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  return r.toLocaleString("en-US");
};

/**
 * Chart and explanation (slides 13-15, 31, 32, 35, 36): the explanation in a
 * card on the left (`subtitle` heads it, `bullets` are its points), a line
 * chart of one to three series on the right, and under it up to three
 * numbered notes, note k about series k, its number on the line's last point.
 * Values may be negative: costs run below a darker zero line. The grid, axis
 * type and series colours are the line chart's.
 */
export function chartText(s: Slide, t: BrandTheme): string {
  const TOP = topOf(s);
  const bars = (s.bars ?? []).slice(0, 12);
  const series = (s.series?.length ? s.series : [""]).slice(0, 3);
  const k = series.length;
  const colors = seriesColors(t, k);
  const notes = (s.blocks ?? []).slice(0, 3);

  const PANEL = { x: 100, w: 700 };
  const LEG_Y = TOP;
  const P = { x: 960, y: TOP + 84, w: 720, h: 300 };
  const vals = bars.map((b) => (b.values?.length ? b.values : [b.value]).map(signed));
  const all = vals.flat();
  const hi = Math.max(0, ...all);
  const lo = Math.min(0, ...all);
  const span = hi - lo || 1;
  const yOf = (v: number) => P.y + ((hi - v) / span) * P.h;
  const n = Math.max(bars.length, 1);
  const xOf = (i: number) => P.x + (n === 1 ? P.w / 2 : (P.w * i) / (n - 1));

  const axisStyle = `font-family:${OPEN_SANS};font-weight:500;font-size:22px;line-height:1.3;color:#6F6F6F;`;
  const ticks = [hi, 0, lo].filter((v, i, a) => a.indexOf(v) === i);
  const grid =
    [0, 0.25, 0.5, 0.75, 1]
      .map((f) => `<div style="position:absolute;left:${P.x}px;top:${Math.round(P.y + P.h * f)}px;width:${P.w}px;height:1px;background:#ECECEF;"></div>`)
      .join("") +
    `<div style="position:absolute;left:${P.x}px;top:${Math.round(yOf(0))}px;width:${P.w}px;height:2px;background:#C9C9CF;"></div>` +
    ticks
      .map((v) => `<div style="position:absolute;left:840px;top:${Math.round(yOf(v) - 14)}px;width:100px;text-align:right;${axisStyle}">${short(v)}</div>`)
      .join("");
  const paths = series
    .map((_, j) => {
      const pts = vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v[j] ?? 0).toFixed(1)}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${colors[j]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join("");
  const svg = `<svg class="af" width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;${dly(14)}">${paths}</svg>`;
  // The lines and their end labels are drawing only (pointer-events off):
  // a click anywhere on the plot reaches [data-chart] and opens the Data
  // panel, and the explanation beside it stays editable.
  // The last point of each series: a dot on the line, then beside it the
  // note's number and the value, nudged apart when two lines end close.
  const last = vals.length - 1;
  const endY = series.map((_, j) => ({ j, y: last >= 0 ? yOf(vals[last][j] ?? 0) : 0 }));
  const placed = [...endY].sort((a, b) => a.y - b.y);
  for (let q = 1; q < placed.length; q++) placed[q].y = Math.max(placed[q].y, placed[q - 1].y + 40);
  const ends =
    last < 0
      ? ""
      : placed
          .map(({ j, y: ly }) => {
            const v = vals[last][j] ?? 0;
            const x = xOf(last);
            const y = yOf(v);
            const lx = Math.round(x + 18);
            const top = Math.round(ly - 17);
            const tag = notes[j]
              ? `<div class="af" style="position:absolute;left:${lx}px;top:${top}px;width:34px;height:34px;border-radius:50%;background:${colors[j]};${HEAD(19, "#FFFFFF")}line-height:34px;text-align:center;pointer-events:none;${dly(20)}">${j + 1}</div>`
              : "";
            return (
              `<div class="af" style="position:absolute;left:${Math.round(x - 8)}px;top:${Math.round(y - 8)}px;width:16px;height:16px;border-radius:50%;background:${colors[j]};pointer-events:none;${dly(20)}"></div>` +
              tag +
              `<div class="af" style="position:absolute;left:${lx + (notes[j] ? 44 : 0)}px;top:${top}px;width:110px;font-family:${MANROPE};font-weight:600;font-size:22px;line-height:34px;color:#000000;white-space:nowrap;pointer-events:none;${dly(20)}">${short(v)}</div>`
            );
          })
          .join("");
  const xl = bars
    .map((b, i) => `<div class="ars" ${ed(`bars.${i}.label`, 32)} style="position:absolute;left:${Math.round(xOf(i) - 60)}px;top:${P.y + P.h + 14}px;width:120px;text-align:center;${axisStyle}color:#000000;${dly(18 + i * 2)}">${esc(b.label)}</div>`)
    .join("");
  const leg =
    `<div style="position:absolute;left:${P.x}px;top:${LEG_Y}px;width:${1820 - P.x}px;display:flex;flex-wrap:wrap;gap:6px 32px;">` +
    series
      .map(
        (name, j) =>
          `<div class="ars" style="display:flex;align-items:center;gap:12px;${dly(8 + j * 4)}"><div style="width:18px;height:18px;border-radius:50%;background:${colors[j]};"></div><div ${ed(`series.${j}`, 32)} style="${axisStyle}color:#000000;white-space:nowrap;">${esc(name)}</div></div>`,
      )
      .join("") +
    `</div>`;
  const NOTE_TOP = P.y + P.h + 70;
  const noteRows = notes
    .map(
      (b, j) =>
        `<div style="display:flex;gap:.7em;"><div style="flex:0 0 auto;width:1.35em;height:1.35em;border-radius:50%;background:${colors[j] ?? colors[0]};color:#FFFFFF;font-family:${MANROPE};font-weight:600;font-size:1em;line-height:1.35em;text-align:center;margin-top:.02em;">${j + 1}</div><div ${ed(`blocks.${j}.body`)} style="flex:1;min-width:0;">${esc(b.body)}</div></div>`,
    )
    .join("");
  const panel =
    `<div class="ars" style="position:absolute;left:${PANEL.x}px;top:${TOP}px;width:${PANEL.w}px;height:${BOTTOM - TOP}px;box-sizing:border-box;background:${CARD};padding:32px 8px 28px 36px;display:flex;flex-direction:column;gap:18px;${dly(6)}">` +
    bullets(
      (s.bullets ?? []).map((text, j) => ({ text, path: `bullets.${j}` })),
      BOTTOM - TOP - 60,
      undefined,
      { path: "subtitle", text: s.subtitle },
    ) +
    `</div>`;
  return section(
    t,
    "#FFFFFF",
    "#000000",
    title(s) +
      panel +
      leg +
      `<div data-chart style="position:absolute;left:840px;top:${P.y - 20}px;width:980px;height:${P.h + 60}px;"></div>` +
      grid +
      svg +
      ends +
      xl +
      `<div data-fit="${BOTTOM - NOTE_TOP}" style="position:absolute;left:${P.x - 120}px;top:${NOTE_TOP}px;width:${1820 - P.x + 120}px;box-sizing:border-box;${DENSE}font-size:22px;display:flex;flex-direction:column;gap:.5em;">${noteRows}</div>` +
      footer(t, "light"),
  );
}

/**
 * Footnotes (every content slide): numbered sources and definitions in the
 * footer row, between the division label and the logo, the way a report
 * prints them. Grey on white, white at 75% on the accent surfaces; two lines,
 * then the text shrinks. Not on the cover, dividers, agenda and closing
 * slide, where a note has no reference to belong to.
 */
export const NO_NOTES: ReadonlySet<LayoutId> = new Set<LayoutId>([
  "cover",
  "agenda",
  "section-divider",
  "thank-you",
  "photo-full",
  "a4-page",
  "partner",
]);
const DARK_FOOTER: ReadonlySet<LayoutId> = new Set<LayoutId>(["three-columns", "big-stat", "section-image-deep", "quote"]);

export function footnote(s: Slide): string {
  if (NO_NOTES.has(s.layoutId) || !s.notes?.trim()) return "";
  const color = DARK_FOOTER.has(s.layoutId) ? "rgba(255,255,255,.75)" : "#6F6F6F";
  // The ✕ on hover deletes it (DELETE_ITEM "notes"); data-item sits on a
  // wrapper, never on the node with the fit budget (see CONTEXT.md).
  return (
    `<div ${item("notes")} style="position:absolute;left:560px;top:956px;width:920px;">` +
    `<div ${ed("notes", 50)} data-notes style="font-family:${OPEN_SANS};font-weight:500;font-size:17px;line-height:1.35;color:${color};white-space:pre-line;">${esc(s.notes)}</div>` +
    `</div>`
  );
}
