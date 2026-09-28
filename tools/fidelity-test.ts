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

test("the plan's leftovers: an agenda line no chapter carries (the chapter was renamed later), a divider strapline", () => {
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
    left.map((l) => [l.n, l.lines]),
    [
      [2, ["Two"]],
      [6, ["For reference only"]],
    ],
  );
});

test("a first slide that carries content is the cover and a content slide", () => {
  const text = `Title: Data Quality Report\n${Array.from({ length: 12 }, (_, i) => `Schools uploaded ${i + 10}`).join("\n")}`;
  const slides: SourceSlide[] = [{ n: 1, kind: "cover", title: "Data Quality Report", text, words: 51 }];
  const { steps } = planReplica(slides);
  assert.deepEqual(steps.map((s) => s.kind), ["cover", "content"]);
  assert.equal(steps[0].kind === "cover" && steps[0].source.text, "Title: Data Quality Report");
  assert.deepEqual(planLeftovers(slides, steps), []);
});

console.log(`\n${passed} passed`);
