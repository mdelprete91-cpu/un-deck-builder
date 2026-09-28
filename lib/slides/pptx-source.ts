import JSZip from "jszip";

/**
 * A PowerPoint file read as the deck it is (28 Sep 2026, for "replicate this
 * deck": the Gambia investment case, 38 slides, came back as 11 because the
 * model saw one undifferentiated text and chose a length). Slides in the
 * order the presentation shows them (`sldIdLst`, not the file names), hidden
 * ones skipped, every paragraph with its level ("- " opens a sub-point, the
 * convention of the dense layouts' `items`), tables as pipe rows, charts with
 * their series from the chart part, footnotes apart, and the boilerplate that
 * repeats on most slides (footer handles, the running header) removed.
 *
 * Each slide gets a kind the replicate plan reads: an agenda (the title says
 * so, or the text repeats an earlier agenda: the Gambia deck shows the agenda
 * seven times, the chapter in progress in another colour), a divider (a
 * title and little else), the closing slide, or content.
 */

export type SourceKind = "cover" | "content" | "agenda" | "divider" | "closing";

export interface SourceSlide {
  /** Position in the presentation, 1-based, hidden slides not counted. */
  n: number;
  kind: SourceKind;
  title: string;
  /** Everything the slide says, for the model: title, points, tables, charts, footnotes. */
  text: string;
  /** Agenda slides: the chapter titles, and which one this agenda marks as current (-1 if none). */
  chapters?: string[];
  current?: number;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

function relsOf(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

/** "slides/slide3.xml" relative to "ppt/" → "ppt/slides/slide3.xml"; "../charts/chart1.xml" from ppt/slides → "ppt/charts/chart1.xml". */
function resolve(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/");
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

interface Para {
  text: string;
  level: number;
  /** Largest run size on the line, in hundredths of a point (0 if not set). */
  size: number;
  /** The colours the runs use, for telling the agenda's current chapter apart. */
  colour: string;
}

function paragraphs(xml: string, fallbackSize = 0): Para[] {
  const out: Para[] = [];
  for (const m of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\s[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const body = m[1] ?? m[2] ?? "";
    const text = decode([...body.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join(""))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const level = Number(/<a:pPr\b[^>]*\blvl="(\d)"/.exec(body)?.[1] ?? 0);
    // Run sizes only: the end-of-paragraph mark often keeps a bigger default.
    const sizes = [...body.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map((s) => Number(s[1]));
    const colour = [...new Set([...body.matchAll(/<a:(?:srgbClr|schemeClr) val="(\w+)"/g)].map((c) => c[1]))].sort().join(",");
    out.push({ text, level, size: sizes.length ? Math.max(...sizes) : fallbackSize, colour });
  }
  return out;
}

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

function readChart(xml: string): string {
  const type = /<c:(\w+?)Chart>/.exec(xml)?.[1] ?? "chart";
  const lines: string[] = [];
  for (const ser of xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)) {
    const s = ser[1];
    const name = decode(/<c:tx>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>/.exec(s)?.[1] ?? "").trim();
    const cats = [...(/<c:cat>([\s\S]*?)<\/c:cat>/.exec(s)?.[1] ?? "").matchAll(/<c:v>([\s\S]*?)<\/c:v>/g)].map((v) => decode(v[1]));
    const valsXml = /<c:val>([\s\S]*?)<\/c:val>/.exec(s)?.[1] ?? /<c:yVal>([\s\S]*?)<\/c:yVal>/.exec(s)?.[1] ?? "";
    const vals = [...valsXml.matchAll(/<c:v>([\s\S]*?)<\/c:v>/g)].map((v) => Number(v[1])).filter((v) => Number.isFinite(v));
    if (!vals.length) continue;
    const pairs = vals.map((v, i) => (cats[i] ? `${cats[i]}=${round(v)}` : String(round(v))));
    lines.push(`- series${name ? ` "${name}"` : ""}: ${pairs.join(", ")}`);
  }
  return lines.length ? `Chart (${type}) data:\n${lines.join("\n")}` : "";
}

function readTable(xml: string): string {
  const rows = [...xml.matchAll(/<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g)].map((r) =>
    [...r[1].matchAll(/<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g)].map((c) => paragraphs(c[1]).map((p) => p.text).join(" / ").replace(/\|/g, "/")),
  );
  return rows.length ? `Table:\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}` : "";
}

const PURE_NUMBER = /^[-–+~]?\s?[\d.,]+\s?%?$/;
const FOOTNOTE = /^(\d{1,2}[.)]\s|[¹²³⁴⁵⁶⁷⁸⁹])/;

interface Raw {
  n: number;
  title: string;
  lines: string[];
  /** Numbers drawn as text on the slide (chart labels), with where they sit. */
  figures: { text: string; x: number; y: number }[];
  footnotes: string[];
  extras: string[];
  /** Agenda candidates: the bullet paragraphs and their colours. */
  paras: Para[];
}

async function readSlide(zip: JSZip, path: string, n: number, slideWidth: number): Promise<Raw | null> {
  const xml = await zip.file(path)?.async("string");
  if (!xml) return null;
  if (/<p:sld\b[^>]*\bshow="0"/.test(xml)) return null;
  const dir = path.slice(0, path.lastIndexOf("/"));
  const relsPath = `${dir}/_rels/${path.slice(path.lastIndexOf("/") + 1)}.rels`;
  const rels = relsOf((await zip.file(relsPath)?.async("string")) ?? "");
  const raw: Raw = { n, title: "", lines: [], figures: [], footnotes: [], extras: [], paras: [] };

  // Shapes in reading order, not XML order: a column's header is often
  // written after its points. Shapes as wide as most of the slide (a title,
  // a key-message band) read by their top; narrower ones column by column,
  // top to bottom, so a header stays with the points under it.
  const shapes = [...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>|<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g)].map((m, i) => {
    const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(m[0]);
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(m[0]);
    return { xml: m[0], i, x: Number(off?.[1] ?? 0), y: Number(off?.[2] ?? 0), w: Number(ext?.[1] ?? 0) };
  });
  const wide = (sh: { w: number }) => sh.w > slideWidth * 0.6;
  const narrow = shapes.filter((sh) => !wide(sh));
  const narrowTop = Math.min(...narrow.map((sh) => sh.y));
  const column = (x: number) => Math.floor((x / slideWidth) * 6);
  const ordered = [
    ...shapes.filter((sh) => wide(sh) && sh.y <= narrowTop).sort((p, q) => p.y - q.y),
    ...narrow.sort((p, q) => column(p.x) - column(q.x) || p.y - q.y || p.i - q.i),
    ...shapes.filter((sh) => wide(sh) && sh.y > narrowTop).sort((p, q) => p.y - q.y),
  ];

  for (const { xml: shape, x: shapeX, y: shapeY } of ordered) {
    if (shape.startsWith("<p:graphicFrame")) {
      if (/<a:tbl\b/.test(shape)) raw.extras.push(readTable(shape));
      const chartId = /<c:chart\b[^>]*r:id="([^"]+)"/.exec(shape)?.[1];
      const target = chartId ? rels.get(chartId) : undefined;
      if (target) {
        const chartXml = await zip.file(resolve(dir, target))?.async("string");
        if (chartXml) raw.extras.push(readChart(chartXml));
      }
      continue;
    }
    const ph = /<p:ph\b[^>]*?(?:type="(\w+)")?[^>]*\/?>/.exec(shape);
    const phType = ph?.[1] ?? (ph ? "body" : "");
    if (phType === "sldNum" || phType === "dt" || phType === "ftr") continue;
    // A shape's own default size (its list style), for runs that set none.
    const shapeSize = Number(/<a:lstStyle>[\s\S]*?\bsz="(\d+)"[\s\S]*?<\/a:lstStyle>/.exec(shape)?.[1] ?? 0);
    const paras = paragraphs(shape, shapeSize);
    if (!paras.length) continue;
    if ((phType === "title" || phType === "ctrTitle") && !raw.title) {
      raw.title = paras.map((p) => p.text).join(" ");
      continue;
    }
    raw.paras.push(...paras);
    // Levels count from the shape's own top level: a box whose points all sit
    // at level 1 has no sub-points.
    const base = Math.min(...paras.map((p) => p.level));
    for (const p of paras) {
      if (PURE_NUMBER.test(p.text)) raw.figures.push({ text: p.text, x: shapeX, y: shapeY });
      // A numbered line in small type, or any sentence in 8pt or less, is a footnote.
      else if (p.size > 0 && ((FOOTNOTE.test(p.text) && p.size <= 1000) || (p.size <= 800 && p.text.length > 25))) raw.footnotes.push(p.text);
      else raw.lines.push(`${p.level > base ? "- " : ""}${p.text}`);
    }
  }
  const notesTarget = [...rels.values()].find((t) => /notesSlide\d+\.xml$/.test(t));
  const notesXml = notesTarget ? await zip.file(resolve(dir, notesTarget))?.async("string") : undefined;
  if (notesXml) {
    const notes = paragraphs(notesXml)
      .map((p) => p.text)
      .filter((t) => !PURE_NUMBER.test(t))
      .join(" ");
    if (notes.trim()) raw.extras.push(`Speaker notes: ${notes}`);
  }
  return raw;
}

/**
 * Chart labels drawn as text boxes (a hand-labelled line chart: the Gambia
 * case writes 3.10, 6.12, 11.65, 21.59 over a series whose data says
 * otherwise). In XML order they are a jumble the model misreads, so they are
 * grouped by the axis label they stand over: the years or periods along the
 * bottom are the columns, every other number goes to the nearest one by x,
 * top to bottom. What the slide shows is what the reader quotes, so these
 * win over the chart's data.
 */
function figureLine(figures: { text: string; x: number; y: number }[]): string {
  const period = /^(19|20)\d\d$|^\d\d$/;
  // The axis is the row with the most period labels at one height (within
  // 0.1 inch): a note marker under the chart must not pass for it.
  const periods = figures.filter((f) => period.test(f.text));
  const rows = new Map<number, typeof periods>();
  for (const f of periods) {
    const key = Math.round(f.y / 91440);
    (rows.get(key) ?? rows.set(key, []).get(key)!).push(f);
  }
  const axis = [...rows.values()].sort((a, b) => b.length - a.length)[0]?.sort((a, b) => a.x - b.x) ?? [];
  if (axis.length < 3) return `Figures written on the slide (chart labels; these win over chart data): ${figures.map((f) => f.text).join(", ")}`;
  const cols = axis.map((a) => ({ label: a.text, x: a.x, values: [] as { text: string; y: number }[] }));
  for (const f of figures) {
    if (axis.includes(f) || /^[1-9]$/.test(f.text)) continue; // 1-9 alone are note markers
    const near = cols.reduce((best, c) => (Math.abs(c.x - f.x) < Math.abs(best.x - f.x) ? c : best), cols[0]);
    near.values.push({ text: f.text, y: f.y });
  }
  const line = cols.map((c) => `${c.label}: ${c.values.sort((a, b) => a.y - b.y).map((v) => v.text).join(", ") || "-"}`).join(" | ");
  return `Chart labels written on the slide, by column, top to bottom (the figures the reader sees; they win over the chart data, which may be stale): ${line}`;
}

function normal(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The paragraph whose colour none of the others share: the agenda's chapter in progress. */
function currentOf(paras: Para[]): number {
  const counts = new Map<string, number>();
  for (const p of paras) counts.set(p.colour, (counts.get(p.colour) ?? 0) + 1);
  const odd = paras.findIndex((p) => counts.get(p.colour) === 1);
  return paras.length > 2 ? odd : -1;
}

export async function readPptx(buf: ArrayBuffer): Promise<{ text: string; slides: SourceSlide[] }> {
  const zip = await JSZip.loadAsync(buf);
  const pres = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const presRels = relsOf((await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "");
  let paths = [...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)]
    .map((m) => presRels.get(m[1]))
    .filter((t): t is string => !!t)
    .map((t) => resolve("ppt", t));
  // A file without the list (hand-made zips) falls back to the file names.
  if (!paths.length) {
    paths = Object.keys(zip.files)
      .map((p) => ({ p, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(p)?.[1]) }))
      .filter((s) => Number.isFinite(s.n))
      .sort((a, b) => a.n - b.n)
      .map((s) => s.p);
  }
  const slideWidth = Number(/<p:sldSz\b[^>]*\bcx="(\d+)"/.exec(pres)?.[1] ?? 12192000);
  const raws: Raw[] = [];
  for (const path of paths) {
    const r = await readSlide(zip, path, raws.length + 1, slideWidth);
    if (r) raws.push(r);
  }

  // Boilerplate: a line on more than half the slides (footer handles, the
  // running header "School & Health Facility Connectivity") says nothing.
  // Agenda slides are left out of the count: they repeat the chapter
  // titles by design, and those are not boilerplate.
  const AGENDA_WORD = /^(agenda|contents?|sommario|table of contents)$/i;
  const isNamedAgenda = (r: Raw) => [r.title, ...r.lines].some((l) => AGENDA_WORD.test((l ?? "").trim()));
  const seen = new Map<string, number>();
  for (const r of raws) if (!isNamedAgenda(r)) for (const l of new Set(r.lines)) seen.set(l, (seen.get(l) ?? 0) + 1);
  const boiler = new Set([...seen].filter(([, c]) => raws.length >= 4 && c > raws.length * 0.25).map(([l]) => l));
  const HANDLE = /^(@\S+|(www\.)?[a-z0-9-]+\.(org|com|global|net)(\/\S*)?|\d{1,3}\s*\|\s*\S+)$/i;

  const agendaTexts = new Set<string>();
  const slides: SourceSlide[] = raws.map((r) => {
    const lines = r.lines.filter((l) => !boiler.has(l) && !HANDLE.test(l.replace(/^- /, "")));
    // No title placeholder (most consulting decks draw the heading in a text
    // box): the heading is the largest type on the slide, when it is larger
    // than the body, else the first line.
    let title = r.title;
    let body = lines;
    if (!title) {
      const sized = r.paras.filter((p) => lines.includes(p.text));
      const top = Math.max(0, ...sized.map((p) => p.size));
      const sizes = sized.map((p) => p.size).sort((a, b) => a - b);
      const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
      const head = top > median ? sized.find((p) => p.size === top) : undefined;
      title = head?.text ?? lines[0]?.replace(/^- /, "") ?? "";
      const at = lines.indexOf(head?.text ?? lines[0]);
      body = lines.filter((_, i) => i !== at);
    }
    const words = [title, ...body].join(" ").split(/\s+/).filter(Boolean).length;
    const signature = normal(body.join(" "));
    let kind: SourceKind = "content";
    // Read on the raw lines: a word the agenda repeats on every chapter is
    // boilerplate to the filter above, and the slide's own name here.
    const named = isNamedAgenda(r);
    if (named || (signature && agendaTexts.has(signature))) {
      kind = "agenda";
      agendaTexts.add(signature);
    } else if (/^(thank you|thanks|grazie|merci|gracias)\b/i.test(title) && words <= 12) kind = "closing";
    else if (r.n === 1) kind = "cover";
    else if (!r.extras.some((e) => e && !e.startsWith("Speaker notes")) && body.length <= 1 && words <= 24) kind = "divider";

    const parts = [`Title: ${title}`];
    if (body.length) parts.push(body.join("\n"));
    for (const e of r.extras) if (e) parts.push(e);
    if (r.figures.length) parts.push(figureLine(r.figures));
    if (r.footnotes.length) parts.push(`Footnotes: ${r.footnotes.join(" ")}`);
    const slide: SourceSlide = { n: r.n, kind, title, text: parts.join("\n") };
    if (kind === "agenda") {
      const bullets = r.paras.filter((p) => !AGENDA_WORD.test(p.text) && !HANDLE.test(p.text) && !PURE_NUMBER.test(p.text) && p.text.length > 2);
      slide.chapters = bullets.map((p) => p.text);
      slide.current = currentOf(bullets);
    }
    return slide;
  });

  const text = slides.map((s) => `Slide ${s.n}${s.kind === "content" ? "" : ` (${s.kind})`}:\n${s.text}`).join("\n\n");
  return { text, slides };
}
