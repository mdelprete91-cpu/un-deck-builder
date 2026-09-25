/**
 * QA suite: twenty briefs of different nature through the real pipeline.
 *
 * Runs against the dev server (`npx next dev -p 3777`) exactly as the editor
 * does: the brief is read with lib/slides/brief.ts (count, series, tiers),
 * the request is the one onGenerate sends, every slide goes through
 * normalizeSlide, the chapter filter, the rhythm pass and the year guard,
 * and a short counted deck is topped up with one add request. Then each
 * deck is scored against what its brief asked for and against the
 * catalog's word limits, and the decks are saved for a look.
 *
 *   npx tsx tools/qa-suite.ts                 all prompts, 3 at a time
 *   npx tsx tools/qa-suite.ts okr-series tiers  a subset
 *   QA_URL=https://un-deck-builder.vercel.app npx tsx tools/qa-suite.ts
 *
 * Each brief is a real model call, about a cent. Output goes to
 * .omc/qa/<timestamp>/ (gitignored): one JSON per deck and report.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { countFromBrief, seriesFromBrief, uniformFromBrief, MIN_SLIDES_WITH_CHAPTERS, TIERS_REQUEST } from "../lib/slides/brief";
import { normalizeSlide, type LayoutId, type SlideContent } from "../lib/slides/schema";
import { makeRhythm, stripInventedYear } from "../lib/slides/rhythm";
import { PARTNER_NAMES } from "../lib/slides/partners";
import { extractXlsx, type Attachment } from "../lib/slides/attachments";

const URL = process.env.QA_URL ?? "http://localhost:3777";
const BRAND_ID = "did";
const BRAND_LABEL = "Digital Impact Division";
const CHAPTER_LAYOUTS = new Set(["agenda", "section-divider"]);
const STRUCTURAL = new Set(["cover", "agenda", "section-divider", "thank-you"]);
/** Layouts with no title field, plus single-stat, which the rhythm pass makes from a titleless big-stat. */
const NO_TITLE = new Set(["big-stat", "quote", "photo-full", "single-stat"]);
const BANNED = /\b(leveraging|synergies|cutting-edge|revolutionary|empower(?:s|ed|ing)?|unlock(?:s|ed|ing)?)\b/i;

interface Prompt {
  id: string;
  brief?: string;
  briefFile?: string;
  lang: "en" | "it" | "es";
  chapters?: boolean;
  /** A workbook under tools/qa-briefs attached to the brief, as the composer would (one table per sheet). */
  xlsx?: string;
  /** The answer to the composer's "what should the deck draw from it" card. */
  insights?: string;
  expect: {
    count?: number;
    min?: number;
    max?: number;
    series?: number;
    sameLayout?: boolean;
    titles?: string[];
    labels?: string[][];
    layoutsAny?: LayoutId[];
    numbers?: string[];
    text?: string[];
    partners?: string[];
    tiers?: boolean;
    chapters?: boolean;
    allowGiga?: boolean;
  };
}

/** Word limits per layout field, the catalog's `fields` strings as numbers. */
const LIMITS: Partial<Record<LayoutId, { title?: number; subtitle?: number; body?: number; label?: number; blockBody?: number | ((n: number) => number); statLabel?: number; support?: number; quote?: number; barLabel?: number; bullet?: number }>> = {
  cover: { title: 6, subtitle: 10 },
  agenda: { bullet: 5 },
  "three-columns": { title: 3, label: 3, blockBody: 20 },
  callout: { title: 5, label: 2, blockBody: (n) => (n >= 4 ? 8 : n === 3 ? 16 : 32) },
  "section-divider": { title: 5 },
  "big-stat": { support: 35 },
  quote: { quote: 24 },
  "section-image-deep": { title: 6, body: 45 },
  "section-image-light": { title: 6, body: 45 },
  "four-cards": { title: 6, label: 2, blockBody: 16 },
  list: { title: 10, label: 2, blockBody: (n) => (n >= 5 ? 30 : n === 4 ? 45 : 60) },
  steps: { title: 6, label: 2, blockBody: 8 },
  "body-copy": { title: 6, blockBody: 60 },
  photo: { title: 6 },
  "icon-cards": { title: 6, label: 2, blockBody: 12 },
  "stat-grid": { title: 8, statLabel: 5 },
  "brand-equity": { title: 6, body: 35, statLabel: 14 },
  "two-stats": { title: 8, statLabel: 15 },
  "single-stat": { title: 8, support: 30 },
  "chart-bars": { title: 4, barLabel: 2 },
  "donut-chart": { title: 6, barLabel: 4 },
  "chart-columns-wide": { title: 8, barLabel: 2 },
  "chart-bars-horizontal": { title: 8, barLabel: 4 },
  "chart-line": { title: 8, barLabel: 2 },
  "chart-columns-grouped": { title: 8, barLabel: 2 },
  "chart-columns-stacked": { title: 8, barLabel: 2 },
  timeline: { title: 3, blockBody: 6 },
  "timeline-phases": { title: 4, blockBody: 7 },
  "example-image-left": { title: 6, label: 2, blockBody: 30 },
  "example-image-right": { title: 6, label: 2, blockBody: 30 },
  partner: { title: 3 },
};

