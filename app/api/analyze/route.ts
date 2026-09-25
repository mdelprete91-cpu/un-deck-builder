import OpenAI from "openai";
import {
  MAX_ANALYSIS_CHARS,
  SHEET_ANALYSIS_INSTRUCTIONS,
  SHEET_ANALYSIS_SCHEMA,
  normalizeAnalysis,
} from "@/lib/slides/sheet-questions";

export const runtime = "nodejs";

/**
 * Reads an attached spreadsheet and returns the questions it raises, see
 * lib/slides/sheet-questions.ts. One small call per attach, the same model
 * as the deck, reasoning off: the table is short and the job is to read
 * headers, not to think.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { name?: unknown; text?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_ANALYSIS_CHARS) : "";
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "spreadsheet";
  if (!text.trim()) return new Response("Missing sheet text", { status: 400 });
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const client = new OpenAI({ maxRetries: 3 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: SHEET_ANALYSIS_INSTRUCTIONS,
      input: [{ role: "user", content: [{ type: "input_text", text: `Workbook "${name}":\n<<<\n${text}\n>>>` }] }],
      text: { format: { type: "json_schema", name: "sheet_questions", schema: SHEET_ANALYSIS_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 1500,
    });
    const analysis = normalizeAnalysis(JSON.parse(response.output_text || "{}"));
    if (!analysis) return new Response("The sheet gave no questions", { status: 502 });
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
