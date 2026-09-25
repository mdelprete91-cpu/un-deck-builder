import type { Attachment } from "@/lib/slides/attachments";
import { MAX_ATTACHMENTS, MAX_INSIGHTS_CHARS, MAX_REQUEST_BYTES, MAX_TEXT_PER_FILE } from "@/lib/slides/attachments";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Server side check of the attachments a client sent. Returns the cleaned
 * list, or a plain-language reason to answer 400 with. The client applies
 * the same limits before sending; this is the guarantee, not the UX.
 */
function insightsOf(a: Record<string, unknown>): { insights?: string } {
  const insights = typeof a.insights === "string" ? a.insights.slice(0, MAX_INSIGHTS_CHARS).trim() : "";
  return insights ? { insights } : {};
}

export function sanitizeAttachments(input: unknown): Attachment[] | string {
  if (input == null) return [];
  if (!Array.isArray(input)) return "Attachments must be a list";
  if (input.length > MAX_ATTACHMENTS) return `At most ${MAX_ATTACHMENTS} attachments per request`;
  const out: Attachment[] = [];
  let total = 0;
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return "Malformed attachment";
    const a = raw as Record<string, unknown>;
    const name = typeof a.name === "string" ? a.name.slice(0, 120) : "attachment";
    const id = typeof a.id === "string" ? a.id.slice(0, 16) : "";
    if (a.kind === "pdf" || a.kind === "image") {
      if (typeof a.data !== "string" || !BASE64.test(a.data)) return `"${name}" is not valid base64`;
      total += a.data.length;
      if (a.kind === "pdf") {
        out.push({ id, name, kind: "pdf", mediaType: "application/pdf", data: a.data, bytes: a.data.length, ...insightsOf(a) });
      } else {
        if (typeof a.mediaType !== "string" || !IMAGE_TYPES.has(a.mediaType)) return `"${name}" has an unsupported image type`;
        out.push({ id, name, kind: "image", mediaType: a.mediaType as Attachment & { kind: "image" } extends { mediaType: infer M } ? M : never, data: a.data, bytes: a.data.length });
      }
    } else if (a.kind === "text") {
      if (typeof a.text !== "string") return `"${name}" has no text`;
      const text = a.text.slice(0, MAX_TEXT_PER_FILE);
      total += text.length;
      // The spreadsheet flag and the answers to the file's questions are
      // plain client input too: the answers are capped.
      const spreadsheet = a.spreadsheet === true;
      out.push({
        id,
        name,
        kind: "text",
        text,
        bytes: text.length,
        truncated: a.truncated === true || a.text.length > MAX_TEXT_PER_FILE,
        ...(spreadsheet ? { spreadsheet: true } : {}),
        ...insightsOf(a),
      });
    } else {
      return `"${name}" has an unknown attachment kind`;
    }
    if (total > MAX_REQUEST_BYTES) return "Attachments are too large for one request (4 MB max in total)";
  }
  return out;
}
