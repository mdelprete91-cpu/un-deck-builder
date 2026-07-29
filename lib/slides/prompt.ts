import { CATALOG } from "./catalog";
import { AI_LAYOUT_IDS, type SlideContent } from "./schema";

/**
 * System prompt: layout catalog + brand voice. Kept tight — prompt size
 * drives latency and cost on every generation.
 */
export function buildSystemPrompt(): string {
  const catalogLines = CATALOG.map((c) => `- ${c.id}: ${c.usage}. Fields: ${c.fields}`).join("\n");
  return `You are the slide planner for the Giga deck builder. Giga is the UNICEF-ITU initiative connecting every school in the world to the internet. You turn a brief into a slide deck by picking layouts from a fixed template library and writing the text that fills them. You never design slides — you only choose layoutIds from the catalog and fill their fields.

LAYOUT CATALOG (id: when to use. fields with hard word limits):
${catalogLines}

RULES:
- Output slides in presentation order. Start with "cover"; end with "thank-you" when the deck is 5+ slides.
- Use "agenda" right after the cover only for decks of 6+ slides.
- Pick the layout that best fits each beat of the story. Never use the same layout for 3 slides in a row. Alternate light and dark surfaces so the deck has rhythm.
- Respect every word limit strictly. Numbers do the talking: prefer concrete figures over adjectives.
- Voice: plain, declarative, infrastructural, public-good. Sentence case everywhere (never Title Case in body text). Banned words: leveraging, synergies, cutting-edge, revolutionary, empower, unlock.
- Write in the same language as the brief.
- Only state facts given in the brief or well-known Giga facts (2.2M+ schools mapped, 146 countries, giga.global). Never invent statistics, names, or emails — if the brief lacks contacts for thank-you, use name "Giga Team", role "Giga", location "Geneva, Switzerland", email "giga@unicef.org".
- For chart-bars, values are relative heights 0-100.
- Every slide object includes every field of the output schema. Set fields the chosen layout does not use to "" (strings) or [] (arrays) — never invent content for them.`;
}

interface GenerateBody {
  mode: "generate" | "add" | "regenerate";
  brief: string;
  count?: number;
  brandLabel?: string;
  existingSlides?: SlideContent[];
  targetSlide?: SlideContent;
  instruction?: string;
}

export function buildUserMessage(body: GenerateBody): string {
  const brand = body.brandLabel ? ` The deck is branded "${body.brandLabel}".` : "";
  switch (body.mode) {
    case "add": {
      const n = body.count ?? 3;
      return `Existing deck (JSON): ${JSON.stringify(body.existingSlides ?? [])}\n\nDeck brief: ${body.brief}${brand}\n\nRequest: ${body.instruction?.trim() || "continue and deepen the story"}\n\nAdd exactly ${n} new slide${n === 1 ? "" : "s"} fulfilling the request.\n- Return ONLY the new slides in "slides": never repeat, rewrite or include existing slides, and never add another cover, agenda or thank-you.\n- Set "insertAfter" to the 1-based index of the existing slide the new slides belong after (0 = before the first slide). Pick where they best fit the story, keeping any thank-you last.\n- If the deck has an "agenda" slide, return its updated bullets (reflecting the deck after insertion, <=5 words each) in "agenda"; otherwise return an empty array.`;
    }
    case "regenerate":
      return `Current slide (JSON): ${JSON.stringify(body.targetSlide)}\n\nDeck brief: ${body.brief}${brand}\n\nRewrite this single slide.${body.instruction ? ` Instruction: ${body.instruction}` : " Improve the copy."} You may switch to a more appropriate layout if the instruction calls for it. Return exactly one slide.`;
    default:
      return `Brief: ${body.brief}${brand}\n\nCreate a deck of exactly ${body.count ?? 8} slides telling this story.`;
  }
}

/**
 * JSON schema for output_config.format — flat union of fields, validated
 * per-layout client-side. Every field is required: optional fields make the
 * grammar too complex for the API ("Schema is too complex" 400 on Haiku), so
 * the model fills unused fields with ""/[] and the route strips them.
 */
export const SLIDES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          layoutId: { type: "string", enum: [...AI_LAYOUT_IDS] },
          title: { type: "string" },
          subtitle: { type: "string" },
          stat: { type: "string" },
          support: { type: "string" },
          quote: { type: "string" },
          author: { type: "string" },
          body: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, body: { type: "string" } },
              required: ["label", "body"],
              additionalProperties: false,
            },
          },
          stats: {
            type: "array",
            items: {
              type: "object",
              properties: { value: { type: "string" }, label: { type: "string" } },
              required: ["value", "label"],
              additionalProperties: false,
            },
          },
          bars: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, value: { type: "number" } },
              required: ["label", "value"],
              additionalProperties: false,
            },
          },
          contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string" },
                location: { type: "string" },
                email: { type: "string" },
              },
              required: ["name", "role", "location", "email"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "layoutId",
          "title",
          "subtitle",
          "stat",
          "support",
          "quote",
          "author",
          "body",
          "bullets",
          "blocks",
          "stats",
          "bars",
          "contacts",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["slides"],
  additionalProperties: false,
} as const;

/**
 * Output schema for "add" mode: only the new slides, plus where they go and
 * the refreshed agenda bullets (empty when the deck has no agenda slide).
 */
export const ADD_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    insertAfter: { type: "integer" },
    agenda: { type: "array", items: { type: "string" } },
    slides: SLIDES_OUTPUT_SCHEMA.properties.slides,
  },
  required: ["insertAfter", "agenda", "slides"],
  additionalProperties: false,
} as const;

export type { GenerateBody };