const words = (t?: string) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;
/** A chart value as the renderer prints it (fmt in layouts/stats.ts), so "12,750" in `expect.numbers` finds a bar of 12750. */
const fmtNum = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 10) / 10));
/** The slide's prose: what the language check reads (a chart's thirty country names are not a language). */
const proseOf = (s: SlideContent) =>
  [s.title, s.subtitle, s.stat, s.support, s.quote, s.author, s.body, ...(s.bullets ?? []), ...(s.blocks ?? []).flatMap((b) => [b.label, b.body]), ...(s.stats ?? []).flatMap((x) => [x.value, x.label])]
    .filter(Boolean)
    .join(" ");
const textOf = (s: SlideContent) =>
  [proseOf(s), ...(s.series ?? []), ...(s.bars ?? []).flatMap((b) => [b.label, fmtNum(b.value), ...(b.values ?? []).map(fmtNum)])]
    .filter(Boolean)
    .join(" ");

/** Fields over their word limit: "3 · four-cards blocks.1.body 22/16". */
function overflows(s: SlideContent, index: number): string[] {
  const lim = LIMITS[s.layoutId];
  if (!lim) return [];
  const out: string[] = [];
  const check = (field: string, text: string | undefined, max?: number) => {
    if (max && words(text) > max) out.push(`${index} · ${s.layoutId} ${field} ${words(text)}/${max}`);
  };
  check("title", s.title, lim.title);
  check("subtitle", s.subtitle, lim.subtitle);
  check("body", s.body, lim.body);
  check("support", s.support, lim.support);
  check("quote", s.quote, lim.quote);
  const n = s.blocks?.length ?? 0;
  const bodyMax = typeof lim.blockBody === "function" ? lim.blockBody(n) : lim.blockBody;
  (s.blocks ?? []).forEach((b, i) => {
    check(`blocks.${i}.label`, b.label, lim.label);
    check(`blocks.${i}.body`, b.body, bodyMax);
  });
  (s.stats ?? []).forEach((x, i) => check(`stats.${i}.label`, x.label, lim.statLabel));
  (s.bars ?? []).forEach((b, i) => check(`bars.${i}.label`, b.label, lim.barLabel));
  (s.bullets ?? []).forEach((b, i) => check(`bullets.${i}`, b, lim.bullet));
  return out;
}

const STOP: Record<string, RegExp> = {
  en: /\b(the|and|of|for|with|to)\b/gi,
  it: /\b(il|la|di|per|con|delle|degli|dei|una|che)\b/gi,
  es: /\b(el|la|de|para|con|los|las|una|que|y)\b/gi,
};

