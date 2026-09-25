import JSZip from "jszip";
import type { SheetAnalysis, SheetAnswers } from "./sheet-questions";

/**
 * Files attached to the brief. They travel with the generate/add request
 * only: never into deck state, the deck file or localStorage, which are
 * already at the edge of their quota with photos alone.
 *
 * PDFs and images go to the model as native document/image blocks; Word,
 * PowerPoint and Excel files are reduced to their text here in the browser
 * (jszip on the OOXML parts) so the request stays small and the model sees
 * words, not a binary it cannot read. A spreadsheet becomes one table per
 * sheet and carries the user's answer to "what should the deck draw from
 * it" (`insights`), which the prompt appends under the table.
 */

export type Attachment =
  | { id: string; name: string; kind: "pdf"; mediaType: "application/pdf"; data: string; bytes: number }
  | { id: string; name: string; kind: "image"; mediaType: ImageMediaType; data: string; bytes: number }
  | {
      id: string;
      name: string;
      kind: "text";
      text: string;
      bytes: number;
      truncated?: boolean;
      /** Set when the text was pulled out of a PDF too big to send whole: the chip says so. */
      textOnly?: boolean;
      /** The text is an Excel workbook laid out as tables: the chip shows a sheet and the composer asks what to draw from it. */
      spreadsheet?: boolean;
      /** The answers compiled for the prompt (compileInsights). Travels in the request; the fields below are the editor's. */
      insights?: string;
      /** What the model asked about this sheet, once the analysis came back. */
      analysis?: SheetAnalysis;
      /** The user's answers by question id, so the wizard reopens where it was. */
      answers?: SheetAnswers;
      /** The analysis failed or is pending: the row under the chip says so. */
      analysisError?: string;
    };

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
type TextAttachment = Extract<Attachment, { kind: "text" }>;

export const ATTACHMENT_ACCEPT =
  ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,text/csv,application/json,image/*";

/** Vercel functions accept 4.5 MB of body; keep a margin for the brief itself. */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
/**
 * What that body holds in files: base64 grows a file by a third, so 3 MB of
 * files is the honest limit to tell the user. A PDF past it is not refused,
 * it travels as its extracted text instead (see readPdfAsText).
 */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_ATTACHMENTS = 6;
/** Characters of extracted text kept per file and across all files. */
export const MAX_TEXT_PER_FILE = 60_000;
export const MAX_TEXT_TOTAL = 120_000;
/** Characters of the "what to draw from this sheet" answer, client and server. */
export const MAX_INSIGHTS_CHARS = 500;
/** A sheet is cut by rows, never mid-line, so the model sees whole records. */
export const MAX_SHEET_ROWS = 200;
const MAX_SHEET_COLS = 30;
const MAX_CELL_CHARS = 200;
const MAX_IMAGE_EDGE = 1568;

export class AttachmentError extends Error {}

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "tsv"]);

function ext(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** What the attachment adds to the JSON body: base64 or text length. */
export function requestBytes(a: Attachment): number {
  return a.kind === "text" ? a.text.length : a.data.length;
}

export function totalRequestBytes(list: Attachment[]): number {
  return list.reduce((n, a) => n + requestBytes(a), 0);
}

export async function readAttachment(file: File): Promise<Attachment> {
  const e = ext(file.name);
  if (e === "pdf" || file.type === "application/pdf") {
    const data = await toBase64(file);
    // `bytes` is the file's own size, what the chip shows; the body cost is requestBytes().
    return { id: uid(), name: file.name, kind: "pdf", mediaType: "application/pdf", data, bytes: file.size };
  }
  if (file.type.startsWith("image/")) {
    const { data, mediaType } = await downscaleImage(file);
    return { id: uid(), name: file.name, kind: "image", mediaType, data, bytes: Math.round(data.length * 0.75) };
  }
  if (e === "docx") {
    return textAttachment(file.name, await extractDocx(await file.arrayBuffer()));
  }
  if (e === "pptx") {
    return textAttachment(file.name, await extractPptx(await file.arrayBuffer()));
  }
  if (e === "xlsx" || e === "xlsm") {
    return { ...textAttachment(file.name, await extractXlsx(await file.arrayBuffer())), spreadsheet: true };
  }
  if (e === "xls") {
    throw new AttachmentError(`"${file.name}" is the old Excel format. Save it as .xlsx (or CSV) and attach that.`);
  }
  if (TEXT_EXTENSIONS.has(e) || file.type.startsWith("text/") || file.type === "application/json") {
    return textAttachment(file.name, await file.text());
  }
  throw new AttachmentError(
    `"${file.name}" is not a supported file. Attach PDF, Word, PowerPoint, Excel, text or image files.`,
  );
}

/**
 * A PDF too big to travel as a document goes as its text: pdf.js reads it in
 * the browser, page by page, in reading order. A scanned PDF has no text
 * layer and throws, which is the one case a big PDF is refused.
 */
export async function readPdfAsText(file: File): Promise<Attachment> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
      .join("");
    pages.push(line.trim());
    // Past the text cap there is nothing more to keep; stop reading.
    if (pages.join("\n\n").length > MAX_TEXT_PER_FILE) break;
  }
  const text = pages.join("\n\n");
  if (!text.trim()) throw new AttachmentError(`"${file.name}" is too big to attach whole (files can total 3 MB) and has no text layer to send instead.`);
  return { ...textAttachment(file.name, text), textOnly: true };
}

