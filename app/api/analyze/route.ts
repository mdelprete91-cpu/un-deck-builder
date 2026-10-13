import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  BRIEF_ANALYSIS_INSTRUCTIONS,
  BRIEF_ANALYSIS_SCHEMA,
  DOCUMENT_ANALYSIS_INSTRUCTIONS,
  MAX_ANALYSIS_CHARS,
  SHEET_ANALYSIS_INSTRUCTIONS,
  SHEET_ANALYSIS_SCHEMA,
  normalizeAnalysis,
  normalizeBriefAnalysis,
  type MaterialKind,
} from "@/lib/slides/sheet-questions";

import { countFromBrief, languageOf, outlineFromBrief } from "@/lib/slides/brief";
import { briefFindings } from "@/lib/slides/brief-checks";

export const runtime = "nodejs";

/**
 * The first complete JSON object in the text. `output_text` joins every
 * text item the response carried, and with a PDF in the input the model
 * once followed the object with a sentence (25 Sep 2026), which
 * JSON.parse refuses whole.
 */
function firstObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) return "{}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return "{}";
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** A PDF past this goes unread here (it still travels whole to generate): the questions come from the first pages anyway. */
const MAX_PDF_BASE64 = 2_800_000;

/**
 * Reads an attached file and returns the questions it raises, see
 * lib/slides/sheet-questions.ts: a spreadsheet is always asked about, a
 * document only where it is unclear. One small call per attach, the same
 * model as the deck, reasoning off.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { name?: unknown; text?: unknown; pdf?: unknown; kind?: unknown; brief?: unknown; material?: unknown; files?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "file";
  const kind: MaterialKind = body.kind === "spreadsheet" ? "spreadsheet" : body.kind === "brief" ? "brief" : "document";
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_ANALYSIS_CHARS) : "";
  const pdf = typeof body.pdf === "string" && body.pdf.length <= MAX_PDF_BASE64 && BASE64.test(body.pdf) ? body.pdf : "";
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 8000).trim() : "";
  // A brief's analysis sees what the attached files say, so it does not ask
  // for what they already give: their text (cut), and the names of those it
  // cannot read here (a PDF, an image).
  const material = kind !== "brief" ? "" : typeof body.material === "string" ? body.material.slice(0, MAX_ANALYSIS_CHARS).trim() : "";
  const files = Array.isArray(body.files) ? body.files.filter((f): f is string => typeof f === "string").slice(0, 10).map((f) => f.slice(0, 120)) : [];
  if (!text.trim() && !pdf) return new Response("Nothing to read", { status: 400 });
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const content: ResponseInputContent[] = [];
  // The language is named, not left to "the brief's language": an English
  // brief once got its questions in Spanish (12 Oct 2026).
  if (kind === "brief") {
    const lang = languageOf(text) ?? "English";
    const outline = outlineFromBrief(text, countFromBrief(text));
    // The count is the client's own question (app/page.tsx, countConflict): not asked twice.
    const found = briefFindings(text).filter((f) => f.kind !== "count");
    const countAsked = briefFindings(text).some((f) => f.kind === "count");
    const parts = [
      `The user's brief for the deck: "${text}"`,
      outline.length ? `Slides its outline prescribes:\n${outline.map((o) => `${o.order}. ${o.title}`).join("\n")}` : "",
      countAsked ? "The slide count is asked separately: never ask about it." : "",
      found.length ? `Checks already found:\n${found.map((f) => `- ${f.hint} (brief: "${f.about}")`).join("\n")}` : "Checks already found: none.",
      files.length ? `Files attached: ${files.join(", ")}.${material ? "" : " Their content is not shown here: do not ask for what such files would normally hold."}` : "No file is attached.",
      material ? `What the attached files say (cut):\n<<<\n${material}\n>>>` : "",
      `The brief is in ${lang}: write the summary, the questions and the options in ${lang}.`,
    ];
    content.push({ type: "input_text", text: parts.filter(Boolean).join("\n\n") });
  }
  else if (pdf) content.push({ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${pdf}` });
  else content.push({ type: "input_text", text: `${kind === "spreadsheet" ? "Workbook" : "Material"} "${name}":\n<<<\n${text}\n>>>` });
  if (brief && kind !== "brief") content.push({ type: "input_text", text: `The user's brief for the deck: "${brief}"` });

  const client = new OpenAI({ maxRetries: 3 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: kind === "spreadsheet" ? SHEET_ANALYSIS_INSTRUCTIONS : kind === "brief" ? BRIEF_ANALYSIS_INSTRUCTIONS : DOCUMENT_ANALYSIS_INSTRUCTIONS,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "material_questions", schema: (kind === "brief" ? BRIEF_ANALYSIS_SCHEMA : SHEET_ANALYSIS_SCHEMA) as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 1500,
    });
    const parsed = JSON.parse(firstObject(response.output_text));
    const analysis = kind === "brief" ? normalizeBriefAnalysis(parsed) : normalizeAnalysis(parsed);
    if (!analysis) return new Response("The file gave no summary", { status: 502 });
    return Response.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message =
      err instanceof OpenAI.AuthenticationError
        ? "Invalid OPENAI_API_KEY"
        : err instanceof OpenAI.APIError
          ? `OpenAI API error (${err.status ?? "network"}): ${err.message}`
          : err instanceof Error
            ? err.message
            : "Analysis failed";
    return new Response(message, { status: 502 });
  }
}