async function generate(body: Record<string, unknown>): Promise<{ slides: unknown[]; meta?: { insertAfter?: number }; truncated: boolean; usage?: { inputTokens: number; outputTokens: number }; error?: string }> {
  const res = await fetch(`${URL}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) return { slides: [], truncated: false, error: `HTTP ${res.status} ${(await res.text()).slice(0, 200)}` };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const out: { slides: unknown[]; meta?: { insertAfter?: number }; truncated: boolean; usage?: { inputTokens: number; outputTokens: number }; error?: string } = { slides: [], truncated: false };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      if (ev.type === "slide") out.slides.push(ev.slide);
      else if (ev.type === "meta") out.meta = ev;
      else if (ev.type === "done") {
        out.truncated = !!ev.truncated;
        out.usage = ev.usage;
      } else if (ev.type === "error") out.error = ev.message;
    }
  }
  return out;
}

interface Result {
  id: string;
  slides: SlideContent[];
  layouts: string[];
  findings: string[];
  warnings: string[];
  overflow: string[];
  cost: number;
  seconds: number;
  truncated: boolean;
  error?: string;
}

async function runPrompt(p: Prompt): Promise<Result> {
  const brief = p.brief ?? readFileSync(join("tools/qa-briefs", p.briefFile!), "utf8");
  const count = countFromBrief(brief);
  const perItem = seriesFromBrief(brief);
  const chapters = !!p.chapters && !(count !== undefined && count < MIN_SLIDES_WITH_CHAPTERS);
  const wanted = count === undefined ? undefined : perItem ? count + 2 : count;
  const rhythm = makeRhythm({ series: perItem, uniform: uniformFromBrief(brief), cap: wanted });
  const attachments: Attachment[] = [];
  if (p.xlsx) {
    const buf = readFileSync(join("tools/qa-briefs", p.xlsx));
    const text = await extractXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    attachments.push({ id: "qa", name: p.xlsx, kind: "text", text, bytes: text.length, spreadsheet: true, ...(p.insights ? { insights: p.insights } : {}) });
  }
  const t0 = Date.now();
  let cost = 0;
  const post = (raw: unknown): SlideContent | null => {
    const c = normalizeSlide(raw, { brandId: BRAND_ID });
    if (!c) return null;
    if (!chapters && CHAPTER_LAYOUTS.has(c.layoutId)) return null;
    return rhythm(stripInventedYear(c, brief));
  };
  const first = await generate({ mode: "generate", brief, attachments, brandLabel: BRAND_LABEL, chapters, format: "slides", count, perItem });
  // gpt-6-luna list price (25 Sep 2026), the same as GenerationReadout.
  const usage = (u?: { inputTokens: number; outputTokens: number }) => (u ? (u.inputTokens * 0.1 + u.outputTokens * 0.5) / 1_000_000 : 0);
  cost += usage(first.usage);
  let slides = first.slides.map(post).filter((s): s is SlideContent => !!s);
  const findings: string[] = [];
  const warnings: string[] = [];
  if (first.error) findings.push(`route error: ${first.error}`);
  for (let attempt = 0; attempt < 2 && wanted && slides.length > 0 && slides.length < wanted && !first.truncated; attempt++) {
    const missing = wanted - slides.length;
    const add = await generate({
      mode: "add",
      brief,
      attachments,
      instruction: `The deck must have ${wanted} slides and has ${slides.length}. Add the ${missing} still missing: ${perItem ? "the items of the brief that have no slide yet, one slide each" : "beats of the brief and the material not yet covered"}, never a repeat of an existing slide.`,
      count: missing,
      brandLabel: BRAND_LABEL,
      chapters,
      format: "slides",
      existingSlides: slides,
    });
    cost += usage(add.usage);
    const extra = add.slides.map((raw) => normalizeSlide(raw, { brandId: BRAND_ID })).filter((s): s is SlideContent => !!s && !STRUCTURAL.has(s.layoutId)).slice(0, missing);
    const at = Math.min(Math.max(add.meta?.insertAfter ?? slides.length - 1, 1), slides.length - 1);
    slides = [...slides.slice(0, at), ...extra, ...slides.slice(at)];
    warnings.push(`topped up: +${extra.length} after a short deck of ${slides.length - extra.length}`);
  }
  const seconds = (Date.now() - t0) / 1000;
  const layouts = slides.map((s) => s.layoutId);
  const content = slides.filter((s) => !STRUCTURAL.has(s.layoutId));
  const e = p.expect;
  const all = slides.map(textOf).join(" ");
  const bodyText = content.map(textOf).join(" ");

  // Structure
  if (slides[0]?.layoutId !== "cover") findings.push("no cover first");
  if (slides[slides.length - 1]?.layoutId !== "thank-you") findings.push("no closing slide last");
  if (first.truncated) findings.push("TRUNCATED");
  if (e.count !== undefined) {
    const target = perItem ? e.count + 2 : e.count;
    if (slides.length !== target) findings.push(`count ${slides.length} ≠ ${target}`);
  }
  if (e.min !== undefined && slides.length < e.min) findings.push(`too short: ${slides.length} < ${e.min}`);
  if (e.max !== undefined && slides.length > e.max) findings.push(`too long: ${slides.length} > ${e.max}`);
  const hasChapters = layouts.some((l) => CHAPTER_LAYOUTS.has(l));
  if (chapters && !hasChapters) findings.push("chapters on, none in deck");
  if (!chapters && hasChapters) findings.push("chapters off, dividers leaked");
  if (chapters) {
    const agenda = slides.find((s) => s.layoutId === "agenda");
    const dividers = slides.filter((s) => s.layoutId === "section-divider").map((s) => s.title?.trim().toLowerCase());
    const bullets = (agenda?.bullets ?? []).map((b) => b.trim().toLowerCase());
    if (agenda && JSON.stringify(bullets) !== JSON.stringify(dividers)) findings.push(`agenda ≠ dividers (${bullets.length} vs ${dividers.length})`);
  }
  // Series
  if (e.series !== undefined) {
    if (content.length !== e.series) findings.push(`series: ${content.length} content slides ≠ ${e.series}`);
    if (e.sameLayout && new Set(content.map((s) => s.layoutId)).size > 1) findings.push(`same layout asked, got ${[...new Set(content.map((s) => s.layoutId))].join("/")}`);
    e.titles?.forEach((t, i) => {
      if (!content[i]?.title?.toLowerCase().includes(t.toLowerCase())) findings.push(`slide ${i + 2} title "${content[i]?.title}" lacks "${t}"`);
    });
    e.labels?.forEach((want, i) => {
      const got = (content[i]?.blocks ?? []).map((b) => b.label.trim());
      if (JSON.stringify(got) !== JSON.stringify(want)) findings.push(`slide ${i + 2} labels ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
    });
  }
  // Rhythm (outside an explicit same-layout series)
  if (!e.sameLayout) {
    let run = 1, worst = 1;
    for (let i = 1; i < content.length; i++) {
      const same = content[i].layoutId === content[i - 1].layoutId;
      // Five or six points fit only the list: a run of those is the text's.
      const forced = content[i].layoutId === "list" && (content[i].blocks?.length ?? 0) >= 5 && (content[i - 1].blocks?.length ?? 0) >= 5;
      run = same && !forced ? run + 1 : 1;
      worst = Math.max(worst, run);
    }
    if (worst >= 3) findings.push(`${worst} identical layouts in a row`);
  }
  // Content
  e.layoutsAny && !e.layoutsAny.some((l) => layouts.includes(l)) && findings.push(`none of ${e.layoutsAny.join("/")}`);
  e.numbers?.forEach((n) => !all.includes(n) && findings.push(`number ${n} missing`));
  e.text?.forEach((t) => !all.toLowerCase().includes(t.toLowerCase()) && findings.push(`text "${t}" missing`));
  if (e.partners) {
    // Every named partner must be mentioned; the wall is required only when
    // all of them have a logo (a wall with one name of two is worse than
    // none: Ericsson yes, Vodafone no, 23 Sep 2026).
    const names: readonly string[] = PARTNER_NAMES;
    const partner = slides.find((s) => s.layoutId === "partner");
    const bad = (partner?.bullets ?? []).filter((b) => !names.includes(b));
    if (bad.length) findings.push(`partner names not in list: ${bad.join(", ")}`);
    e.partners.forEach((n) => !all.includes(n) && findings.push(`partner ${n} not mentioned`));
    if (e.partners.every((n) => names.includes(n)) && !partner) findings.push("no partner wall");
  }
  if (e.tiers && !TIERS_REQUEST.test(brief)) findings.push("tiers asked, trigger silent");
  if (!e.tiers && TIERS_REQUEST.test(brief)) findings.push("tiers trigger fired uninvited");
  // Drift, invention, voice
  const briefMentions = /\b(giga|unicef)\b/i.test(brief);
  if (!briefMentions && !e.allowGiga) {
    const hits = bodyText.match(/\b(giga|unicef|2\.2M\+?|giga\.global)\b/gi);
    if (hits) findings.push(`drift: ${[...new Set(hits.map((h) => h.toLowerCase()))].join(", ")}`);
  }
  // A year the brief never gave is a warning, not a failure: "by 2030" in a
  // body is a target, not a fact, and only the cover's subtitle is guarded.
  // The attached sheet is source material too: its years are given, not invented.
  const given = brief + " " + attachments.map((a) => (a.kind === "text" ? a.text : "")).join(" ");
  const years = [...new Set(all.match(/\b(?:19|20)\d{2}\b/g) ?? [])].filter((y) => !given.includes(y));
  if (years.length) warnings.push(`years not in brief: ${years.join(", ")}`);
  const banned = all.match(BANNED);
  if (banned) findings.push(`banned word: ${banned[0]}`);
  const emails = (all.match(/[\w.]+@[\w.]+/g) ?? []).filter((m) => !brief.includes(m));
  if (emails.length) findings.push(`invented email: ${emails[0]}`);
  // Language
  // Prose only: a chart's country names ("El Salvador") are not a language.
  const proseText = content.map(proseOf).join(" ");
  const counts = Object.fromEntries(Object.entries(STOP).map(([l, re]) => [l, (proseText.match(re) ?? []).length]));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top && top !== p.lang) findings.push(`language looks ${top}, brief is ${p.lang}`);
  // Empties and duplicates
  slides.forEach((s, i) => {
    if (!STRUCTURAL.has(s.layoutId) && !NO_TITLE.has(s.layoutId) && !s.title?.trim()) findings.push(`${i + 1} · ${s.layoutId} empty title`);
    (s.blocks ?? []).forEach((b, j) => {
      if (!b.body?.trim()) findings.push(`${i + 1} · ${s.layoutId} blocks.${j} empty body`);
    });
    (s.stats ?? []).forEach((x, j) => {
      if (!/\d/.test(x.value)) findings.push(`${i + 1} · ${s.layoutId} stats.${j} value "${x.value}" is not a figure`);
    });
  });
  const titles = content.map((s) => s.title?.trim().toLowerCase()).filter(Boolean);
  if (new Set(titles).size !== titles.length) findings.push("duplicate titles");
  const overflow = slides.flatMap(overflows);
  return { id: p.id, slides, layouts, findings, warnings, overflow, cost, seconds, truncated: first.truncated, error: first.error };
}

