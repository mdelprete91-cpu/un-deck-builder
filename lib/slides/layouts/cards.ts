import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import {
  MANROPE,
  BODY30,
  BODY32,
  LABEL36,
  esc,
  ed,
  dly,
  item,
  columns,
  section,
  footer,
  photoPanel,
  heading60,
  heading80,
} from "./shared";

/** Agenda detail: 1–3 numbered columns on deep background. */
export function threeColumns(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 3);
  const { xs, width } = columns(Math.min(blocks.length, 3));
  const cols = blocks
    .map(
      (b, i) =>
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${xs[i]}px;top:448px;width:${Math.min(width, 549)}px;${dly(10 + i * 8)}">` +
        `<div style="font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.1;color:var(--accent-soft);">${i + 1}</div>` +
        `<div ${ed(`blocks.${i}.label`, 100)} style="margin-top:32px;${LABEL36}color:#FFFFFF;">${esc(b.label)}</div>` +
        `<div ${ed(`blocks.${i}.body`, 380)} style="margin-top:18px;${BODY30}color:#FFFFFF;">${esc(b.body)}</div>` +
        `</div>`,
    )
    .join("");
  return section(
    t,
    "var(--accent-deep)",
    "#FFFFFF",
    `<div class="ar" ${ed("title", 300)} style="position:absolute;left:100px;top:100px;width:1720px;font-family:${MANROPE};font-weight:500;font-size:144px;line-height:1;letter-spacing:-.02em;color:#FFFFFF;">${esc(s.title)}</div>` +
      cols +
      footer(t, "dark"),
  );
}

/** Partnership callout: 1–5 labelled rows left, photo panel right (template 03). */
export function callout(s: Slide, t: BrandTheme): string {
  const rows = (s.blocks ?? [])
    .slice(0, 5)
    .map((b, i) => {
      const top = 274 + i * 130;
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:100px;top:${top}px;width:880px;${dly(8 + i * 6)}">` +
        `<div ${ed(`blocks.${i}.label`, 50)} style="${LABEL36}color:var(--accent);">${esc(b.label)}</div>` +
        `<div ${ed(`blocks.${i}.body`, 72)} style="margin-top:11px;${BODY30}color:#000000;">${esc(b.body)}</div>` +
        `</div>`
      );
    })
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    photoPanel(1080, s.image) +
      heading60(s.title ?? "", "title", "#000000", 100, 880) +
      rows +
      footer(t, "light"),
  );
}

/** Card base; border and fill vary per layout (template 06/07/10). */
function card(
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
  delay: number,
  inner: string,
  opts: { bg?: boolean; border?: boolean } = {},
): string {
  const { bg = true, border = true } = opts;
  return (
    `<div class="ars" ${item(path)} style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;${bg ? "background:#F7F7F7;" : ""}${border ? "border:4px solid var(--accent);" : ""}${dly(delay)}">` +
    inner +
    `</div>`
  );
}

/**
 * Labelled card grid, 1–4 cards (template 06 "Esempio 2x2").
 * 4 → 2×2 grid of 842×311 cards; 3 → three columns; 2 → two wide; 1 → full width.
 */
export function fourCards(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 4);
  const inner = (b: { label: string; body: string }, i: number, w: number, h: number) =>
    `<div ${ed(`blocks.${i}.label`, 62)} style="position:absolute;left:40px;top:40px;width:${w - 80}px;font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.1;letter-spacing:-.02em;color:var(--accent);">${esc(b.label)}</div>` +
    `<div ${ed(`blocks.${i}.body`, h - 125)} style="position:absolute;left:40px;top:109px;width:${w - 80}px;${BODY32}color:#000000;">${esc(b.body)}</div>`;

  let cards: string;
  if (blocks.length >= 4) {
    const pos = [
      [100, 226],
      [978, 226],
      [100, 573],
      [978, 573],
    ];
    cards = blocks
      .map((b, i) =>
        card(`blocks.${i}`, pos[i][0], pos[i][1], 842, 311, 8 + i * 8, inner(b, i, 842, 311), { border: false }),
      )
      .join("");
  } else {
    const { xs, width } = columns(blocks.length);
    const height = blocks.length === 3 ? 482 : 380;
    cards = blocks
      .map((b, i) =>
        card(`blocks.${i}`, xs[i], 280, width, height, 8 + i * 8, inner(b, i, width, height), { border: false }),
      )
      .join("");
  }
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading60(s.title ?? "", "title", "#000000", 100, 1720, 112) + cards + footer(t, "light"),
  );
}

