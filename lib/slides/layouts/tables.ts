import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import { MANROPE, OPEN_SANS, esc, ed, section, footer } from "./shared";

/**
 * Manual-insert layouts: the partnership tier comparisons, in the new
 * template's column layout. Per Mario's request the columns have NO accent
 * border — just the template's alternating fills. Title is editable inline;
 * table content is the approved copy and stays static in v1.
 */

type Cell = true | "half" | string | null;

interface TierRow {
  text: string;
  cells: [Cell, Cell, Cell, Cell];
}

/** Default cell matrix for a tier layout ("on"/"half"/text/null), used to seed edits. */
export function tierDefaultGrid(layoutId: "tiers-1" | "tiers-2"): (string | null)[][] {
  const rows = layoutId === "tiers-1" ? TIERS_1_ROWS : TIERS_2_ROWS;
  return rows.map((row) =>
    row.cells.map((cell) => (cell === true ? "on" : cell === "half" ? "half" : cell)),
  );
}

const TIER_COLS = ["Contributor", "Partner", "International partner", "Global partner"];
const CELL_XS = [847, 1095, 1344, 1595];
const ROW_TOP = 353;
const ROW_STEP = 53;

function tierColumns(): string {
  return (
    `<div style="position:absolute;left:822px;top:70px;width:998px;height:850px;display:flex;">` +
    TIER_COLS.map(
      (name, i) =>
        `<div style="width:249.5px;height:850px;box-sizing:border-box;${i % 2 === 0 ? "background:#F7F7F7;" : ""}padding:30px 40px;display:flex;flex-direction:column;gap:18px;">` +
        `<div style="font-family:${MANROPE};font-weight:700;font-size:24px;line-height:1.32;letter-spacing:-.02em;color:#000000;">${name}</div>` +
        `<div style="font-family:${MANROPE};font-weight:600;font-size:24px;line-height:1.32;letter-spacing:-.02em;color:#000000;">$250K - $499K annually</div>` +
        `</div>`,
    ).join("") +
    `</div>`
  );
}

function tierRows(rows: TierRow[], grid?: (string | null)[][]): string {
  return rows
    .map((row, r) => {
      const top = ROW_TOP + r * ROW_STEP;
      const label = `<div style="position:absolute;left:102px;top:${top}px;width:684px;font-family:${OPEN_SANS};font-weight:400;font-size:16px;line-height:1.32;color:#000000;">${esc(row.text)}</div>`;
      const cells = row.cells
        .map((defaultCell, c) => {
          const override = grid?.[r]?.[c];
          const cell = override !== undefined ? override : defaultCell === true ? "on" : defaultCell;
          const base = `position:absolute;left:${CELL_XS[c]}px;top:${top}px;width:202px;height:36px;text-align:center;font-size:16px;line-height:1.32;`;
          // Text cells (Basic, Once annually…) stay as-is; everything else cycles on click
          if (typeof cell === "string" && cell !== "on" && cell !== "half") {
            return `<div style="${base}font-family:${OPEN_SANS};font-weight:600;color:#000000;">${esc(cell)}</div>`;
          }
          const content = cell === "on" ? "✅" : cell === "half" ? `<span style="opacity:.5;">✅</span>` : "";
          return `<div data-cell="${r}.${c}" style="${base}cursor:default;">${content}</div>`;
        })
        .join("");
      return label + cells;
    })
    .join("");
}

function categoryBar(top: number, height: number, textTop: number, width: number, label: string): string {
  return (
    `<div style="position:absolute;left:51px;top:${top}px;width:37px;height:${height}px;background:#F6F6F6;">` +
    `<div style="position:absolute;left:8px;top:${textTop}px;width:${width}px;transform:rotate(-90deg);transform-origin:0 0;text-align:center;font-family:${MANROPE};font-weight:600;font-size:16px;line-height:1.32;letter-spacing:-.02em;color:#000000;white-space:nowrap;">${label}</div>` +
    `</div>`
  );
}

function tierSlide(
  t: BrandTheme,
  title: string,
  rows: TierRow[],
  bars: string,
  grid?: (string | null)[][],
): string {
  return section(
    t,
    "#FFFFFF",
    "#000000",
    `<div class="ar" ${ed("title", 260)} style="position:absolute;left:102px;top:76px;width:680px;font-family:${MANROPE};font-weight:500;font-size:60px;line-height:1.2;letter-spacing:-.022em;color:#000000;">${esc(title)}</div>` +
      tierColumns() +
      tierRows(rows, grid) +
      bars +
      footer(t, "light"),
  );
}

const TIERS_1_ROWS: TierRow[] = [
  { text: "Receive the Annual Partner Report on Giga’s progress along with expenditure statements", cells: [true, true, true, true] },
  { text: "Invitation to the Annual Giga Partner Roundtable", cells: ["half", true, true, true] },
  { text: "Participation by Giga in regular partnership governance meetings", cells: [null, null, true, true] },
  { text: "Hiring of a dedicated Account Manager (3 yrs min.) to handle relationships and activities", cells: [null, null, null, true] },
  { text: "Track mapping and connectivity progress in real time via Project Connect", cells: [true, true, true, true] },
  { text: "Announcement of the partnership on Giga social media channels", cells: [null, true, true, true] },
  { text: "Announcement of the partnership on global UNICEF social media channels", cells: [null, null, "half", true] },
  { text: "Use of names and logos of partner on the Giga Annual Report (based on Tier)", cells: [true, true, true, true] },
  { text: "Use of names and logos of partner on the Giga Website (based on Tier)", cells: [null, true, true, true] },
  { text: "Partner use of Giga name and logo allowed", cells: ["half", true, true, true] },
  { text: "Partner use of UNICEF name and logo allowed", cells: [null, null, null, true] },
];

export function tiers1(s: Slide, t: BrandTheme): string {
  const bars =
    categoryBar(341, 261, 227, 194, "Reporting and governance") +
    categoryBar(610, 310, 250, 190, "Recognition and Logo use");
  return tierSlide(t, s.title ?? "Partnership tiers", TIERS_1_ROWS, bars, s.grid);
}

const TIERS_2_ROWS: TierRow[] = [
  { text: "Customized communication plan and key messages for partnership updates", cells: [null, null, true, true] },
  { text: "Partnership specific media activations, with support and guidance from Giga", cells: [null, null, "Once annually", "Twice annually"] },
  { text: "Asset pack with videos, photos, and text content for partners to use on social media", cells: [null, "Basic", "Regular", "Premium"] },
  { text: "Quarterly newsletter", cells: [true, true, true, true] },
  { text: "Run a company-wide crowdsourcing challenge to map schools with a mapping game", cells: [null, "half", true, true] },
  { text: "Opportunity to hold knowledge sharing sessions between employees and Giga experts", cells: [null, null, "half", true] },
];

export function tiers2(s: Slide, t: BrandTheme): string {
  const bars = categoryBar(341, 208, 167, 127, "Communications");
  return tierSlide(t, s.title ?? "Partnership tiers", TIERS_2_ROWS, bars, s.grid);
}
