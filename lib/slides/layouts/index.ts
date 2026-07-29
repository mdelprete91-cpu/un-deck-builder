import type { LayoutId, Slide } from "../schema";
import type { BrandTheme } from "../brand";
import * as basic from "./basic";
import * as cards from "./cards";
import * as stats from "./stats";
import * as tables from "./tables";

export type RenderFn = (slide: Slide, theme: BrandTheme) => string;

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
  steps: { label: "Numbered cards", render: cards.steps },
  "body-copy": { label: "Body copy", render: basic.bodyCopy },
  photo: { label: "Photo", render: basic.photo },
  map: { label: "World map", render: basic.worldMap },
  "icon-cards": { label: "Icon cards", render: cards.iconCards },
  "stat-grid": { label: "Stat grid", render: stats.statGrid },
  "brand-equity": { label: "Stats + intro", render: stats.brandEquity },
  "two-stats": { label: "Two stats", render: stats.twoStats },
  "single-stat": { label: "Single stat", render: stats.singleStat },
  "chart-bars": { label: "Bar chart", render: stats.chartBars },
  "donut-chart": { label: "Donut chart", render: stats.donutChart },
  timeline: { label: "Timeline", render: stats.timeline },
  "timeline-phases": { label: "Timeline phases", render: stats.timelinePhases },
  "example-image-left": { label: "Text + photo left", render: cards.exampleImage("left") },
  "example-image-right": { label: "Text + photo right", render: cards.exampleImage("right") },
  partner: { label: "Partners", render: basic.partners },
  "thank-you": { label: "Thank you", render: basic.thankYou },
  "tiers-1": { label: "Partnership tiers (1/2)", render: tables.tiers1 },
  "tiers-2": { label: "Partnership tiers (2/2)", render: tables.tiers2 },
};

export function renderSlide(slide: Slide, theme: BrandTheme): string {
  const def = LAYOUTS[slide.layoutId];
  if (!def) return "";
  return def.render(slide, theme);
}
