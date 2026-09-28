/**
 * The questions a spreadsheet raises before it becomes a deck. The model
 * reads the workbook (one table per sheet, as the composer extracts it)
 * and asks only what the data cannot settle by itself and that changes the
 * slides: which sheet or columns lead, which comparison to draw, what to
 * headline, which span of time, how to read a unit. Nothing generic: every
 * option quotes a header, a row or a figure that is actually in the file.
 * The answers are compiled into the attachment's `insights`, the one
 * field the generate route already reads (Mario, 25 Sep 2026: a fixed
 * question was not enough, the questions come from the document).
 */

export type QuestionKind = "single" | "multi" | "text";

export interface SheetQuestion {
  id: string;
  question: string;
  /** One line on why it matters for the deck, under the question. */
  why: string;
  kind: QuestionKind;
  /** Choices for single/multi, quoted from the sheet; empty for text. */
  options: string[];
  /** Client-written questions only: one line under each option saying what it does (the model never sets it). */
  details?: string[];
}

export interface SheetAnalysis {
  /** One or two sentences on what the workbook holds, in plain words. */
  summary: string;
  questions: SheetQuestion[];
}

/** Answers by question id: a string for single/text, a list for multi. */
export type SheetAnswers = Record<string, string | string[]>;

export const MAX_QUESTIONS = 5;
/** Characters of sheet text sent for the analysis: the headers and the first rows decide the questions. */
export const MAX_ANALYSIS_CHARS = 12_000;

/** Strict structured output: every field required, no extras. */
export const SHEET_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          why: { type: "string" },
          kind: { type: "string", enum: ["single", "multi", "text"] },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["id", "question", "why", "kind", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "questions"],
  additionalProperties: false,
} as const;

export type MaterialKind = "spreadsheet" | "document" | "brief";

/** Under this many words a brief alone is read for the questions it raises; a longer one has said what it wants. */
export const SHORT_BRIEF_WORDS = 40;

/**
 * The brief on its own, when it is short. The questions come from what it
 * leaves open (subject, audience, angle), never from what it says, and the
 * options are what a UNICEF or Giga deck plausibly needs, since a short
 * brief has nothing to quote.
 */
export const BRIEF_ANALYSIS_INSTRUCTIONS = `You prepare a slide deck for a deck builder used by UNICEF and Giga teams. You receive only the brief the user typed, with no material attached. Write a one-sentence summary of the deck it asks for. Then ask questions ONLY where the brief leaves open something that changes the slides: no subject beyond a name ("a deck for UNICEF"), no audience when the deck could be for donors, a ministry, partners or an internal team, no angle when the topic could be told as results, a plan or a request, no period when the figures could be this year or a programme's whole life. A brief that says what the deck is about, for whom and with what angle gets no questions: an empty list is the right answer, never a question for its own sake. Never ask about slide count, colours, fonts or layout names. At most ${MAX_QUESTIONS} questions, each one short sentence; "why" is one short line on what it changes in the deck. Use "multi" whenever the options can hold together in one deck (two scenarios, several countries, periods, sections, figures or audiences the deck could cover side by side), so the user can pick more than one: a question about what to show, present, cover or include is always "multi". "single" only when the question asks for one thing by nature (the main one, the headline, the lead) or the options exclude each other; "text" only when no list fits. Options are two to six plausible choices for this brief in a UNICEF or Giga context, short and concrete, never "Other". Ids are short slugs. Write in the brief's language.`;

/**
 * A document (PDF, Word, PowerPoint, text) is read the other way round: it
 * usually says what it is about, so the model asks only when the material
 * could become two different decks and the brief does not settle it. A
 * clear document gets zero questions, and the wizard stays closed
 * (Mario, 25 Sep 2026: "launch it for any document when the situation is
 * not clear to you").
 */
export const DOCUMENT_ANALYSIS_INSTRUCTIONS = `You prepare a slide deck from reference material for a deck builder used by UNICEF and Giga teams. You receive a document (or its extracted text) and, when there is one, the brief the user wrote. Write a one- or two-sentence summary of what the material holds. Then ask questions ONLY where the material could become two different decks and neither the material nor the brief settles it: several projects, countries, products or audiences in one file and no word on which one; a long report where the deck could follow one chapter or several; two positions or scenarios argued side by side; figures for several periods with no obvious focus; a draft that mixes internal notes with the message to present; a term, acronym or code the slides would have to explain. A digit glued to the end of a number or a word is usually a footnote marker (1,9751 is 1,975 with note 1; case2 is case with note 2), never a question. If the material and the brief make the deck clear, return no questions at all: an empty list is the right answer, never a question for its own sake. Never ask about slide count, colours, fonts or layout names, and never ask what the brief already says. At most ${MAX_QUESTIONS} questions, each one short sentence; "why" is one short line on what it changes in the deck. Use "multi" whenever the options can hold together in one deck (two scenarios, several countries, periods, sections, figures or audiences the deck could cover side by side), so the user can pick more than one: a question about what to show, present, cover or include is always "multi". "single" only when the question asks for one thing by nature (the main one, the headline, the lead) or the options exclude each other; "text" only when no list fits. Every option is quoted from the material: a chapter title, a country, a project name, a period, a figure, exactly as written, two to six of them, never invented and never "Other". Ids are short slugs. Write in English.`;

