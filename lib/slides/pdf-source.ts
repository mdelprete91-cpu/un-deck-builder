import { classify, FOOTNOTE, PURE_NUMBER, type Para, type Raw, type SourceSlide } from "./pptx-source";

/**
 * A PDF read page by page for "replicate it" (Mario, 28 Sep 2026: the same
 * question as for a PowerPoint file). pdf.js gives text runs with their
 * position and size; they become lines (a break where the run says so or
 * the baseline moves), each with its type size in hundredths of a point, the
 * unit the PowerPoint reader uses, so the same rules apply: the heading is
 * the largest type, a numbered line in small type or any sentence at 8pt or
 * less is a footnote, numbers alone are chart labels grouped by the axis
 * they stand over, a line opening with a dash is a sub-point. Then the
 * shared `classify` finds the cover, the agendas, the dividers and the
 * boilerplate. No colours in a PDF's text: an agenda repeated before each
 * chapter opens the chapters in order.
 */

type Item = { str: string; transform: number[]; hasEOL?: boolean };

export async function readPdfSlides(data: ArrayBuffer): Promise<{ text: string; slides: SourceSlide[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const raws: Raw[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 80); n++) {
    const page = await doc.getPage(n);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();
    const raw: Raw = { n, title: "", lines: [], figures: [], footnotes: [], extras: [], paras: [] };
    // Runs to lines. A number alone is a chart label with its own position;
    // a bullet glyph (often a private-use character of a symbol font) marks
    // the start of a point.
    type Line = { text: string; size: number; x: number; y: number; bullet: boolean };
    const lines: Line[] = [];
    let cur: Line | null = null;
    const BULLET = /^[\s\u0000-\u001F\u007F-\u009F\uE000-\uF8FF•▪●■◦·]+/;
    for (const it of content.items as Item[]) {
      if (!("str" in it)) continue;
      const [, , c, d, e, f] = it.transform;
      const size = Math.hypot(c, d) || 1;
      const y = height - f;
      const str = it.str;
      if (PURE_NUMBER.test(str.trim()) && str.trim()) {
        raw.figures.push({ text: str.trim(), x: Math.round(e * 12700), y: Math.round(y * 12700) });
        continue;
      }
      if (cur && Math.abs(cur.y - y) > size * 0.6) {
        lines.push(cur);
        cur = null;
      }
      if (!cur) cur = { text: "", size: 0, x: e, y, bullet: false };
      // A bullet glyph marks the point and carries no text (nor its own size).
      if (!cur.text.trim() && /[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF•▪●■◦·]/.test(str)) cur.bullet = true;
      const bare = str.replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF]/g, "");
      cur.text += bare;
      if (bare.trim()) cur.size = Math.max(cur.size, size);
      if (it.hasEOL) {
        lines.push(cur);
        cur = null;
      }
    }
    if (cur) lines.push(cur);
    for (const l of lines) if (!l.size) l.size = 1;

    // Lines to paragraphs: a line joins the one before unless it opens a
    // point, changes type size, or sits further down than a line break.
    const paras: Line[] = [];
    for (const l of lines) {
      const text = l.text.replace(BULLET, (m) => (/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF•▪●■◦·]/.test(m) ? "" : m)).replace(/\s+/g, " ").trim();
      if (!text) continue;
      // The footer: the site and the page number run together ("giga.global20 | www…").
      if (/www\.|\.(org|global|com)\d*\s*\|/.test(text)) continue;
      const prev = paras[paras.length - 1];
      const joins =
        prev &&
        !l.bullet &&
        !/^[-–—]\s|^\d+[.)]\s/.test(text) &&
        Math.abs(prev.size - l.size) < 0.6 &&
        l.y - prev.y > 0 &&
        l.y - prev.y < l.size * 1.9 &&
        !/[.!?]$/.test(prev.text);
      if (joins) {
        // A word broken at a hyphen: "Cost-" + "Benefit" keeps the hyphen, "connec-" + "tivity" drops it.
        prev.text = /-$/.test(prev.text) ? `${/^[A-Z]/.test(text) ? prev.text : prev.text.slice(0, -1)}${text}` : `${prev.text} ${text}`;
        prev.y = l.y;
      } else paras.push({ ...l, text });
    }

    for (const l of paras) {
      const sub = /^[-–—o]\s/.test(l.text);
      const clean = sub ? l.text.replace(/^[-–—o]\s/, "") : l.text;
      const size = Math.round(l.size * 100);
      const para: Para = { text: clean, level: sub ? 1 : 0, size, colour: "" };
      raw.paras.push(para);
      if ((FOOTNOTE.test(clean) && size <= 1000) || (size <= 800 && clean.length > 25)) raw.footnotes.push(clean);
      else raw.lines.push(`${sub ? "- " : ""}${clean}`);
    }
    if (raw.paras.length) raws.push(raw);
  }
  return classify(raws);
}
