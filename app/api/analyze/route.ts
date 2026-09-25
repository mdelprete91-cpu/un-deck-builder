import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  BRIEF_ANALYSIS_INSTRUCTIONS,
  DOCUMENT_ANALYSIS_INSTRUCTIONS,
  MAX_ANALYSIS_CHARS,
  SHEET_ANALYSIS_INSTRUCTIONS,
  SHEET_ANALYSIS_SCHEMA,
  normalizeAnalysis,
  type MaterialKind,
} from "@/lib/slides/sheet-questions";

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
  let body: { name?: unknown; text?: unknown; pdf?: unknown; kind?: unknown; brief?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "file";
  const kind: MaterialKind = body.kind === "spreadsheet" ? "spreadsheet" : body.kind === "brief" ? "brief" : "document";
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_ANALYSIS_CHARS) : "";
  const pdf = typeof body.pdf === "string" && body.pdf.length <= MAX_PDF_BASE64 && BASE64.test(body.pdf) ? body.pdf : "";
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 4000).trim() : "";
  if (!text.trim() && !pdf) return new Response("Nothing to read", { status: 400 });
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const content: ResponseInputContent[] = [];
  if (kind === "brief") content.push({ type: "input_text", text: `The user's brief for the deck: "${text}"` });
  else if (pdf) content.push({ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${pdf}` });
  else content.push({ type: "input_text", text: `${kind === "spreadsheet" ? "Workbook" : "Material"} "${name}":\n<<<\n${text}\n>>>` });
  if (brief && kind !== "brief") content.push({ type: "input_text", text: `The user's brief for the deck: "${brief}"` });

  const client = new OpenAI({ maxRetries: 3 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: kind === "spreadsheet" ? SHEET_ANALYSIS_INSTRUCTIONS : kind === "brief" ? BRIEF_ANALYSIS_INSTRUCTIONS : DOCUMENT_ANALYSIS_INSTRUCTIONS,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "material_questions", schema: SHEET_ANALYSIS_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 1500,
    });
    const analysis = normalizeAnalysis(JSON.parse(firstObject(response.output_text)));
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
