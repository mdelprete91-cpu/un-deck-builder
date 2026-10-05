import OpenAI from "openai";
import { CHAPTERS_INSTRUCTIONS, CHAPTERS_SCHEMA, planFromAnswer } from "@/lib/slides/chapters";

export const runtime = "nodejs";

/**
 * Groups a finished deck's content slides into chapters, for the safety net
 * in lib/slides/chapters.ts: titles in, `{ chapters: [{ title, start }] }`
 * out, with `start` turned back into the title of the chapter's first slide.
 * A small call, the same model as the deck, reasoning off.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { titles?: unknown; brief?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const titles = Array.isArray(body.titles) ? body.titles.filter((t): t is string => typeof t === "string").map((t) => t.slice(0, 200)).slice(0, 60) : [];
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 4000) : "";
  if (titles.length < 4) return Response.json({ chapters: [] });
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const client = new OpenAI({ maxRetries: 3 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: CHAPTERS_INSTRUCTIONS,
      input: [{ role: "user", content: `Deck brief: ${brief}\n\nContent slides:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}` }],
      text: { format: { type: "json_schema", name: "chapters", schema: CHAPTERS_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 400,
    });
    return Response.json({ chapters: planFromAnswer(titles, JSON.parse(response.output_text || "{}")) });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Could not group the slides", { status: 502 });
  }
}
