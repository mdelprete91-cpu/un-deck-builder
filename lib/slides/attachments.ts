import JSZip from "jszip";

/**
 * Files attached to the brief. They travel with the generate/add request
 * only: never into deck state, the deck file or localStorage, which are
 * already at the edge of their quota with photos alone.
 *
 * PDFs and images go to the model as native document/image blocks; Word and
 * PowerPoint files are reduced to their text here in the browser (jszip on
 * the OOXML parts) so the request stays small and the model sees words, not
 * a binary it cannot read.
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
    };

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export const ATTACHMENT_ACCEPT =
  ".pdf,.docx,.pptx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,text/markdown,text/csv,application/json,image/*";

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
  if (TEXT_EXTENSIONS.has(e) || file.type.startsWith("text/") || file.type === "application/json") {
    return textAttachment(file.name, await file.text());
  }
  throw new AttachmentError(
    `"${file.name}" is not a supported file. Attach PDF, Word, PowerPoint, text or image files.`,
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
  const a = textAttachment(file.name, text);
  return a.kind === "text" ? { ...a, textOnly: true } : a;
}

function textAttachment(name: string, raw: string): Attachment {
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

/** Human-readable size for chips. */
export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
