/**
 * Unit checks for lib/slides/pptx-source.ts, no model and no server:
 *
 *   npx tsx tools/pptx-source-test.ts
 *
 * Each case is a small PowerPoint file built here with the shapes a real deck
 * uses, read by `readPptx`. The cases come from "The price of a gigabit"
 * (15 Oct 2026), whose replica came back with "2.2 billion" as a title, "The
 * problem" as a label on every card and "Figures written on the slide (…):
 * 96, 54, ., 9" on a slide. Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import JSZip from "jszip";
import { readPptx } from "../lib/slides/pptx-source";

const W = 12192000;
const H = 6858000;

interface Box {
  text: string | string[];
  y: number;
  x?: number;
  w?: number;
  /** In hundredths of a point. */
  sz?: number;
  ph?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function shape(
  { text, y, x = 0.06, w = 0.4, sz = 1400, ph }: Box,
  i: number,
): string {
  const paras = (Array.isArray(text) ? text : [text])
    .map(
      (t) =>
        `<a:p><a:r><a:rPr lang="en-US" sz="${sz}"/><a:t>${esc(t)}</a:t></a:r></a:p>`,
    )
    .join("");
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${i + 2}" name="Text ${i}"/><p:cNvSpPr/><p:nvPr>${ph ? `<p:ph type="${ph}"/>` : ""}</p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${Math.round(x * W)}" y="${Math.round(y * H)}"/><a:ext cx="${Math.round(w * W)}" cy="${Math.round(0.05 * H)}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp>`
  );
}

async function deck(slides: Box[][]) {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships>${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  slides.forEach((boxes, i) =>
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<p:sld><p:cSld><p:spTree>${boxes.map(shape).join("")}</p:spTree></p:cSld></p:sld>`,
    ),
  );
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return readPptx(buf);
}

/** The footer every slide of the gigabit deck carries: the chapter, the site, the slide number. */
const footer = (chapter: string, n: number): Box[] => [
  { text: chapter, y: 0.93, sz: 1200 },
  { text: "digitalinclusion.global", y: 0.93, x: 0.33, sz: 1200 },
  { text: String(n), y: 0.93, x: 0.83, w: 0.01, sz: 1200 },
];

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n${(err as Error).message}`);
    process.exit(1);
  }
}

