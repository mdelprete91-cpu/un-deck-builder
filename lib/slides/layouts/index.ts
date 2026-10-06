import type { LayoutId, Slide } from "../schema";
import type { BrandTheme } from "../brand";
import * as basic from "./basic";
import * as cards from "./cards";
import * as stats from "./stats";
import * as tables from "./tables";
import * as charts from "./charts";
import * as progressLayout from "./progress";
import * as dense from "./dense";
import { DENSE_RENDERERS } from "./density";
import { renderPage, type PageCtx } from "../pages/render";

/**
 * `ctx` is optional so every slide renderer stays assignable unchanged: only
 * the two-pager page needs to know where it sits (for the page number).
 */
export type RenderFn = (slide: Slide, theme: BrandTheme, ctx?: PageCtx) => string;

export const LAYOUTS: Record<LayoutId, { label: string; render: RenderFn }> = {
  cover: { label: "Cover", render: basic.cover },
  agenda: { label: "Agenda", render: basic.agenda },
  "three-columns": { label: "Three columns", render: cards.threeColumns },
  callout: { label: "Partnership callout", render: cards.callout },
  "section-divider": { label: "Section divider", render: basic.sectionDivider },
  "big-stat": { label: "Big stat", render: basic.bigStat },
  quote: { label: "Quote", render: basic.quote },
  "section-image-deep": { label: "Section + image (deep)", render: basic.sectionImage("deep") },
  "section-image-light": { label: "Section + image (light)", render: basic.sectionImage("light") },
  "section-image-dark": { label: "Section + image (dark)", render: basic.sectionImage("dark") },
  "four-cards": { label: "Card grid", render: cards.fourCards },
  list: { label: "List", render: cards.list },
  steps: { label: "Numbered cards", render: cards.steps },
  "body-copy": { label: "Body copy", render: basic.bodyCopy },
  photo: { label: "Photo", render: basic.photo },
  "photo-full": { label: "Full image", render: basic.photoFull },
  map: { label: "World map", render: basic.worldMap }, // retired, see LEGACY_LAYOUT_IDS
  "icon-cards": { label: "Icon cards", render: cards.iconCards },
  "stat-grid": { label: "Stat grid", render: stats.statGrid },
  "brand-equity": { label: "Stats + intro", render: stats.brandEquity },
  "two-stats": { label: "Two stats", render: stats.twoStats },
  "single-stat": { label: "Single stat", render: stats.singleStat },
  "chart-bars": { label: "Bar chart", render: stats.chartBars },
  "donut-chart": { label: "Donut chart", render: stats.donutChart },
  progress: { label: "Progress", render: progressLayout.progress },
  "chart-columns-wide": { label: "Wide column chart", render: charts.columnsWide },
  "chart-bars-horizontal": { label: "Horizontal bars", render: charts.barsHorizontal },
  "chart-line": { label: "Line chart", render: charts.line },
  "chart-columns-grouped": { label: "Grouped columns", render: charts.columnsGrouped },
  "chart-columns-stacked": { label: "Stacked columns", render: charts.columnsStacked },
  "chart-funnel": { label: "Funnel", render: charts.funnel },
  "chart-waterfall": { label: "Waterfall", render: charts.waterfall },
  "chart-area": { label: "Area chart", render: charts.area },
  "chart-bars-100": { label: "100% bars", render: charts.bars100 },
  "chart-progress": { label: "Progress to target", render: charts.progressTarget },
  timeline: { label: "Timeline", render: progressLayout.timeline },
  "timeline-phases": { label: "Timeline phases", render: stats.timelinePhases },
  "example-image-left": { label: "Text + photo left", render: cards.exampleImage("left") },
  "example-image-right": { label: "Text + photo right", render: cards.exampleImage("right") },
  partner: { label: "Partners", render: basic.partners },
  "thank-you": { label: "Thank you", render: basic.thankYou },
  "tiers-1": { label: "Partnership tiers (1/2)", render: tables.tiers1 },
  "tiers-2": { label: "Partnership tiers (2/2)", render: tables.tiers2 },
  "bullet-columns": { label: "Bullet columns", render: dense.bulletColumns },
  "figures-panel": { label: "Figures + commentary", render: dense.figuresPanel },
  scenarios: { label: "Scenarios", render: dense.scenarios },
  matrix: { label: "Matrix", render: dense.matrix },
  "chart-text": { label: "Chart + explanation", render: dense.chartText },
  cascade: { label: "Cascade", render: dense.cascade },
  "a4-page": { label: "A4 page", render: renderPage },
};

export function renderSlide(slide: Slide, theme: BrandTheme, ctx?: PageCtx): string {
  const def = LAYOUTS[slide.layoutId];
  if (!def) return "";
  // The high-density variant when the slide asks for it and the layout has one.
  const denseRender = slide.density === "high" ? DENSE_RENDERERS[slide.layoutId] : undefined;
  const html = denseRender ? denseRender(slide, theme) : def.render(slide, theme, ctx);
  // Footnotes sit in the footer row of any content slide: added here, once,
  // inside the section's content box, so no renderer has to know about them.
  const note = dense.footnote(slide);
  return note ? html.replace(/<\/div><\/section>$/, `${note}</div></section>`) : html;
}
