import OpenAI from "openai";
import { CONTRACT_INSTRUCTIONS, CONTRACT_MODEL, CONTRACT_SCHEMA, normalizeContract } from "@/lib/slides/contract";
import { fetchLinkedPages } from "@/lib/slides/links-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The brief's contract (lib/slides/contract.ts): what the brief prescribes,
 * read while the deck is being written, never shown to the model that
 * writes it. Brief, the user's answers and the linked pages in; slides,
 * last content and entities out. The client skips it on any failure.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { brief?: unknown; briefNotes?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 12_000) : "";
  const notes = typeof body.briefNotes === "string" ? body.briefNotes.slice(0, 2000) : "";
  if (!brief.trim()) return new Response("Missing brief", { status: 400 });
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  // The same pages the deck reads (a second fetch, in parallel with the
  // generation); a page that fails is left out, as there.
  const linked = await fetchLinkedPages(brief);
  const pages = linked.map((a) => (a.kind === "text" ? `Linked page "${a.name}":\n<<<\n${a.text.slice(0, 20_000)}\n>>>` : "")).filter(Boolean);
  const input = [`Brief:\n${brief}`, notes ? `The user's answers about the brief: ${notes}` : "", ...pages].filter(Boolean).join("\n\n");

  const client = new OpenAI({ maxRetries: 2 });
  try {
    const response = await client.responses.create({
      model: CONTRACT_MODEL.model,
      instructions: CONTRACT_INSTRUCTIONS,
      input: [{ role: "user", content: input }],
      text: { format: { type: "json_schema", name: "contract", schema: CONTRACT_SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: CONTRACT_MODEL.effort },
      max_output_tokens: 2500,
    });
    return Response.json(
      { contract: normalizeContract(JSON.parse(response.output_text || "{}")), usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Could not read the brief", { status: 502 });
  }
}