async function main() {
  const cover: Box[] = [{ text: "The price of a gigabit", y: 0.3, sz: 4400 }];
  const stats = (n: number, chapter: string): Box[] => [
    {
      text: "The frontier is moving. Diffusion is stuck on bandwidth",
      y: 0.09,
      w: 0.9,
      sz: 2400,
      ph: "title",
    },
    { text: "2.2 billion", y: 0.24, sz: 6000 },
    { text: "people offline in 2025", y: 0.36 },
    { text: "96%", y: 0.48, sz: 6000 },
    { text: "of them live in low- and middle-income countries", y: 0.6 },
    ...footer(chapter, n),
  ];

  await test("a title placeholder is the title, not the largest figure", async () => {
    const { slides } = await deck([
      cover,
      stats(2, "The problem"),
      stats(3, "The problem"),
    ]);
    assert.equal(
      slides[1].title,
      "The frontier is moving. Diffusion is stuck on bandwidth",
    );
    assert.match(slides[1].text, /^2\.2 billion$/m);
  });

  await test("a figure in display type is a stat value in its place, not a chart label", async () => {
    const { slides } = await deck([
      cover,
      stats(2, "The problem"),
      stats(3, "The problem"),
    ]);
    assert.match(slides[1].text, /^96%\npeople|^96%$/m);
    assert.doesNotMatch(slides[1].text, /Figures written on the slide/);
  });

  await test("the footer's chapter name, site and slide number are not content", async () => {
    const { slides } = await deck([
      cover,
      stats(2, "The problem"),
      stats(3, "The problem"),
      stats(4, "The solution"),
    ]);
    for (const s of slides.slice(1)) {
      assert.doesNotMatch(s.text, /The problem|The solution|digitalinclusion/);
      assert.doesNotMatch(s.text, /^\d$/m);
    }
  });

  await test("a chapter name in the footer of one slide only goes with the row it sits in", async () => {
    const { slides } = await deck([
      cover,
      stats(2, "The problem"),
      stats(3, "The problem"),
      stats(4, "The vision"),
    ]);
    assert.doesNotMatch(slides[3].text, /The vision/);
  });

  await test("a full stop alone in its box is not a figure", async () => {
    const slide: Box[] = [
      {
        text: "Instrument 1 · Price discovery",
        y: 0.09,
        sz: 2400,
        ph: "title",
      },
      { text: "Aim: prices 30 to 50% lower", y: 0.71, sz: 1300 },
      { text: "[basis to add]", y: 0.71, x: 0.26, sz: 1300 },
      { text: ".", y: 0.71, x: 0.35, w: 0.01, sz: 1300 },
    ];
    const { slides } = await deck([cover, slide]);
    assert.doesNotMatch(slides[1].text, /Figures written|^\.$/m);
  });

  await test("step numbers in circles are ordinals, not figures; a symbol that means something stays", async () => {
    const slide: Box[] = [
      {
        text: "This playbook has worked before, on vaccines",
        y: 0.09,
        sz: 2400,
        ph: "title",
      },
      { text: "1", y: 0.25, x: 0.5, w: 0.02 },
      { text: "Pool demand across countries", y: 0.25, x: 0.55 },
      { text: "2", y: 0.32, x: 0.5, w: 0.02 },
      { text: "Publish the prices", y: 0.32, x: 0.55 },
      { text: "3", y: 0.39, x: 0.5, w: 0.02 },
      { text: "Bring in more suppliers", y: 0.39, x: 0.55 },
      { text: "✅", y: 0.6, x: 0.1, w: 0.02 },
    ];
    const { slides } = await deck([cover, slide]);
    assert.doesNotMatch(slides[1].text, /Figures written/);
    assert.match(slides[1].text, /✅/);
  });

  await test("a heading broken by hand over two lines of one box is one title", async () => {
    const slide: Box[] = [
      { text: ["Where We", "Are Now"], y: 0.09, sz: 2850 },
      {
        text: "Schools mapped across the country, verified on the ground.",
        y: 0.4,
      },
    ];
    const { slides } = await deck([cover, slide]);
    assert.equal(slides[1].title, "Where We Are Now");
  });

  await test("small chart labels stay chart labels", async () => {
    const slide: Box[] = [
      {
        text: "Share of people using the internet",
        y: 0.09,
        sz: 2400,
        ph: "title",
      },
      { text: "High-income countries", y: 0.3, x: 0.49 },
      { text: "94%", y: 0.3, x: 0.88, w: 0.06 },
      { text: "Low-income countries", y: 0.44, x: 0.52 },
      { text: "23%", y: 0.44, x: 0.73, w: 0.06 },
    ];
    const { slides } = await deck([cover, slide]);
    assert.match(
      slides[1].text,
      /Figures written on the slide \(chart labels; these win over chart data\): 94%, 23%|: 23%, 94%/,
    );
  });

  await test("a key-value grid reads each key with its value on one line; two equal columns of figures do not", async () => {
    const keys = ["Band", "Area", "Valid", "Power"];
    const values = ["3.5 GHz, 40 MHz", "One district", "12 months, revocable", "Limit set by the regulator"];
    const grid: Box[] = [
      { text: "Instrument 2 · Spectrum certificates", y: 0.09, sz: 2400, ph: "title" },
      ...keys.map((text, i) => ({ text, y: 0.33 + i * 0.05, x: 0.08, w: 0.09, sz: 1200 })),
      ...values.map((text, i) => ({ text, y: 0.33 + i * 0.05, x: 0.18, w: 0.27, sz: 1200 })),
    ];
    const stats: Box[] = [
      { text: "Hong Kong Digital Inclusion Center", y: 0.09, sz: 2400, ph: "title" },
      ...[0, 1, 2].flatMap((r) => [
        { text: `${61 - r * 20}%`, y: 0.3 + r * 0.2, x: 0.1, w: 0.3, sz: 4400 },
        { text: "Insert text here", y: 0.37 + r * 0.2, x: 0.1, w: 0.3 },
        { text: `${54 - r * 20}%`, y: 0.3 + r * 0.2, x: 0.42, w: 0.3, sz: 4400 },
        { text: "Insert text here", y: 0.37 + r * 0.2, x: 0.42, w: 0.3 },
      ]),
    ];
    const { slides } = await deck([cover, grid, stats]);
    assert.match(slides[1].text, /^Band: 3\.5 GHz, 40 MHz\nArea: One district\nValid: 12 months, revocable\n/m);
    assert.match(slides[2].text, /^61%\nInsert text here\n41%\n/m);
  });

  console.log(`\n${passed} passed`);
}

main();
