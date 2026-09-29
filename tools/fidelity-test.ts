/**
 * Unit checks for lib/slides/fidelity.ts, no model and no server:
 *
 *   npx tsx tools/fidelity-test.ts
 *
 * Each case is a source slide as pptx-source.ts writes it and a slide as the
 * model might return it. Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { compareSlide, figuresIn, isExact, isFlawed, planLeftovers, runningLines, sourceUnits, tokens, totals } from "../lib/slides/fidelity";
import { planReplica } from "../lib/slides/replicate";
import { continuationLabel, estimateFits, isWhole, putBack, rebuild, restoreCover, restoreSlide, trimAdded } from "../lib/slides/restore";
import type { SourceSlide } from "../lib/slides/pptx-source";
import type { SlideContent } from "../lib/slides/schema";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n${(err as Error).message}`);
    process.exit(1);
  }
}
const check = (text: string, slide: SlideContent, ignore?: Set<string>) => compareSlide(1, "t", sourceUnits({ text }, ignore), slide);

test("identical figure and line", () => {
  const r = check("Title: Internet penetration\nInternet penetration at 50%", {
    layoutId: "list",
    title: "Internet penetration",
    blocks: [{ label: "", body: "Internet penetration at 50%" }],
  });
  assert.equal(r.figures.ok, 1);
  assert.equal(r.figures.total, 1);
  assert.equal(r.lines.same, 2);
  assert.equal(r.words.kept, r.words.total);
  assert.equal(r.addedWords, 0);
  assert.ok(!isFlawed(r));
});

test("3.10 on the source is 3.1 on a bar", () => {
  const r = check(
    "Title: Benefits\nChart (line) data:\n- series: 0, 3.2, 6.1\nChart labels written on the slide, by column, top to bottom (the figures the reader sees; they win over the chart data, which may be stale): 2026: 0 | 27: 3.10 | 28: 6.12",
    { layoutId: "chart-line", title: "Benefits", series: ["Schools"], bars: [{ label: "2026", value: 0, values: [0] }, { label: "2027", value: 3.1, values: [3.1] }, { label: "2028", value: 6.12, values: [6.12] }] },
  );
  // The labels win: the stale series (3.2, 6.1) is not counted, the axis labels are not figures.
  assert.deepEqual(
    r.figures.wrong.map((w) => w.figure),
    [],
  );
  assert.equal(r.figures.total, 2);
});

test("a series dump is data, never prose, and its values meet the bars", () => {
  const u = sourceUnits({ text: "Title: Costs\nChart (bar) data:\n- series \"USD\": 2024=12.5, 2025=14" });
  assert.deepEqual(u.lines, ["Costs"]);
  assert.deepEqual(u.figures.map((f) => f.key), ["12.5", "14"]);
  const r = compareSlide(1, "Costs", u, { layoutId: "chart-bars", title: "Costs", bars: [{ label: "2024", value: 12.5 }, { label: "2025", value: 13 }] });
  assert.deepEqual(r.figures.wrong.map((w) => w.figure), ["14"]);
});

test("typographic minus is a hyphen, thousands separators and % spacing do not count", () => {
  assert.deepEqual(figuresIn("−32.79 and 12,750 and 76 %"), ["-32.79", "12750", "76%"]);
  const r = check("Title: Net\nNet cost -32.79 on 12750 schools", {
    layoutId: "list",
    title: "Net",
    blocks: [{ label: "", body: "Net cost −32.79 on 12,750 schools" }],
  });
  assert.equal(r.figures.ok, r.figures.total);
  assert.equal(r.lines.same, 2);
});

test("240K is not 240,000", () => {
  const r = check("Title: Reach\n240,000 students reached", { layoutId: "list", title: "Reach", blocks: [{ label: "", body: "240K students reached" }] });
  assert.deepEqual(r.figures.wrong.map((w) => w.figure), ["240000"]);
  assert.ok(isFlawed(r));
});

test("one word changed is touched, not missing", () => {
  const source = "Title: Reform\nBuild an inclusive digital nation and strengthen connected integrated digital health systems across all levels of care";
  const r = check(source, {
    layoutId: "list",
    title: "Reform",
    blocks: [{ label: "", body: "Build an inclusive digital nation and strengthen connected integrated digital health systems across every level of care" }],
  });
  assert.equal(r.lines.touched.length, 1);
  assert.equal(r.lines.missing.length, 0);
  assert.ok(r.lines.touched[0].score >= 0.85 && r.lines.touched[0].score < 1);
  assert.ok(r.lines.touched[0].deck.includes("every level"));
});

test("a rewritten line is changed, a dropped line is missing", () => {
  const r = check("Title: Why\nSchools are critical community anchors that improve learning\nReliable connectivity improves education and care coordination", {
    layoutId: "list",
    title: "Why",
    blocks: [{ label: "", body: "Schools are community anchors for better learning" }],
  });
  assert.equal(r.lines.changed.length, 1);
  assert.deepEqual(r.lines.missing, ["Reliable connectivity improves education and care coordination"]);
  assert.ok(isFlawed(r));
});

test("added text is found, stopwords do not count alone", () => {
  const r = check("Title: Scope\n1,975 schools are unconnected", {
    layoutId: "list",
    title: "Scope",
    blocks: [{ label: "Key insight", body: "1,975 schools are unconnected, a transformative opportunity" }],
  });
  assert.deepEqual(r.added, ["Key insight", "a transformative opportunity"]);
  assert.equal(r.addedWords, 4);
});

test("footnotes, sub-points and table cells are lines; speaker notes are not", () => {
  const u = sourceUnits({
    text: "Title: Costs\nCapEx\n- Fiber 1,071 km\nTable:\n| Item | USD m |\n| Fiber | 29.6 |\nFootnotes: 1. Cumulative 5-years; 2. over 5 years\nSpeaker notes: 27 September 2026",
  });
  assert.deepEqual(u.lines, ["Costs", "CapEx", "Fiber 1,071 km", "Item", "USD m", "Fiber", "1. Cumulative 5-years", "2. over 5 years"]);
  assert.ok(!u.figures.some((f) => f.key === "2026"));
  assert.ok(u.figures.some((f) => f.key === "29.6"));
});

test("a running header is not measured", () => {
  const slides: SourceSlide[] = [1, 2, 3, 4].map((n) => ({ n, kind: "content", title: `T${n}`, text: `Title: T${n}\nSchool & Health Facility Connectivity\nPoint ${n} about schools`, words: 8 }));
  const ignore = runningLines(slides);
  assert.ok(ignore.has(tokens("School & Health Facility Connectivity").join(" ")));
  const r = check(slides[0].text, { layoutId: "list", title: "T1", blocks: [{ label: "", body: "Point 1 about schools" }] }, ignore);
  assert.equal(r.lines.missing.length, 0);
});

test("a missing slide scores zero, totals add up, exact only when all is kept", () => {
  const u = sourceUnits({ text: "Title: A\nFirst 12 things" });
  const none = compareSlide(3, "A", u, null);
  assert.equal(none.figures.ok, 0);
  assert.deepEqual(none.lines.missing, ["A", "First 12 things"]);
  const full = compareSlide(3, "A", u, { layoutId: "list", title: "A", blocks: [{ label: "", body: "First 12 things" }] });
  assert.ok(isExact(totals([full])));
  assert.ok(!isExact(totals([full], [{ n: 9, title: "X", lines: [], reason: "failed" }])));
});

test("the plan's leftovers: an agenda line no chapter carries is a renamed chapter; a divider strapline is carried by a content slide", () => {
  const slides: SourceSlide[] = [
    { n: 1, kind: "cover", title: "Deck", text: "Title: Deck", words: 1 },
    { n: 2, kind: "agenda", title: "Agenda", text: "Title: Agenda\nOne\nTwo", words: 3, chapters: ["One", "Two"], current: 0 },
    { n: 3, kind: "content", title: "A", text: "Title: A\nText", words: 2 },
    { n: 4, kind: "agenda", title: "Agenda", text: "Title: Agenda\nOne\nTwo, renamed", words: 4, chapters: ["One", "Two, renamed"], current: 1 },
    { n: 5, kind: "content", title: "B", text: "Title: B\nText", words: 2 },
    { n: 6, kind: "divider", title: "Appendix", text: "Title: Appendix\nFor reference only", words: 4 },
    { n: 7, kind: "content", title: "C", text: "Title: C\nText", words: 2 },
  ];
  const { steps } = planReplica(slides);
  const left = planLeftovers(slides, steps);
  assert.deepEqual(
    left.map((l) => [l.n, l.reason, l.lines]),
    [[2, "renamed", ["Two"]]],
  );
  assert.ok(steps.some((st) => st.kind === "content" && st.source.n === 6));
});

test("a first slide that carries content is the cover and a content slide", () => {
  const text = `Title: Data Quality Report\n${Array.from({ length: 12 }, (_, i) => `Schools uploaded ${i + 10}`).join("\n")}`;
  const slides: SourceSlide[] = [{ n: 1, kind: "cover", title: "Data Quality Report", text, words: 51 }];
  const { steps } = planReplica(slides);
  assert.deepEqual(steps.map((s) => s.kind), ["cover", "content"]);
  assert.equal(steps[0].kind === "cover" && steps[0].source.text, "Title: Data Quality Report");
  assert.deepEqual(planLeftovers(slides, steps), []);
});

// ─── The app's guarantee: put back, rebuild, continue (lib/slides/restore.ts) ──

const units = (text: string, ignore?: Set<string>) => sourceUnits({ text }, ignore);
const whole = (text: string, out: SlideContent | SlideContent[]) => {
  const r = compareSlide(1, "t", units(text), out);
  assert.ok(isWhole(r), JSON.stringify({ missing: r.lines.missing, changed: r.lines.changed, touched: r.lines.touched, wrong: r.figures.wrong }));
  return r;
};

test("put back: a missing line goes after its neighbour in the source, in the same block, sub-point kept", () => {
  const text = "Title: Scope\nWhy schools\n- Anchors of the community\n- Faster adoption of digital services\n- Better care coordination\nCosts\n- Fiber 1,071 km";
  const slide: SlideContent = {
    layoutId: "bullet-columns",
    title: "Scope",
    blocks: [
      { label: "Why schools", body: "", items: ["- Anchors of the community", "- Better care coordination"] },
      { label: "Costs", body: "", items: ["- Fiber 1,071 km"] },
    ],
  };
  const r = putBack(slide, units(text));
  assert.ok(r);
  assert.deepEqual(r.slide.blocks![0].items, ["- Anchors of the community", "- Faster adoption of digital services", "- Better care coordination"]);
  assert.equal(r.count, 1);
  whole(text, r.slide);
});

test("put back: a changed line replaces the deck's version in place; a footnote goes to the notes", () => {
  const text = "Title: Reform\nBuild an inclusive digital nation and strengthen connected integrated digital health systems across all levels of care\nFootnotes: 1. Source: MoH 2025";
  const slide: SlideContent = { layoutId: "list", title: "Reform", blocks: [{ label: "", body: "Build an inclusive digital nation and strengthen connected health systems across every level of care" }] };
  const r = putBack(slide, units(text));
  assert.ok(r);
  // The line is the source's, word for word, where the model's was; the list stays standard, its text fits.
  assert.equal(r.slide.density, undefined);
  assert.equal(r.slide.notes, "1. Source: MoH 2025");
  assert.ok(JSON.stringify(r.slide).includes("across all levels of care"));
  assert.ok(!JSON.stringify(r.slide).includes("every level"));
  whole(text, r.slide);
});

const TWO_CHARTS =
  "Title: Costs over time\nCosts reach USD 42 million by 2031\nChart (line) data:\n- series: 0, -10.48, -24.22\nChart labels written on the slide, by column, top to bottom (the figures the reader sees; they win over the chart data, which may be stale): 2026: 0, 0 | 27: -0.85, -5.48 | 28: -2.05, -13.61 | 2026: 0, 0 | 27: -1.37, -8.91 | 28: -3.11";

test("the source's charts: an axis label seen again opens the second chart", () => {
  const u = units(TWO_CHARTS);
  assert.equal(u.charts.length, 2);
  assert.deepEqual(u.charts[0].columns.map((c) => c.label), ["2026", "27", "28"]);
  assert.deepEqual(u.charts[1].columns[2].values, ["-3.11"]);
});

test("put back: wrong bars take the source's values, the second chart's figures are written as the source writes them", () => {
  const slide: SlideContent = {
    layoutId: "chart-text",
    title: "Costs over time",
    bullets: ["Costs reach USD 42 million by 2031"],
    series: ["Schools", "Combined"],
    bars: [
      { label: "2026", value: 0, values: [0, 0] },
      { label: "2027", value: -0.9, values: [-0.9, -5.5] },
      { label: "2028", value: -2.05, values: [-2.05, -13.61] },
    ],
  };
  const r = putBack(slide, units(TWO_CHARTS));
  assert.ok(r);
  assert.deepEqual(r.slide.bars![1].values, [-0.85, -5.48]);
  assert.ok(r.slide.bullets!.some((b) => b.includes("27: -1.37, -8.91") && b.includes("28: -3.11")));
  whole(TWO_CHARTS, r.slide);
});

const IMPACT = [
  "Title: (School) internet connectivity",
  ...Array.from({ length: 34 }, (_, i) => (i % 4 === 0 ? `Pathway ${i / 4 + 1} learning outcomes` : `${i % 4 === 3 ? "- " : ""}Quantified potential number ${i} in The Gambia context with ${1000 + i * 7} people reached over five years`)),
].join("\n");

test("rebuild: a source that no layout's limits hold becomes bullet-columns in source order, continued when it does not fit at 18px", () => {
  const u = units(IMPACT);
  const parts = rebuild(u, "(School) internet connectivity", estimateFits);
  assert.ok(parts.length >= 2);
  assert.equal(parts[0].title, "(School) internet connectivity");
  assert.equal(parts[1].title, "(School) internet connectivity (cont.)");
  assert.ok(parts.every((p) => p.layoutId === "bullet-columns" && (p.blocks ?? []).every((b) => (b.items?.length ?? 0) <= 10)));
  assert.ok(parts.every((p) => estimateFits(p) === "ok"));
  // Sub-points keep their level; every line and figure is on one of the slides.
  assert.ok(parts.some((p) => p.blocks!.some((b) => b.items!.some((x) => x.startsWith("- Quantified")))));
  whole(IMPACT, parts);
});

test("rebuild: one chart plus text is chart-text; a chart it cannot draw is written as points", () => {
  const parts = rebuild(units(TWO_CHARTS), "Costs over time", estimateFits);
  assert.equal(parts[0].layoutId, "chart-text");
  assert.deepEqual(parts[0].bars!.map((b) => b.label), ["2026", "27", "28"]);
  whole(TWO_CHARTS, parts);
});

test("restore: a slide the model got right stays as it is; one it could not write is rebuilt; one past its layout's room is rebuilt", () => {
  const text = "Title: Reach\n240,000 students reached";
  const ok: SlideContent = { layoutId: "bullet-columns", title: "Reach", blocks: [{ label: "", body: "", items: ["240,000 students reached"] }] };
  const kept = restoreSlide(1, "Reach", units(text), ok, estimateFits);
  assert.equal(kept.slides[0], ok);
  assert.ok(!kept.rebuilt && !kept.putBack);
  const none = restoreSlide(1, "Reach", units(text), null, estimateFits);
  assert.ok(none.rebuilt && isWhole(none.report));
  const full: SlideContent = { layoutId: "stat-grid", title: "Reach", stats: [{ value: "240K", label: "students" }] };
  const back = restoreSlide(1, "Reach", units(text), full, estimateFits);
  assert.ok(isWhole(back.report));
  const big = restoreSlide(1, "t", units(IMPACT), { layoutId: "bullet-columns", title: "(School) internet connectivity", blocks: [{ label: "", body: "", items: ["Pathway 1 learning outcomes"] }] }, estimateFits);
  assert.ok(big.rebuilt && big.slides.length >= 2 && isWhole(big.report));
});

test("added text: an invented point and header go, a point that carries a source line stays, the title never", () => {
  const text = "Title: Scope\n1,975 schools are unconnected\nFiber reaches 1,071 km";
  const slide: SlideContent = {
    layoutId: "bullet-columns",
    title: "Scope",
    blocks: [
      { label: "Key insight", body: "", items: ["1,975 schools are unconnected", "A transformative opportunity awaits"] },
      { label: "", body: "", items: ["Fiber reaches 1,071 km"] },
    ],
  };
  const t = trimAdded(slide, units(text));
  assert.deepEqual(t.slide.blocks![0].items, ["1,975 schools are unconnected"]);
  assert.equal(t.slide.blocks![0].label, "");
  assert.equal(t.slide.title, "Scope");
  assert.equal(compareSlide(1, "t", units(text), t.slide).addedWords, 0);
});

test("cover: the source's other lines go in the subtitle; past what it holds, a content slide after the cover", () => {
  const text = "Title: Sustainable Connectivity in The Gambia\nInvestment Case\nSeptember 2026";
  const r = restoreCover(1, "t", units(text), { layoutId: "cover", title: "Sustainable Connectivity in The Gambia", subtitle: "Investment case" }, estimateFits);
  assert.equal(r.slides.length, 1);
  assert.equal(r.slides[0].subtitle, "Investment Case · September 2026");
  const long = `Title: Report\n${Array.from({ length: 6 }, (_, i) => `Line number ${i} of the cover text`).join("\n")}`;
  const r2 = restoreCover(1, "t", units(long), { layoutId: "cover", title: "Report", subtitle: "" }, estimateFits);
  assert.equal(r2.slides[0].layoutId, "cover");
  assert.ok(r2.slides.length === 2 && r2.slides[1].layoutId === "bullet-columns");
  whole(long, r2.slides);
});

test("the plan: a divider's strapline and a closing slide's contact line become content; content past 40 slides is never dropped", () => {
  const slides: SourceSlide[] = [
    { n: 1, kind: "cover", title: "Deck", text: "Title: Deck", words: 1 },
    { n: 2, kind: "divider", title: "Appendix", text: "Title: Appendix\nFor reference only", words: 4 },
    { n: 3, kind: "content", title: "A", text: "Title: A\nText", words: 2 },
    { n: 4, kind: "closing", title: "Thank you!", text: "Title: Thank you!\nwrite to connect@unicef.org", words: 5 },
  ];
  const { steps } = planReplica(slides);
  assert.deepEqual(
    steps.map((s) => (s.kind === "fixed" ? s.content.layoutId : `${s.kind}:${s.source.n}`)),
    ["cover:1", "section-divider", "content:2", "content:3", "content:4"],
  );
  assert.deepEqual(planLeftovers(slides, steps), []);
  const many: SourceSlide[] = [
    { n: 1, kind: "cover", title: "Deck", text: "Title: Deck", words: 1 },
    ...Array.from({ length: 45 }, (_, i): SourceSlide => ({ n: i + 2, kind: "content", title: `S${i}`, text: `Title: S${i}\nText ${i}`, words: 3 })),
  ];
  const plan = planReplica(many);
  assert.equal(plan.contentCount, 45);
  assert.deepEqual(planLeftovers(many, plan.steps), []);
});

test("a chapter named in other words on another agenda is said, not counted missing", () => {
  const slides: SourceSlide[] = [
    { n: 1, kind: "cover", title: "Deck", text: "Title: Deck", words: 1 },
    { n: 2, kind: "agenda", title: "Agenda", text: "Title: Agenda\nOne\nThe Challenge", words: 3, chapters: ["One", "The Challenge"], current: 0 },
    { n: 3, kind: "content", title: "A", text: "Title: A\nText", words: 2 },
    { n: 4, kind: "agenda", title: "Agenda", text: "Title: Agenda\nOne\nThe Learning Challenge", words: 4, chapters: ["One", "The Learning Challenge"], current: 0 },
    { n: 5, kind: "agenda", title: "Agenda", text: "Title: Agenda\nOne\nThe Challenge", words: 3, chapters: ["One", "The Challenge"], current: 1 },
    { n: 6, kind: "content", title: "B", text: "Title: B\nText", words: 2 },
  ];
  const left = planLeftovers(slides, planReplica(slides).steps);
  assert.deepEqual(left.map((l) => [l.n, l.reason, l.lines]), [[4, "renamed", ["The Learning Challenge"]]]);
  assert.equal(totals([], left).missing, 0);
});

test("rebuild: a slide that is mostly figures written apart from the text is figures-panel", () => {
  const text = "Title: Uploads\nSchools uploaded\nSchools passed\nFigures written on the slide (chart labels; these win over chart data): 248,928, 245,405, 3,523, 159,115, 1,257, 2,266, 118,035";
  const parts = rebuild(units(text), "Uploads", estimateFits);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].layoutId, "figures-panel");
  assert.deepEqual(parts[0].blocks!.flatMap((b) => b.stats!.map((x) => x.value)), ["248,928", "245,405", "3,523", "159,115", "1,257", "2,266", "118,035"]);
  whole(text, parts);
});

test("continuation label: the source's own convention, else (cont.)", () => {
  assert.equal(continuationLabel(["Costs", "Costs (continued)"]), "(continued)");
  assert.equal(continuationLabel(["Costs"]), "(cont.)");
});

console.log(`\n${passed} passed`);
