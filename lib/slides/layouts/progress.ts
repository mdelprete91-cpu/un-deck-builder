import type { Slide } from "../schema";
import type { BrandTheme } from "../brand";
import { MANROPE, BODY30, esc, ed, dly, item, section, footer, heading80 } from "./shared";

/**
 * Where a process stands (Mario, 26 Sep 2026: "a slide that represents a
 * progression", after a chevron funnel he did not want). Derived from the
 * template's phase columns (timeline-phases) with his approval: the 80px
 * title, stages spread over the 1720px content width, Manrope labels and
 * Open Sans bodies, and between title and text one progress bar on the
 * chart grid's grey.
 *
 * One colour, three states, never colour alone (research on roadmap slides
 * says the same, and so does DESIGN.md): done is a filled accent node with a
 * tick and the word "Done"; the stage in progress is a larger ring with an
 * accent dot, its label in the accent and "In progress"; what is next is a
 * grey ring and "Next". The bar fills to the stage in progress. `current`
 * is that stage, 1-based; absent, the slide is a plain sequence, every node
 * an accent ring, no fill and no status words. A click on a node sets it
 * (data-set, read by SlideFrame).
 */
const TRACK_Y = 512;
const TRACK_H = 12;
const GREY = "#ECECEF";
const NEXT_RING = "#C9C9CF";
/** A stage's box: status line, node, label and body (416 to 946, above the footer). */
const STAGE_H = 530;
const TICK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20 6 9 17l-5-5"/></svg>`;

export function progress(s: Slide, t: BrandTheme): string {
  const stages = (s.blocks ?? []).slice(0, 6);
  const n = Math.max(stages.length, 1);
  const cur = Number(s.current);
  const current = Number.isFinite(cur) && cur >= 1 && cur <= n ? Math.round(cur) : 0;
  const colW = 1720 / n;
  const cx = (i: number) => Math.round(100 + colW * (i + 0.5));
  const midY = TRACK_Y + TRACK_H / 2;

  const x0 = cx(0);
  const x1 = cx(n - 1);
  const track = `<div style="position:absolute;left:${x0}px;top:${TRACK_Y}px;width:${x1 - x0}px;height:${TRACK_H}px;border-radius:${TRACK_H / 2}px;background:${GREY};"></div>`;
  const fillTo = current ? cx(current - 1) : x0;
  const fill =
    current > 1
      ? `<div class="agw" style="position:absolute;left:${x0}px;top:${TRACK_Y}px;width:${fillTo - x0}px;height:${TRACK_H}px;border-radius:${TRACK_H / 2}px;background:var(--accent);${dly(12)}"></div>`
      : "";

  const cols = stages
    .map((stage, i) => {
      const state = !current ? "plain" : i + 1 < current ? "done" : i + 1 === current ? "current" : "next";
      const size = state === "current" ? 60 : 44;
      const node =
        state === "done"
          ? `background:var(--accent);`
          : state === "current"
            ? `background:#FFFFFF;border:7px solid var(--accent);box-sizing:border-box;`
            : state === "next"
              ? `background:#FFFFFF;border:4px solid ${NEXT_RING};box-sizing:border-box;`
              : `background:#FFFFFF;border:5px solid var(--accent);box-sizing:border-box;`;
      const inner = state === "done" ? TICK : state === "current" ? `<div style="width:18px;height:18px;border-radius:50%;background:var(--accent);"></div>` : "";
      const status = state === "done" ? "Done" : state === "current" ? "In progress" : state === "next" ? "Next" : "";
      const number = String(i + 1).padStart(2, "0");
      const accentText = state === "done" || state === "current" || state === "plain";
      const left = Math.round(100 + colW * i);
      const w = Math.round(colW) - 20;
      // One box per stage, from the status line to the end of the body, so
      // the delete frame and its ✕ cover the whole stage (they covered only
      // the status line, 26 Sep 2026). Children are placed inside it.
      const top = TRACK_Y - 96;
      return (
        `<div class="ars" ${item(`blocks.${i}`)} style="position:absolute;left:${left}px;top:${top}px;width:${Math.round(colW)}px;height:${STAGE_H}px;${dly(10 + i * 8)}">` +
        `<div style="position:absolute;left:0;top:0;width:100%;text-align:center;font-family:${MANROPE};font-weight:600;font-size:26px;line-height:1.3;color:${accentText ? "var(--accent)" : "#8F8F8F"};">${number}${status ? `<span style="font-weight:500;color:#6F6F6F;"> · ${status}</span>` : ""}</div>` +
        `<div class="af" data-set="current" data-value="${i + 1}" title="Mark this stage as in progress" style="position:absolute;left:${cx(i) - left - size / 2}px;top:${midY - top - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;${node}display:flex;align-items:center;justify-content:center;${dly(14 + i * 8)}">${inner}</div>` +
        `<div style="position:absolute;left:10px;top:168px;width:${w}px;text-align:center;">` +
        `<div ${ed(`blocks.${i}.label`, 96)} style="font-family:${MANROPE};font-weight:600;font-size:36px;line-height:1.25;letter-spacing:-.01em;color:${state === "current" ? "var(--accent)" : "#161616"};">${esc(stage.label)}</div>` +
        `<div ${ed(`blocks.${i}.body`, 250)} style="margin-top:14px;${BODY30}color:${state === "next" ? "#5D5D5D" : "#000000"};">${esc(stage.body)}</div>` +
        `</div>` +
        `</div>`
      );
    })
    .join("");

  return section(t, "#FFFFFF", "#000000", heading80(s.title ?? "", "title", "#000000", 1720, 190) + track + fill + cols + footer(t, "light"));
}
