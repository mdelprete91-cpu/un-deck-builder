import OpenAI from "openai";
import { SHORTEN_OUTPUT_SCHEMA } from "@/lib/slides/prompt";
import { languageOf } from "@/lib/slides/brief";

export const runtime = "nodejs";

/**
 * The model's part of a two-pager's fit pass (lib/slides/pages/fit.ts): one
 * block that still runs past its printed page comes back about `chars`
 * characters shorter, same type and same structure. A small call on the
 * deck's model, reasoning off.
 */
const INSTRUCTIONS =
  "You shorten one block of a printed A4 two-pager so the page fits. Return the same block: same type, same fields, the same number of items in the same order, every label and heading as it was. Shorten only body text, by at least the number of characters asked: cut the least important sentences and clauses first, keep every figure, name and date that matters, never add anything, never change a meaning. No em or en dashes. Write in the language of the block.";

export async function POST(request: Request): Promise<Response> {
  let body: { block?: unknown; chars?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (typeof body.block !== "object" || body.block === null) return new Response("Missing block", { status: 400 });
  const block = JSON.stringify(body.block).slice(0, 12_000);
  const chars = typeof body.chars === "number" && body.chars > 0 ? Math.min(Math.round(body.chars), 4000) : 300;
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const language = languageOf(block);
  const client = new OpenAI({ maxRetries: 3 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: `Block (JSON): ${block}\n\nShorten its text by at least ${chars} characters.${language ? ` Keep it in ${language}.` : ""}`,
        },
      ],
      text: { format: { type: "json_schema", name: "block", schema: SHORTEN_OUTPUT_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 2500,
    });
    const parsed = JSON.parse(response.output_text || "{}") as { block?: unknown };
    return Response.json({ block: parsed.block ?? null });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Could not shorten the block", { status: 502 });
  }
}
