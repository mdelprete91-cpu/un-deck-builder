import OpenAI from "openai";
import { isLang, LANG_NAMES, type Lang } from "@/lib/slides/i18n";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Translates a batch of a deck's texts (lib/slides/i18n.ts), field by field,
 * for the language switch. The deck's model, reasoning off, strict schema.
 * A field reworded by hand whose original then changed comes with
 * `previous`, the user's wording, to keep where the meaning has not changed.
 */
const MAX_ITEMS = 160;
const MAX_TEXT = 3000;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, text: { type: "string" } },
        required: ["id", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

function instructions(to: Lang): string {
  return `You translate the texts of a UNICEF presentation into ${LANG_NAMES[to]}. Each item is one text on a slide or a printed page: a title, a label, a point, a figure's caption. Return every item with its id and its translation.

RULES:
- Translate the meaning, in the plain, public-good voice of UNICEF communications in ${LANG_NAMES[to]}. Sentence case: a capital only where ${LANG_NAMES[to]} needs one.
- Keep exactly as written: every figure, unit, currency, percentage and date; names of people, places and organisations; product names (Giga, Giga Maps, Giga Meter, Connectivity Credits, UNICEF, ITU, UNICEF Digital Inclusion).
- Keep the form: a line that starts with "- " keeps it; line breaks stay where they are; a short label stays short; a text of one or two words stays one or two words.
- An item may say "highlight of" another item: its translation must be copied word for word from that other item's translation.
- No em or en dashes. No added words, no explanations.
- When an item has "previous", that is the user's own wording for this text in ${LANG_NAMES[to]}: keep it wherever the meaning of the new text has not changed.`;
}

export async function POST(request: Request): Promise<Response> {
  let body: { from?: unknown; to?: unknown; items?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!isLang(body.to) || !isLang(body.from)) return new Response("Unknown language", { status: 400 });
  const items = Array.isArray(body.items)
    ? body.items
        .filter((x): x is { id: string; text: string; previous?: string; highlightOf?: string } => !!x && typeof x.id === "string" && typeof x.text === "string")
        .slice(0, MAX_ITEMS)
        .map((x) => ({
          id: x.id.slice(0, 40),
          text: x.text.slice(0, MAX_TEXT),
          ...(typeof x.previous === "string" ? { previous: x.previous.slice(0, MAX_TEXT) } : {}),
          ...(typeof x.highlightOf === "string" ? { highlightOf: x.highlightOf.slice(0, 40) } : {}),
        }))
    : [];
  if (!items.length) return Response.json({ items: [] });
  if (!process.env.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is not configured", { status: 500 });

  const client = new OpenAI({ maxRetries: 3 });
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna",
      instructions: instructions(body.to),
      input: [
        {
          role: "user",
          content: `From ${LANG_NAMES[body.from as Lang]} into ${LANG_NAMES[body.to]}.\n\nItems (JSON):\n${JSON.stringify(items)}`,
        },
      ],
      text: { format: { type: "json_schema", name: "translation", schema: SCHEMA as unknown as Record<string, unknown>, strict: true } },
      reasoning: { effort: "none" },
      max_output_tokens: 16000,
    });
    const parsed = JSON.parse(response.output_text || "{}") as { items?: { id: string; text: string }[] };
    const known = new Set(items.map((x) => x.id));
    return Response.json({ items: (parsed.items ?? []).filter((x) => known.has(x.id)) });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Could not translate", { status: 502 });
  }
}
