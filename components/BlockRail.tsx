"use client";

import { X } from "lucide-react";
import { BLOCK_LABELS } from "@/lib/slides/pages/presets";
import type { PageBlockType } from "@/lib/slides/pages/schema";

/** The drag payload of a block from the rail; SlideFrame drops it on the page. */
export const BLOCK_MIME = "application/x-page-block";

/*
 * Each block drawn as a wireframe of the page it makes, in a 120x72 box:
 * grey bars for text, the accent for labels and figures, a tint for images.
 * Vectors, so they stay sharp at any zoom and cost nothing to load.
 */
const INK = "var(--rail-ink)";
const SOFT = "var(--rail-soft)";
const ACC = "var(--rail-acc)";
const TINT = "var(--rail-tint)";

const bar = (x: number, y: number, w: number, h = 3, c = SOFT) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={c} />;
const box = (x: number, y: number, w: number, h: number, fill = "none", stroke = SOFT, r = 3) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={stroke} strokeWidth={1} />
);
const lines = (x: number, y: number, ws: number[], step = 7) => ws.map((w, i) => <g key={i}>{bar(x, y + i * step, w)}</g>);

const DRAW: Record<PageBlockType, React.ReactNode> = {
  title: (
    <>
      {bar(8, 26, 40, 9, INK)}
      {bar(52, 26, 36, 9, ACC)}
      {bar(8, 40, 64, 9, INK)}
    </>
  ),
  heading: (
    <>
      {bar(8, 22, 62, 7, INK)}
      {lines(8, 38, [104, 96, 70])}
    </>
  ),
  banner: (
    <>
      {box(8, 18, 104, 36, TINT, "none", 4)}
      {bar(16, 30, 54, 6, "var(--rail-on-tint)")}
      {bar(16, 40, 36, 6, "var(--rail-on-tint)")}
    </>
  ),
  lede: <>{lines(8, 20, [104, 100, 104, 70])}</>,
  section: (
    <>
      {bar(8, 18, 24, 4, ACC)}
      {lines(40, 18, [72, 68, 72, 50])}
      {lines(40, 48, [72, 40])}
    </>
  ),
  stats: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          {box(8 + i * 36, 18, 32, 36)}
          {bar(13 + i * 36, 25, 14, 7, INK)}
          {bar(13 + i * 36, 38, 20)}
          {bar(13 + i * 36, 44, 14)}
        </g>
      ))}
    </>
  ),
  pillars: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={13 + i * 36} cy={21} r={4} fill="none" stroke={ACC} strokeWidth={1.2} />
          {bar(9 + i * 36, 30, 18, 3.5, INK)}
          {lines(9 + i * 36, 38, [28, 26, 28, 18])}
        </g>
      ))}
    </>
  ),
  figure: (
    <>
      {box(8, 14, 104, 44, TINT, "none", 3)}
      <path d="M20 50 L40 32 L54 44 L66 36 L100 50 Z" fill="var(--rail-tint-2)" />
      <circle cx={88} cy={26} r={4} fill="var(--rail-tint-2)" />
    </>
  ),
  compare: (
    <>
      {bar(8, 16, 34, 4, INK)}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          {bar(8, 28 + i * 10, 20)}
          {bar(38, 28 + i * 10, 34)}
          {bar(80, 28 + i * 10, 32, 3, ACC)}
          <line x1={8} x2={112} y1={34 + i * 10} y2={34 + i * 10} stroke={SOFT} strokeWidth={0.5} />
        </g>
      ))}
    </>
  ),
  asks: (
    <>
      {[0, 1].map((i) => (
        <g key={i}>
          {box(8 + i * 54, 14, 50, 44)}
          {bar(14 + i * 54, 21, 26, 4, ACC)}
          {lines(14 + i * 54, 31, [38, 34, 38, 24])}
        </g>
      ))}
    </>
  ),
  panels: (
    <>
      {box(8, 14, 50, 44, TINT, "none")}
      {bar(14, 21, 26, 4, INK)}
      {lines(14, 31, [38, 34, 30])}
      {box(62, 14, 50, 44)}
      {bar(68, 21, 26, 4, ACC)}
      {lines(68, 31, [38, 34, 30])}
    </>
  ),
  photos: (
    <>
      {[0, 1].map((i) => (
        <g key={i}>
          {box(8 + i * 54, 14, 50, 30, TINT, "none")}
          {bar(8 + i * 54, 49, 36, 3.5, INK)}
          {bar(8 + i * 54, 55, 26)}
        </g>
      ))}
    </>
  ),
  contacts: (
    <>
      <line x1={8} x2={112} y1={16} y2={16} stroke={SOFT} strokeWidth={1} />
      {bar(8, 24, 40, 4, INK)}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          {bar(8, 34 + i * 8, 28, 3, INK)}
          {bar(40, 34 + i * 8, 34)}
          {bar(80, 34 + i * 8, 32, 3, ACC)}
        </g>
      ))}
    </>
  ),
  callout: (
    <>
      {box(8, 20, 104, 32, "var(--rail-orange-tint)", "none", 4)}
      {bar(15, 28, 18, 4, "var(--rail-orange)")}
      {bar(37, 28, 66)}
      {lines(15, 36, [90, 64])}
    </>
  ),
  split: (
    <>
      {box(8, 12, 104, 48)}
      {bar(14, 19, 22, 6, ACC)}
      {lines(14, 31, [36, 40, 34, 38, 26])}
      {box(58, 16, 50, 40, TINT, "none")}
    </>
  ),
  screens: (
    <>
      {box(8, 20, 38, 30)}
      {bar(12, 25, 20)}
      {bar(12, 31, 26)}
      <path d="M50 35 h8 m-3 -3 l3 3 l-3 3" stroke={ACC} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {box(62, 14, 50, 42, TINT, "none")}
      {box(68, 20, 38, 30, "var(--rail-card)", "none")}
    </>
  ),
  numbered: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={14} cy={20 + i * 16} r={5} fill={ACC} />
          {bar(24, 16 + i * 16, 82, 3, INK)}
          {bar(24, 22 + i * 16, 60)}
        </g>
      ))}
    </>
  ),
  table: (
    <>
      {box(8, 14, 104, 44)}
      <rect x={8.5} y={14.5} width={103} height={10} fill={TINT} />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          {bar(13, 18 + r * 11, 20, 3, r === 0 ? INK : SOFT)}
          {bar(46, 18 + r * 11, 26, 3, r === 0 ? INK : SOFT)}
          {bar(82, 18 + r * 11, 22, 3, r === 0 ? INK : SOFT)}
          {r > 0 && <line x1={8} x2={112} y1={14 + r * 11} y2={14 + r * 11} stroke={SOFT} strokeWidth={0.5} />}
        </g>
      ))}
    </>
  ),
};