async function main() {
  const only = process.argv.slice(2);
  const prompts = (JSON.parse(readFileSync("tools/qa-prompts.json", "utf8")) as Prompt[]).filter((p) => !only.length || only.includes(p.id));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(".omc/qa", stamp);
  mkdirSync(dir, { recursive: true });
  const results: Result[] = [];
  const queue = [...prompts];
  const worker = async () => {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      try {
        const r = await runPrompt(p);
        results.push(r);
        writeFileSync(join(dir, `${p.id}.json`), JSON.stringify(r, null, 1));
        console.log(`${p.id.padEnd(18)} ${String(r.slides.length).padStart(2)} slides  ${r.findings.length ? "FAIL " + r.findings.join(" | ") : "ok"}${r.warnings.length ? `  warn: ${r.warnings.join(" | ")}` : ""}${r.overflow.length ? `  (${r.overflow.length} over limit)` : ""}`);
      } catch (err) {
        results.push({ id: p.id, slides: [], layouts: [], findings: [`crash: ${(err as Error).message}`], warnings: [], overflow: [], cost: 0, seconds: 0, truncated: false });
        console.log(`${p.id.padEnd(18)} crash ${(err as Error).message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  results.sort((a, b) => prompts.findIndex((p) => p.id === a.id) - prompts.findIndex((p) => p.id === b.id));
  const lines = [
    `# QA suite ${stamp} against ${URL}`,
    "",
    "| id | slides | layouts | findings | warnings | over limit | cost | s |",
    "|---|---|---|---|---|---|---|---|",
    ...results.map((r) => `| ${r.id} | ${r.slides.length} | ${r.layouts.join(", ")} | ${r.findings.join("; ") || "ok"} | ${r.warnings.join("; ")} | ${r.overflow.length} | $${r.cost.toFixed(3)} | ${r.seconds.toFixed(0)} |`),
    "",
    `Passed ${results.filter((r) => !r.findings.length).length}/${results.length}. Total cost $${results.reduce((a, r) => a + r.cost, 0).toFixed(3)}.`,
    "",
    "## Over limit",
    ...results.flatMap((r) => r.overflow.map((o) => `- ${r.id}: ${o}`)),
  ];
  writeFileSync(join(dir, "report.md"), lines.join("\n"));
  console.log(`\nreport: ${dir}/report.md`);
  console.log(lines[lines.length - results.flatMap((r) => r.overflow).length - 3]);
}

main();
