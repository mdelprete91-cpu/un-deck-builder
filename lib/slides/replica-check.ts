/**
 * The replica checked against its source by eye (Mario, 13 Oct 2026: "when
 * you replicate, make a sprite sheet of the attached slides and compare it
 * with the result"). The fidelity check (fidelity.ts) compares the words, so
 * a deck can keep every line and still divide it wrongly: a table of six
 * rows came back as six slides, each country apart from its own text. Two
 * contact sheets, the source's pages and the replica's slides, each tile
 * numbered, go to the model with the plan that maps one onto the other, and
 * it names where the text is divided differently from the source. Only the
 * division (Mario, 13 Oct 2026: "this is only to understand how the text is
 * split across the slides; the layout is yours, pick the best one available
 * to tell the story"): the replica's layouts are never judged against the
 * source's. The editor fixes what it can before the deck opens.
 */

export const CHECK_KINDS = ["split", "merged", "grouping", "empty", "title", "extra"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export interface CheckProblem {
  /** The source page, 1-based, or 0 for a result slide with no source page ("extra"). */
  source: number;
  /** The result slides concerned, 1-based. */
  result: number[];
  kind: CheckKind;
  /** What is wrong, in one sentence a person can read. */
  detail: string;
  /** What the slide should be instead, as an instruction to rebuild it. */
  fix: string;
}

export const CHECK_SCHEMA = {
  type: "object",
  properties: {
    problems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "integer" },
          result: { type: "array", items: { type: "integer" } },
          kind: { type: "string", enum: [...CHECK_KINDS] },
          detail: { type: "string" },
          fix: { type: "string" },
        },
        required: ["source", "result", "kind", "detail", "fix"],
        additionalProperties: false,
      },
    },
  },
  required: ["problems"],
  additionalProperties: false,
} as const;

export const CHECK_INSTRUCTIONS = `You check how a replicated slide deck divides its source's text across slides. You get two contact sheets: the SOURCE pages and the RESULT slides, each tile numbered in its corner, and the map of which result slides each source page became. The result is redesigned on purpose: its brand, fonts, colours, layouts and pictures are chosen to tell the story well and may differ completely from the source; never report any of that. Judge only how the text is divided and grouped:
- split: one source page became two or more result slides although its text belongs together and one slide could hold it (a list of rows, a set of cards, a short table).
- merged: the text of two source pages ended up on one result slide.
- grouping: on the result slide, text that belongs together in the source is pulled apart (a label away from its own text, a row's cells in different places, a heading separated from its points) or unrelated text is joined.
- empty: a result slide carries almost no text although its source page has plenty, or a slide with only a title and a footer.
- title: the result slide's title is not the source page's title (a placeholder like "x", or a footer label used as the title).
- extra: a result slide with text that matches no source page.
"detail" is one plain sentence naming how the source divides that text and how the result does. "fix" says only how the text should be divided and grouped ("one slide: six items, each a country with its own text"), never which layout, colour or picture to use. A source page whose text keeps its division gets no entry. An empty list is the right answer when every page's text is divided as in the source.`;

export function normalizeCheck(raw: unknown): CheckProblem[] {
  const list = (raw as { problems?: unknown })?.problems;
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => p as Record<string, unknown>)
    .filter((p) => (CHECK_KINDS as readonly string[]).includes(String(p.kind)))
    .map((p) => ({
      source: Math.max(0, Math.round(Number(p.source) || 0)),
      result: Array.isArray(p.result) ? p.result.map((n) => Math.round(Number(n))).filter((n) => n > 0) : [],
      kind: p.kind as CheckKind,
      detail: String(p.detail ?? "").slice(0, 400),
      fix: String(p.fix ?? "").slice(0, 400),
    }));
}
