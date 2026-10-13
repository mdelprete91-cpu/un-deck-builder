import OpenAI from "openai";
import { CHECK_INSTRUCTIONS, CHECK_SCHEMA, normalizeCheck } from "@/lib/slides/replica-check";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A sheet as a data URL: JPEG or PNG, at most this many characters (about 2.2 MB of image). */
const MAX_SHEET = 3_000_000;
const SHEET = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * The replica's shape against its source (lib/slides/replica-check.ts): two
 * contact sheets and the map from source pages to result slides in, the
 * problems out. One call, reasoning off.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { source?: unknown; result?: unknown; map?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const sheet = (v: unknown) => (typeof v === "string" && v.length <= MAX_SHEET && SHEET.test(v) ? v : "");
  const source = sheet(body.source);
  const result = sheet(body.result);
  if (!source || !result) return new Response("Two sheets are needed", { status: 400 });
  const map = typeof body.map === "string" ? body.map.slice(0, 4000) : "";
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const client = new OpenAI({ maxRetries: 1, timeout: 90_000 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: CHECK_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "SOURCE pages:" },
            { type: "input_image", image_url: source, detail: "high" },
            { type: "input_text", text: "RESULT slides:" },
            { type: "input_image", image_url: result, detail: "high" },
            { type: "input_text", text: map ? `Which result slides each source page became:\n${map}` : "No map: match the pages by their content." },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "replica_check", schema: CHECK_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 3000,
    });
    const out = response.output_text;
    const problems = normalizeCheck(JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1) || "{}"));
    return Response.json({ problems, usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message =
      err instanceof OpenAI.AuthenticationError
        ? "Invalid OPENAI_API_KEY"
        : err instanceof OpenAI.APIError
          ? `OpenAI API error (${err.status ?? "network"}): ${err.message}`
          : err instanceof Error
            ? err.message
            : "Check failed";
    return new Response(message, { status: 502 });
  }
}
