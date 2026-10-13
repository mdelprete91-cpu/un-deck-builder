/**
 * The replica checked against its source by eye (Mario, 13 Oct 2026: "when
 * you replicate, make a sprite sheet of the attached slides and compare it
 * with the result"). The fidelity check (fidelity.ts) compares the words, so
 * a deck can keep every line and still lose the source's shape: a table of
 * six rows came back as six slides, maps and photos dropped, a matrix
 * flattened into cards. Two contact sheets, the source's pages and the
 * replica's slides, each tile numbered, go to the model with the plan that
 * maps one onto the other, and it names, slide by slide, where the shape is
 * not the source's. The editor fixes what it can before the deck opens.
 */

export const CHECK_KINDS = ["split", "merged", "structure", "missing_image", "empty", "title", "extra"] as const;
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

export const CHECK_INSTRUCTIONS = `You check a replicated slide deck against its source. You get two contact sheets: the SOURCE pages and the RESULT slides, each tile numbered in its corner, and the map of which result slides each source page became. The result is drawn in a different brand on purpose: its fonts, colours and template layouts differ from the source and that is never a problem. Compare the SHAPE of each source page with what it became and list only real problems:
- split: one source page became two or more result slides although it is a single slide of content (a table, rows, cards) that one slide could hold.
- merged: two source pages ended up on one result slide.
- structure: the source's structure is lost: a table or rows became loose bullets or one line per card, a grid or matrix flattened, numbered steps lost their numbers, label and text pulled apart, big figures turned into plain text.
- missing_image: a photo, map, logo or diagram in the source has no counterpart on its result slide.
- empty: a result slide is nearly empty or shows a large empty area where the source page is full.
- title: the result slide's title is not the source page's title (a placeholder like "x" or a footer label used as the title).
- extra: a result slide that matches no source page (a generic closing or divider the source does not have).
"detail" is one plain sentence naming what the source shows and what the result shows. "fix" is one instruction to rebuild that slide so its shape matches the source ("one slide: a list of six rows, country as label, its text beside it"). A source page that the result keeps in the same shape gets no entry. Never report text wording, colours, fonts or styling. An empty list is the right answer when every page kept its shape.`;

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