/** Numbered step cards, 1–4 in one row (template 07/08). */
export function steps(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 4);
  const { xs, width } = columns(blocks.length);
  const cards = blocks
    .map((b, i) =>
      card(
        `blocks.${i}`,
        xs[i],
        394,
        width,
        482,
        8 + i * 8,
        `<div style="position:absolute;left:40px;top:40px;font-family:${MANROPE};font-weight:600;font-size:48px;line-height:1.1;color:var(--accent);">${i + 1}</div>` +
          `<div style="position:absolute;left:40px;top:117px;width:${width - 80}px;display:flex;flex-direction:column;gap:16px;">` +
          `<div ${ed(`blocks.${i}.label`, 50)} style="${LABEL36}color:#000000;">${esc(b.label)}</div>` +
          `<div ${ed(`blocks.${i}.body`, 290)} style="${BODY32}color:#000000;">${esc(b.body)}</div>` +
          `</div>`,
        { border: false },
      ),
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000", 1720, 280) + cards + footer(t, "light"),
  );
}

/** Simple outline icons for the icon-card layout, stroke follows the accent. */
const ICONS: string[] = [
  // globe
  `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/>`,
  // wifi
  `<path d="M2.5 9.5C8 4.5 16 4.5 21.5 9.5M5.5 13c4-3.5 9-3.5 13 0M8.5 16.4c2-1.8 5-1.8 7 0"/><circle cx="12" cy="19.3" r="1.2" fill="currentColor"/>`,
  // school / building
  `<path d="M4 20V9l8-5 8 5v11M4 20h16M9.5 20v-5h5v5"/><path d="M12 9.5v.01"/>`,
  // chart
  `<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-8"/>`,
];

/** Icon cards, 1–4 in one row (template 10, reworked: soft fill, no accent border). */
export function iconCards(s: Slide, t: BrandTheme): string {
  const blocks = (s.blocks ?? []).slice(0, 4);
  const { xs, width } = columns(blocks.length);
  const cards = blocks
    .map((b, i) =>
      card(
        `blocks.${i}`,
        xs[i],
        336,
        width,
        530,
        8 + i * 8,
        `<svg width="126" height="126" viewBox="0 0 24 24" fill="none" stroke="${t.accent}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:40px;top:40px;">${ICONS[i % ICONS.length]}</svg>` +
          `<div style="position:absolute;left:40px;top:202px;width:${width - 80}px;display:flex;flex-direction:column;gap:16px;">` +
          `<div ${ed(`blocks.${i}.label`, 50)} style="${LABEL36}color:#000000;">${esc(b.label)}</div>` +
          `<div ${ed(`blocks.${i}.body`, 260)} style="${BODY30}color:#000000;">${esc(b.body)}</div>` +
          `</div>`,
        { border: false },
      ),
    )
    .join("");
  return section(
    t,
    "#FFFFFF",
    "#000000",
    heading80(s.title ?? "", "title", "#000000") + cards + footer(t, "light"),
  );
}

/** 1–2 labelled sections + full-height photo on the given side (template 19/20). */
export function exampleImage(side: "left" | "right") {
  return (s: Slide, t: BrandTheme): string => {
    const textLeft = side === "left" ? 920 : 102;
    const panelLeft = side === "left" ? 0 : 1080;
    const rows = (s.blocks ?? [])
      .slice(0, 2)
      .map(
        (b, i) =>
          `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${textLeft}px;top:${i === 0 ? 284 : 588}px;width:${side === "left" ? 900 : 880}px;${dly(10 + i * 8)}">` +
          `<div ${ed(`blocks.${i}.label`, 50)} style="${LABEL36}color:var(--accent);">${esc(b.label)}</div>` +
          `<div ${ed(`blocks.${i}.body`, 230)} style="margin-top:23px;${BODY30}color:#000000;">${esc(b.body)}</div>` +
          `</div>`,
      )
      .join("");
    return section(
      t,
      "#FFFFFF",
      "#000000",
      photoPanel(panelLeft, s.image) +
        heading60(s.title ?? "", "title", "#000000", textLeft, side === "left" ? 900 : 880, 170) +
        rows +
        footer(t, "light"),
    );
  };
}
