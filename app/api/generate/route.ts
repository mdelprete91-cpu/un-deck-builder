import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  buildUserMessage,
  SLIDES_OUTPUT_SCHEMA,
  type GenerateBody,
} from "@/lib/slides/prompt";
import { SlideStreamParser } from "@/lib/slides/parse";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const SYSTEM_PROMPT = buildSystemPrompt();

/** The schema requires every field, so unused ones arrive as ""/[] — drop them. */
function stripEmptyFields(slide: unknown): unknown {
  if (typeof slide !== "object" || slide === null) return slide;
  return Object.fromEntries(
    Object.entries(slide).filter(([, v]) => v !== "" && !(Array.isArray(v) && v.length === 0)),
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.brief?.trim() && body.mode !== "regenerate") {
    return new Response("Missing brief", { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY is not configured", { status: 500 });
  }

  const client = new Anthropic();
  const count = body.mode === "regenerate" ? 1 : Math.min(Math.max(body.count ?? 8, 1), 20);
  const maxTokens = Math.min(800 + 400 * count, 16000);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const parser = new SlideStreamParser();
      let index = 0;
      try {
        const messageStream = client.messages.stream({
          model: MODEL,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          output_config: {
            format: { type: "json_schema", schema: SLIDES_OUTPUT_SCHEMA },
          },
          messages: [{ role: "user", content: buildUserMessage(body) }],
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            for (const slide of parser.feed(event.delta.text)) {
              send({ type: "slide", index: index++, slide: stripEmptyFields(slide) });
            }
          }
        }

        const final = await messageStream.finalMessage();
        send({
          type: "done",
          stopReason: final.stop_reason,
          truncated: final.stop_reason === "max_tokens",
          usage: {
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
          },
        });
      } catch (err) {
        let message = "Generation failed";
        if (err instanceof Anthropic.AuthenticationError) {
          message = "Invalid ANTHROPIC_API_KEY";
        } else if (err instanceof Anthropic.RateLimitError) {
          message = "Rate limited by the Anthropic API — wait a moment and retry";
        } else if (err instanceof Anthropic.APIError) {
          message = `Anthropic API error (${err.status}): ${err.message}`;
        } else if (err instanceof Error) {
          message = err.message;
        }
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