/** What the model is told before it sees the table. */
export const SHEET_ANALYSIS_INSTRUCTIONS = `You prepare a slide deck from a spreadsheet for a deck builder used by UNICEF and Giga teams. You receive the workbook as one table per sheet (first row usually the headers). Write a one- or two-sentence summary of what it holds, then ask the ${MAX_QUESTIONS} or fewer questions whose answers the data cannot give and that change which slides get made: which sheet or which columns should lead when there are several; which comparison to draw (across rows, across periods, a ranking, a share of a total); which figure deserves the headline; which span of rows or periods to show when there are many; what a column means when its header is ambiguous or a code; which audience or angle when the numbers could tell two stories. Skip anything the data already settles and never ask about slide count, colours, fonts or layout names. Each question is one short sentence; "why" is one short line on what it changes in the deck. Use "multi" whenever the options can hold together in one deck (two scenarios, several countries, periods, sections, figures or audiences the deck could cover side by side), so the user can pick more than one: a question about what to show, present, cover or include is always "multi". "single" only when the question asks for one thing by nature (the main one, the headline, the lead) or the options exclude each other; "text" only when no list fits. Every option is quoted from the file: a sheet name, a column header, a row label, a value or a period exactly as written, two to six of them, never invented and never "Other". Ids are short slugs. Write in English.`;

/** A shape check on what the model or a file handed back; drops what does not fit. */
const SHOW_WHAT = /\b(present|show|include|cover|use|feature|highlight|compare)(s|d|ed|n|ing)?\b/i;
const ONE_THING = /\b(main|primary|headline|lead|leading|anchor|single|one|first|focus on)\b/i;

export function normalizeAnalysis(raw: unknown): SheetAnalysis | null {
  if (typeof raw !== "object" || raw === null) return null;
  const a = raw as { summary?: unknown; questions?: unknown };
  const summary = typeof a.summary === "string" ? a.summary.trim() : "";
  const questions: SheetQuestion[] = [];
  const seen = new Set<string>();
  for (const q of Array.isArray(a.questions) ? a.questions : []) {
    if (typeof q !== "object" || q === null) continue;
    const x = q as Record<string, unknown>;
    const question = typeof x.question === "string" ? x.question.trim() : "";
    let kind: QuestionKind = x.kind === "multi" || x.kind === "text" ? x.kind : "single";
    // "Which figures should the deck present?" asked as one choice, with
    // both figures on offer (the Gambia costs, 28 Sep 2026, rule in the
    // instructions or not): what to show is several answers unless the
    // question asks for the one main thing.
    if (kind === "single" && SHOW_WHAT.test(question) && !ONE_THING.test(question)) kind = "multi";
    const options = (Array.isArray(x.options) ? x.options : []).filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim()).slice(0, 6);
    if (!question) continue;
    if (kind !== "text" && options.length < 2) continue;
    let id = typeof x.id === "string" && x.id.trim() ? x.id.trim().slice(0, 40) : `q${questions.length + 1}`;
    while (seen.has(id)) id += "-";
    seen.add(id);
    questions.push({ id, question, why: typeof x.why === "string" ? x.why.trim() : "", kind, options: kind === "text" ? [] : options });
    if (questions.length === MAX_QUESTIONS) break;
  }
  if (!summary && questions.length === 0) return null;
  return { summary, questions };
}

/**
 * The answers as the prompt reads them: one line per answered question,
 * the question and the answer in plain words. Unanswered questions are
 * left out; nothing at all returns an empty string.
 */
/**
 * What to do with an attached deck (Mario, 28 Sep 2026): asked first, by the
 * client, for every PowerPoint file, whatever the model's own questions. The
 * answer is not an insight like the others: "replicate" switches Generate to
 * the batched, one-slide-per-slide path (app/page.tsx), "reinterpret" adds a
 * line to the file's insights, "source" is the default reading.
 */
export const USE_QUESTION_ID = "use";
export type FileUse = "replicate" | "reinterpret" | "source";
// The choice is the short name; what it does is the line under it (Mario,
// 28 Sep 2026: "too much text, make replicate / reinterpret / source clear").
const USE_OPTIONS: Record<FileUse, { label: string; detail: (n: number) => string }> = {
  replicate: { label: "Replicate", detail: (n) => `One slide for each of its ${n} content slides, in order, every text and figure kept.` },
  reinterpret: { label: "Reinterpret", detail: () => "The same story in a new structure. Facts and figures kept." },
  source: { label: "Use as a source", detail: () => "Only what your brief asks for." },
};
export function fileUseQuestion(contentSlides: number): SheetQuestion {
  const keys = Object.keys(USE_OPTIONS) as FileUse[];
  return {
    id: USE_QUESTION_ID,
    question: "What should the deck do with this file?",
    why: "",
    kind: "single",
    options: keys.map((k) => USE_OPTIONS[k].label),
    details: keys.map((k) => USE_OPTIONS[k].detail(contentSlides)),
  };
}
/** The use chosen for a file; unanswered or skipped is "source". */
export function fileUseOf(answers: SheetAnswers | undefined): FileUse {
  const a = answers?.[USE_QUESTION_ID];
  const text = typeof a === "string" ? a : "";
  return text.startsWith("Replicate") ? "replicate" : text.startsWith("Reinterpret") ? "reinterpret" : "source";
}

export function compileInsights(analysis: SheetAnalysis, answers: SheetAnswers): string {
  const lines: string[] = [];
  if (fileUseOf(answers) === "reinterpret") {
    lines.push("Reinterpret this file: tell its story in a new structure of your choosing, keeping its facts and figures.");
  }
  for (const q of analysis.questions) {
    if (q.id === USE_QUESTION_ID) continue;
    const a = answers[q.id];
    const text = Array.isArray(a) ? a.filter(Boolean).join(", ") : (a ?? "").trim();
    if (!text) continue;
    lines.push(`${q.question} ${text}.`);
  }
  return lines.join(" ");
}

/** How many of the questions carry an answer. */
export function answeredCount(analysis: SheetAnalysis, answers: SheetAnswers): number {
  return analysis.questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : !!(a ?? "").trim();
  }).length;
}