/**
 * The blocks of a two-pager as a column of wireframes beside the pages strip,
 * under the toolbar (Mario, 7 Oct 2026). Drag one onto the page and a line
 * shows where it lands (SlideFrame); a click adds it after the selected block.
 */
export default function BlockRail({ onAdd, onClose }: { onAdd: (type: PageBlockType) => void; onClose: () => void }) {
  const types = Object.keys(BLOCK_LABELS) as (keyof typeof BLOCK_LABELS)[];
  return (
    <aside aria-label="Blocks" className="block-rail flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between pl-4 pr-2">
        <p className="text-[13px] text-ink-faint">Blocks</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the blocks"
          className="flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-5 pt-1">
        {types.map((type) => (
          <li key={type}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(BLOCK_MIME, type);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onAdd(type)}
              data-tip="Drag onto the page"
              className="rail-tile group flex w-full cursor-grab flex-col gap-2 text-left focus-visible:outline-none active:cursor-grabbing"
            >
              {/* A soft tile in the chrome's own greys, as ChatGPT draws its cards. */}
              <span className="rail-paper block w-full overflow-hidden rounded-xl">
                <svg viewBox="0 0 120 72" className="block w-full" aria-hidden>
                  {DRAW[type]}
                </svg>
              </span>
              <span className="px-0.5 text-[13px] leading-tight text-ink">{BLOCK_LABELS[type]}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