function textAttachment(name: string, raw: string): TextAttachment {
  const text = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new AttachmentError(`"${name}" has no readable text.`);
  const truncated = text.length > MAX_TEXT_PER_FILE;
  const kept = truncated ? text.slice(0, MAX_TEXT_PER_FILE) : text;
  return { id: uid(), name, kind: "text", text: kept, bytes: kept.length, truncated };
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new AttachmentError(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

/** Vision works best under ~1568px on the long edge; also keeps the body small. */
function downscaleImage(file: File): Promise<{ data: string; mediaType: ImageMediaType }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new AttachmentError("Canvas unavailable"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ data: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AttachmentError(`Could not read the image "${file.name}".`));
    };
    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/*  OOXML text extraction                                              */
/* ------------------------------------------------------------------ */

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/**
 * Turn one OOXML part into lines: text runs (`<w:t>` / `<a:t>`) joined,
 * paragraph ends (`</w:p>` / `</a:p>`) become line breaks, tabs and explicit
 * breaks become spaces. Good enough for briefs; formatting is not the point.
 */
function xmlToLines(xml: string, textTag: "w:t" | "a:t", paraTag: "w:p" | "a:p"): string {
  const out: string[] = [];
  let line = "";
  const re = new RegExp(`<${textTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${textTag}>|</${paraTag}>|<(?:w:tab|w:br|a:br)\\b[^>]*/?>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith(`</${paraTag}>`)) {
      out.push(line.trim());
      line = "";
    } else if (m[1] !== undefined) {
      line += decodeEntities(m[1]);
    } else {
      line += " ";
    }
  }
  if (line.trim()) out.push(line.trim());
  return out.join("\n");
}

export async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new AttachmentError("This Word file has no readable document part.");
  return xmlToLines(await doc.async("string"), "w:t", "w:p");
}

export async function extractPptx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .map((p) => ({ p, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(p)?.[1]) }))
    .filter((s) => Number.isFinite(s.n))
    .sort((a, b) => a.n - b.n);
  if (slides.length === 0) throw new AttachmentError("This PowerPoint file has no slides.");
  const parts: string[] = [];
  for (const s of slides) {
    const xml = await zip.file(s.p)!.async("string");
    const body = xmlToLines(xml, "a:t", "a:p");
    const notesPath = `ppt/notesSlides/notesSlide${s.n}.xml`;
    const notesFile = zip.file(notesPath);
    const notes = notesFile ? xmlToLines(await notesFile.async("string"), "a:t", "a:p") : "";
    parts.push(`Slide ${s.n}:\n${body}${notes.trim() ? `\nSpeaker notes: ${notes}` : ""}`);
  }
  return parts.join("\n\n");
}

/* ------------------------------------------------------------------ */
/*  Excel                                                              */
/* ------------------------------------------------------------------ */

/**
 * An .xlsx is a zip of XML parts: the workbook lists the sheets, a
 * relationships file maps them to their paths, `sharedStrings.xml` holds
 * every text cell once, and `styles.xml` says which number formats are
 * dates or percentages (a date cell is a serial number in the XML, and
 * "45292" tells the model nothing). Each sheet comes out as a pipe table
 * headed by its name, blank rows dropped, cut at MAX_SHEET_ROWS with a note.
 */
export async function extractXlsx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const workbook = zip.file("xl/workbook.xml");
  if (!workbook) throw new AttachmentError("This Excel file has no readable workbook part.");
  const wbXml = await workbook.async("string");
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(wbXml);

  const targets = new Map<string, string>();
  const rels = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }

  const sheets: { name: string; path: string }[] = [];
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    if (/\bstate="(hidden|veryHidden)"/.test(m[0])) continue;
    const name = decodeEntities(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const rid = /\b[\w-]+:id="([^"]+)"/.exec(m[0])?.[1];
    const path = rid ? targets.get(rid) : undefined;
    if (path) sheets.push({ name, path });
  }

  const shared = readSharedStrings((await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "");
  const styles = readCellStyles((await zip.file("xl/styles.xml")?.async("string")) ?? "");

  const parts: string[] = [];
  for (const s of sheets) {
    const file = zip.file(s.path);
    if (!file) continue;
    const { rows, total } = sheetRows(await file.async("string"), shared, styles, date1904);
    if (rows.length === 0) continue;
    const cols = rows.reduce((n, r) => Math.max(n, r.length), 0);
    const cut = total > rows.length ? `, first ${rows.length} of ${total} rows` : `, ${rows.length} rows`;
    parts.push(`Sheet "${s.name}" (${cols} columns${cut}):\n${rows.map((r) => r.join(" | ")).join("\n")}`);
  }
  if (parts.length === 0) throw new AttachmentError("This Excel file has no cells with content.");
  return parts.join("\n\n");
}

function readSharedStrings(xml: string): string[] {
  const out: string[] = [];
  // An empty <si/> still takes an index; a rich-text <si> has several <t> runs.
  for (const m of xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) {
    let text = "";
    for (const t of (m[1] ?? "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += decodeEntities(t[1]);
    out.push(text);
  }
  return out;
}

type CellStyle = "date" | "time" | "percent" | null;

/** Built-in number formats that are dates (14-22, locale 27-36, 45-47 times, 50-58) and percentages (9, 10). */
function builtinStyle(id: number): CellStyle {
  if (id === 9 || id === 10) return "percent";
  if (id === 18 || id === 19 || id === 20 || id === 21 || (id >= 45 && id <= 47)) return "time";
  if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return "date";
  return null;
}

/** One entry per cellXfs index, which is what a cell's `s` attribute points at. */
function readCellStyles(xml: string): CellStyle[] {
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(/\bnumFmtId="(\d+)"/.exec(m[0])?.[1]);
    const code = /\bformatCode="([^"]*)"/.exec(m[0])?.[1];
    if (Number.isFinite(id) && code) custom.set(id, decodeEntities(code));
  }
  const classify = (id: number): CellStyle => {
    const code = custom.get(id);
    if (code === undefined) return builtinStyle(id);
    // Literal text and colour/locale tags carry no meaning: "0.0 "days"" is a number.
    const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
    if (bare.includes("%")) return "percent";
    if (/[dy]/i.test(bare)) return "date";
    if (/[hs]/i.test(bare) && /m/i.test(bare)) return "time";
    return null;
  };
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  const out: CellStyle[] = [];
  for (const m of xfs.matchAll(/<xf\b[^>]*>/g)) {
    out.push(classify(Number(/\bnumFmtId="(\d+)"/.exec(m[0])?.[1] ?? 0)));
  }
  return out;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Excel serials count days from 1899-12-30 (with the phantom 29 Feb 1900 before day 61) or from 1904-01-01. */
function serialToDate(v: number, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : v < 61 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.floor(v) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function serialToTime(v: number): string {
  const secs = Math.round((v - Math.floor(v)) * 86_400);
  return `${pad2(Math.floor(secs / 3600))}:${pad2(Math.floor((secs % 3600) / 60))}`;
}

function formatNumber(raw: string, style: CellStyle, date1904: boolean): string {
  const v = Number(raw);
  if (!Number.isFinite(v)) return raw;
  if (style === "date") return serialToDate(v, date1904);
  if (style === "time") return serialToTime(v);
  // Two decimals at most: 98.58473133 is a float the sheet never showed, and
  // the model quotes what it reads (a 12-character stat, 25 Sep 2026).
  if (style === "percent") return `${Math.round(v * 10000) / 100}%`;
  return String(Math.round(v * 100) / 100);
}

function sheetRows(xml: string, shared: string[], styles: CellStyle[], date1904: boolean): { rows: string[][]; total: number } {
  const rows: string[][] = [];
  let total = 0;
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+)\d*"/.exec(attrs)?.[1];
      const col = ref ? colIndex(ref) : cells.length;
      if (col >= MAX_SHEET_COLS) continue;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? "n";
      const body = c[2] ?? "";
      let text = "";
      if (type === "inlineStr") {
        for (const t of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += decodeEntities(t[1]);
      } else {
        // A formula saved without its cached result has an empty <v>: nothing to show.
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (!v) continue;
        if (type === "s") text = shared[Number(v)] ?? "";
        else if (type === "b") text = v === "1" ? "TRUE" : "FALSE";
        else if (type === "str" || type === "e" || type === "d") text = decodeEntities(v);
        else {
          const s = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? -1);
          text = formatNumber(v, styles[s] ?? null, date1904);
        }
      }
      // A pipe in a cell would read as a column break in the table.
      text = text.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
      if (text.length > MAX_CELL_CHARS) text = text.slice(0, MAX_CELL_CHARS - 1) + "…";
      if (!text) continue;
      while (cells.length < col) cells.push("");
      cells[col] = text;
    }
    if (cells.length === 0) continue;
    total++;
    if (rows.length < MAX_SHEET_ROWS) rows.push(cells);
  }
  return { rows, total };
}

/** Human-readable size for chips. */
export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
