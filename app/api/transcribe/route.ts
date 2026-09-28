import OpenAI from "openai";
import { MAX_REQUEST_BYTES } from "@/lib/slides/attachments";
import { MAX_TRANSCRIBED_PAGES, TRANSCRIPT_SCHEMA, normalizeTranscript, transcribeInstructions } from "@/lib/slides/transcribe";

export const runtime = "nodejs";
// Forty dense pages are a long answer: the same ceiling as generate.
export const maxDuration = 300;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * The text of a PDF that pdf.js cannot read (outlined type, a scan), page by
 * page, for "replicate" (lib/slides/transcribe.ts). The file goes as the
 * same document block `/api/analyze` sends, the model reads the pages as
 * images, and the answer is `{ title, subtitle, pages: [{ n, title, lines,
 * footnotes }] }`. Called by the editor only when Replicate is chosen and
 * Generate pressed.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { name?: unknown; pdf?: unknown; pages?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "file.pdf";
  const pdf = typeof body.pdf === "string" && body.pdf.length <= MAX_REQUEST_BYTES && BASE64.test(body.pdf) ? body.pdf : "";
  if (!pdf) return new Response("No PDF to read", { status: 400 });
  const asked = typeof body.pages === "number" && Number.isFinite(body.pages) ? Math.round(body.pages) : MAX_TRANSCRIBED_PAGES;
  const pages = Math.max(1, Math.min(MAX_TRANSCRIBED_PAGES, asked));
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  // A stalled call must end in the editor's fallback (generate from the file
  // as a source), not in a "Generating…" that never ends: the SDK's own
  // timeout is ten minutes (a local replica sat there past 280 s, 28 Sep 2026).
  const client = new OpenAI({ maxRetries: 1, timeout: 120_000 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: transcribeInstructions(pages),
      input: [{ role: "user", content: [{ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${pdf}` }] }],
      text: { format: { type: "json_schema", name: "pdf_transcript", schema: TRANSCRIPT_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      // About 700 tokens for a dense page, with room to spare.
      max_output_tokens: Math.min(32000, 2000 + pages * 1200),
    });
    // A PDF in the input once got a sentence after the object (see /api/analyze): keep the object.
    const out = response.output_text;
    const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
    const transcript = normalizeTranscript(JSON.parse(json || "{}"), pages);
    if (!transcript) return new Response("The file gave no text", { status: 502 });
    return Response.json(transcript, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message =
      err instanceof OpenAI.AuthenticationError
        ? "Invalid OPENAI_API_KEY"
        : err instanceof OpenAI.APIError
          ? `OpenAI API error (${err.status ?? "network"}): ${err.message}`
          : err instanceof Error
            ? err.message
            : "Transcription failed";
    return new Response(message, { status: 502 });
  }
}
