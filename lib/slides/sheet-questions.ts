import { MAX_SLIDES, MIN_SLIDES_WITH_CHAPTERS } from "./brief";
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
  /**
   * Client-written single questions only: a last row that takes a number
   * typed on it, answered as "<n> <unit>" (the length question's "Custom").
   */
  custom?: { label: string; unit: string; min: number; max: number; detail?: string };
  /** The brief's facts slot: the option that means "I will attach a file", which stops the wizard at the file picker. */
  attach?: string;
  /** A brief's doubt: the words of the brief it is about, quoted above the question. */
  about?: string;
  /** A doubt about missing material: the answer can be a placeholder the user fills in later (PLACEHOLDER_ANSWER). */
  placeholder?: boolean;
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


/**
 * The slots a presenter fills before writing a deck (the evaluation of 12
 * Oct 2026: "a deck about Giga for the Ministry of Education of Kenya" came
 * back as eleven generic slides, because nobody asked what the meeting was
 * for). In this order, at most three asked, each question's id its slot.
 */
export const BRIEF_SLOTS = ["purpose", "facts", "ask", "audience"] as const;
export type BriefSlot = (typeof BRIEF_SLOTS)[number];
export const MAX_BRIEF_QUESTIONS = 5;
/**
 * What the brief leaves unclear, wrong or empty (Mario, 13 Oct 2026: "the
 * model must ask when something is unclear, when some numbers do not add
 * up"): asked before the slots, in the order the model found them.
 */
export const DOUBT_IDS = ["doubt-1", "doubt-2", "doubt-3", "doubt-4", "doubt-5"] as const;
/** The client's own question when the brief names one slide count and lists another (lib/slides/brief-checks.ts). */
export const COUNT_DOUBT_ID = "count";
/**
 * The answer that says "I do not have it yet" (Mario, 13 Oct 2026: when the
 * user wants something in the deck and has no figure, offer to type it or to
 * leave a placeholder to fill in by hand). The deck then shows a bracketed
 * placeholder naming what goes there, never an invented value.
 */
export const PLACEHOLDER_ANSWER = "[placeholder]";
/** How compileInsights names each slot's answer, and slotsFromNotes reads it back. */
export const SLOT_LABELS: Record<BriefSlot, string> = { purpose: "Purpose:", facts: "Facts:", ask: "The ask:", audience: "Audience:" };

/** The brief's schema: the same shape, its ids the doubts and the slots, each with the brief's words it is about. */
export const BRIEF_ANALYSIS_SCHEMA = {
  ...SHEET_ANALYSIS_SCHEMA,
  properties: {
    ...SHEET_ANALYSIS_SCHEMA.properties,
    questions: {
      ...SHEET_ANALYSIS_SCHEMA.properties.questions,
      items: {
        ...SHEET_ANALYSIS_SCHEMA.properties.questions.items,
        properties: {
          ...SHEET_ANALYSIS_SCHEMA.properties.questions.items.properties,
          id: { type: "string", enum: [...DOUBT_IDS, ...BRIEF_SLOTS] },
          about: { type: "string" },
        },
        required: [...SHEET_ANALYSIS_SCHEMA.properties.questions.items.required, "about"],
      },
    },
  },
} as const;

/**
 * The slot answers back out of the compiled notes ("Purpose: … The ask: …"),
 * for the pipeline: a deck that asks for something ends on that ask.
 */
export function slotsFromNotes(notes: string | undefined): Partial<Record<BriefSlot, string>> {
  const out: Partial<Record<BriefSlot, string>> = {};
  if (!notes) return out;
  const marks = BRIEF_SLOTS.map((slot) => ({ slot, at: notes.indexOf(SLOT_LABELS[slot]) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  marks.forEach((m, i) => {
    const text = notes
      .slice(m.at + SLOT_LABELS[m.slot].length, marks[i + 1]?.at ?? notes.length)
      .trim()
      .replace(/\.$/, "");
    if (text) out[m.slot] = text;
  });
  return out;
}

/** A purpose that asks the audience for something or for a decision, in the languages the builder writes. */
const ASKING = /\b(ask|request|propos|convinc|secure|decid|decision|approv|commit|fund|chied|richiest|propost|decision|convinc|approva|pedir|solicit|propuesta|decisi[oó]n|aprob|demand|proposer|d[ée]cision|approuv)/i;
export const purposeAsks = (purpose: string | undefined) => !!purpose && ASKING.test(purpose);

/**
 * Every brief, short or long, is read before the deck is written (Mario,
 * 13 Oct 2026: a long technical brief came back with empty slides for the
 * decisions, the phases and the diagrams, and the gaps were only listed
 * after the deck; "it is important to improve the wizard rather than flag
 * problems afterwards"). The model looks for doubts first, then the slots.
 */
export const BRIEF_ANALYSIS_INSTRUCTIONS = `You read a deck brief for a deck builder used by UNICEF and Giga teams, before the deck is written. The deck may only use what the brief, the user's answers and the attached files say: it never invents figures, names, dates, components or decisions. So ask now, the way a careful colleague would before starting, about anything that would otherwise leave a slide empty, wrong or made up. Write a one-sentence summary of the deck it asks for. Then the questions, at most ${MAX_BRIEF_QUESTIONS}, in this order:

DOUBTS (ids doubt-1, doubt-2, … in order):
1. Inconsistencies: figures that do not add up or contradict each other, dates that have passed or do not follow, a count that does not match a list, two statements that cannot both be true. The "Checks already found" below are certain or nearly: ask about each one unless the brief itself resolves it.
2. Missing content for a slide the brief prescribes: for each slide of its outline, or each part it announces ("a plan in 3 phases", "the decisions needed", "a diagram of the current architecture"), check that the brief or the files give the material to fill it. When they do not, ask for exactly that material, naming the slide: "Slide 12 asks for the decisions needed from this meeting: which decisions?". A slide whose content is a list only the presenter knows is empty unless the brief gives its items: decisions needed, phases or steps, risks, open questions, next steps with dates or owners, a budget, a team, the boxes and arrows of an architecture or process diagram the brief does not describe part by part, a model or schema it names without saying what it holds. Go through the prescribed slides and find every such slide, then ask first about the ones where an invented answer would mislead the most: decisions, phases or steps, risks and open questions, dates and owners, figures; then the models and diagrams; then the rest. The slides named in "Checks already found" come first; then go on with the other empty slides (a diagram, a model) until the questions run out, rather than stopping early. Merge two slides into one question when they are about one thing. Leave alone the slides the brief's own words can fill (a context, pain points it lists, a proposal it spells out, goals that follow from its problems). An outline item that already lists what goes on it after a colon ("Timeline for 2027: Q1 data refresh, Q2 cost model update, …", "Rwanda: capex US$41 million, opex US$6.2 million per year") is filled: never ask it for more items, details, owners or dates.
   A figure the brief wants shown and does not give (a budget, a target, a result, a cost, a date) is always worth a question, naming the figure: "Slide 5 asks for the 2027 budget: what is the amount?". The user can type it or leave a placeholder.
3. Real ambiguities: a term, acronym, name or reference that could be read two ways and would change the slides. A date without a year is this year (or the coming one when it is a plan): never ask which year.
SLOTS (only if questions are left, at most three of them, ids are the slot names):
4. purpose: what the deck is for, only if the brief does not say it.
5. facts: if the brief gives no figures and no file is attached, what the deck should rely on: attaching a file, or only the public figures already allowed.
6. ask: what the audience should do or decide at the end, only if the brief does not say it and the purpose is not to report. "End with a clear ask" or "a final slide with our ask" names the slide, not the ask: when the brief and the files never say what is asked (an amount, a decision, a partnership), ask it.
7. audience: who will see it, only if the brief names no one.

Each question is one short sentence of 12 words or fewer, plain, no preamble ("Which decisions should this meeting take?", not "For slide 12, which asks for…": "about" already says where); "why" is 8 words or fewer. "about" quotes the few words of the brief the question is about, exactly as written (empty for a slot about something the brief does not mention). For a doubt about missing content use "text": the options are two to four short starting points the user can pick and complete (for the phases: "Pilot, then …"), each different from the others and never a copy of the brief's words or of "about"; when there is no sensible starting point, no options. Never invented facts. For an inconsistency use "single", the options being the readings that could be right. "single" for purpose, facts and audience; "multi" for ask. Options name the brief's country, organisation and audience, short and concrete, never "Other". "why" is one short line on what the answer changes in the deck. Never write that you cannot search the web, browse or check sources online: the app tells the user that itself. Never ask about colours, layouts, fonts or style, never ask what the brief, the files or Giga's websites (when shown) already say, never ask what the slides should cover when that material can fill them, never ask two questions about one thing. A brief that is complete and consistent gets an empty list: that is the right answer, never a question for its own sake. Write in the brief's language.`;

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
export const SHEET_ANALYSIS_INSTRUCTIONS = `You prepare a slide deck from a spreadsheet for a deck builder used by UNICEF and Giga teams. You receive the workbook as one table per sheet (first row usually the headers). Write a one- or two-sentence summary of what it holds, then ask the ${MAX_QUESTIONS} or fewer questions whose answers the data cannot give and that change which slides get made: which sheet or which columns should lead when there are several; which comparison to draw (across rows, across periods, a ranking, a share of a total); which figure deserves the headline; which span of rows or periods to show when there are many; what a column means when its header is ambiguous or a code; which audience or angle when the numbers could tell two stories. Skip anything the data already settles, and anything the brief settles: never ask the user to choose between things the brief asks for together ("what the counts show and what to fix first" wants both). Never ask about slide count, colours, fonts or layout names. Each question is one short sentence; "why" is one short line on what it changes in the deck. Use "multi" whenever the options can hold together in one deck (two scenarios, several countries, periods, sections, figures or audiences the deck could cover side by side), so the user can pick more than one: a question about what to show, present, cover or include is always "multi". "single" only when the question asks for one thing by nature (the main one, the headline, the lead) or the options exclude each other; "text" only when no list fits. Every option is quoted from the file: a sheet name, a column header, a row label, a value or a period exactly as written, two to six of them, never invented and never "Other". Ids are short slugs. Write in English.`;

/** A shape check on what the model or a file handed back; drops what does not fit. */
const SHOW_WHAT = /\b(present|show|include|cover|use|feature|highlight|compare)(s|d|ed|n|ing)?\b/i;
const ONE_THING = /\b(main|primary|headline|lead|leading|anchor|single|one|first|focus on)\b/i;
/**
 * A choice between readings that exclude each other: two figures for one
 * cost, "include them or omit them". Made "multi" by "use"/"include", it read
 * "Choose one or more" over USD 37.7 and USD 39.7 million for the same cost (18 Oct 2026).
 */
const EITHER = /\b(conflict\w*|contradict\w*|inconsisten\w*|discrepan\w*|or omit|or leave out|or drop|or another)\b|\bwhich (?:\S+ ){0,3}(?:figure|cost|count|number|value|amount|total|date|year|price|budget)\b(?! and)/i;

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
    const why = typeof x.why === "string" ? x.why : "";
    if (kind === "single" && SHOW_WHAT.test(question) && !ONE_THING.test(question) && !EITHER.test(`${question} ${why}`)) kind = "multi";
    if (kind === "multi" && EITHER.test(`${question} ${why}`)) kind = "single";
    const options = (Array.isArray(x.options) ? x.options : []).filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim()).slice(0, 6);
    if (!question) continue;
    if (kind !== "text" && options.length < 2) continue;
    let id = typeof x.id === "string" && x.id.trim() ? x.id.trim().slice(0, 40) : `q${questions.length + 1}`;
    while (seen.has(id)) id += "-";
    seen.add(id);
    const about = typeof x.about === "string" && x.about.trim() ? x.about.trim().slice(0, 200) : undefined;
    // A text question's options are starting points the wizard offers as chips.
    questions.push({ id, question, why: typeof x.why === "string" ? x.why.trim() : "", kind, options: kind === "text" ? options.slice(0, 4) : options, ...(about ? { about } : {}) });
    if (questions.length === MAX_QUESTIONS) break;
  }
  if (!summary && questions.length === 0) return null;
  return { summary, questions };
}

const ATTACH_OPTION = /\b(attach|upload|file|alleg|carica|file|adjunt|archivo|sub[ei]r|joindre|fichier|anex)/i;

/** True when the brief's facts answer is the file option: the wizard stops and opens the file picker. */
export function wantsFile(analysis: SheetAnalysis | undefined, answers: SheetAnswers): boolean {
  const facts = analysis?.questions.find((q) => q.id === "facts");
  return !!facts?.attach && answers.facts === facts.attach;
}

/** A brief's questions: the count first, then the doubts, then the slots in slot order, five at most. */
export function normalizeBriefAnalysis(raw: unknown): SheetAnalysis | null {
  const a = normalizeAnalysis(raw);
  if (!a) return null;
  const ORDER: string[] = [COUNT_DOUBT_ID, ...DOUBT_IDS, ...BRIEF_SLOTS];
  const order = (id: string) => ORDER.indexOf(id);
  const kinds = new Map(Array.isArray((raw as { questions?: unknown }).questions) ? ((raw as { questions: { id?: unknown; kind?: unknown }[] }).questions.map((q) => [q?.id, q?.kind])) : []);
  const questions = a.questions
    .filter((q) => order(q.id) >= 0)
    .sort((x, y) => order(x.id) - order(y.id))
    // "Which year?" for "6 to 9 Oct" or "a sprint in Nov": the year is plain, the rule in the instructions or not.
    .filter((q) => !/\b(what|which) years?\b|\bwhat year\b|\bquale anno\b|\bqu[eé] a[nñ]o\b/i.test(q.question))
    // Three slots at most: a vague brief once got all four (13 Oct 2026).
    .filter((q, i, all) => !(BRIEF_SLOTS as readonly string[]).includes(q.id) || all.slice(0, i + 1).filter((x) => (BRIEF_SLOTS as readonly string[]).includes(x.id)).length <= 3)
    .slice(0, MAX_BRIEF_QUESTIONS)
    // Purpose, facts and audience are one answer each (the instructions say
    // so); normalizeAnalysis would make "…a file with figures to use?" a
    // multiple choice, and the file option would no longer stop the wizard.
    // A doubt keeps the kind the model gave it: "which readings are right"
    // is one answer, whatever its words.
    .map((q) => (q.id !== "ask" && q.kind === "multi" && (BRIEF_SLOTS as readonly string[]).includes(q.id) ? { ...q, kind: "single" as const } : q))
    .map((q) => ((DOUBT_IDS as readonly string[]).includes(q.id) && (kinds.get(q.id) === "single" || kinds.get(q.id) === "text") ? { ...q, kind: kinds.get(q.id) as QuestionKind } : q))
    // A chip that repeats the quoted words adds nothing (bullet-dump, 13 Oct 2026).
    .map((q) => (q.kind === "text" ? { ...q, options: q.options.filter((o) => o.toLowerCase() !== (q.about ?? "").toLowerCase()) } : q))
    // Missing material can be left as a placeholder to fill in by hand.
    .map((q) => ((DOUBT_IDS as readonly string[]).includes(q.id) && q.kind === "text" ? { ...q, placeholder: true } : q))
    .map((q) => {
      if (q.id !== "facts") return q;
      // The model words the option in the brief's language; the one about a file is the one that opens the picker.
      const attach = q.options.find((o) => ATTACH_OPTION.test(o));
      return attach ? { ...q, attach } : q;
    });
  return { ...a, questions };
}

/**
 * The answers as the prompt reads them: one line per answered question,
 * the question and the answer in plain words. Unanswered questions are
 * left out; nothing at all returns an empty string.
 */
/**
 * What to do with an attached deck (Mario, 28 Sep 2026): asked first, by the
 * client, for every PowerPoint file and every PDF, whatever the model's own questions. The
 * answer is not an insight like the others: "replicate" switches Generate to
 * the batched, one-slide-per-slide path (app/page.tsx), "reinterpret" adds a
 * line to the file's insights, "source" is the default reading.
 */
export const USE_QUESTION_ID = "use";
export type FileUse = "replicate" | "reinterpret" | "source";
// The choice is the short name; what it does is the line under it (Mario,
// 28 Sep 2026: "too much text, make replicate / reinterpret / source clear").
// Reinterpret first and preselected (Mario, 28 Sep 2026), then Replicate,
// then Use as a source: the key order is the order on screen.
const USE_OPTIONS: Record<FileUse, { label: string; detail: (n: number, unit?: string) => string }> = {
  reinterpret: { label: "Reinterpret", detail: () => "The same story in a new structure. Facts and figures kept." },
  // n is 0 for a PDF pdf.js could not open: the pages are counted when the model reads them.
  replicate: { label: "Replicate", detail: (n, unit = "slides") => `One slide for each of its ${n ? `${n} content ` : ""}${unit}, in order, every text and figure kept.` },
  source: { label: "Use as a source", detail: () => "Only what your brief asks for." },
};
/** The answer the question opens with, and what a skip or a close leaves. */
export const DEFAULT_FILE_USE = USE_OPTIONS.reinterpret.label;
/** The same choice for a two-pager: the file becomes two A4 pages, not a slide per slide. */
const PIECE_DETAILS: Record<FileUse, string> = {
  reinterpret: "A two-pager in a new structure. Facts and figures kept.",
  replicate: "Rebuilt as a two-pager on the brand, every text and figure kept.",
  source: "Only what your brief asks for.",
};
export function fileUseQuestion(contentSlides: number, unit: "slides" | "pages" = "slides", twoPager = false): SheetQuestion {
  const keys = Object.keys(USE_OPTIONS) as FileUse[];
  return {
    id: USE_QUESTION_ID,
    question: twoPager ? "What should the two-pager do with this file?" : "What should the deck do with this file?",
    why: "",
    kind: "single",
    options: keys.map((k) => USE_OPTIONS[k].label),
    details: keys.map((k) => (twoPager ? PIECE_DETAILS[k] : USE_OPTIONS[k].detail(contentSlides, unit))),
  };
}
/** The use chosen for a file; unanswered is the preselected "reinterpret", deselected is "source". */
export function fileUseOf(answers: SheetAnswers | undefined): FileUse {
  const a = answers?.[USE_QUESTION_ID];
  if (a === undefined) return "reinterpret";
  const text = typeof a === "string" ? a : "";
  return text.startsWith("Replicate") ? "replicate" : text.startsWith("Reinterpret") ? "reinterpret" : "source";
}

/**
 * A file with the use question gets its preselected answer (Reinterpret),
 * compiled into its insights, the moment the question is added: the model
 * reads what the dialog shows as chosen, even when the user never touches it.
 */
export function preselectFileUse<T extends { analysis?: SheetAnalysis; answers?: SheetAnswers; insights?: string }>(x: T): T {
  if (!x.analysis?.questions.some((q) => q.id === USE_QUESTION_ID) || x.answers?.[USE_QUESTION_ID] !== undefined) return x;
  const answers = { ...(x.answers ?? {}), [USE_QUESTION_ID]: DEFAULT_FILE_USE };
  return { ...x, answers, insights: compileInsights(x.analysis, answers) };
}

/** A question's content words, for telling two wordings of one question apart. */
const questionWords = (q: string) =>
  new Set(
    q
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3 && !/^(which|what|should|would|could|does|deck|slides?|before|after|with|from|that|this|these|those|your|their|present|cover|show|include|make|request|need|use|feature|highlight)$/.test(w)),
  );
/**
 * True when a question was already asked about a file, in other words. The
 * brief's questions are read at the same press as the files', so they cannot
 * see the file's answers: "Which three fixes should the Ministry make before
 * the next upload?" came right after the sheet's "Which three Ministry fixes
 * should the deck request…?" had been answered (18 Oct 2026).
 */
export function askedAlready(question: string, asked: string[]): boolean {
  const a = questionWords(question);
  if (a.size < 2) return false;
  return asked.some((other) => {
    const b = questionWords(other);
    const shared = [...a].filter((w) => b.has(w)).length;
    // Most of the shorter question's words in the other: "Which three Ministry fixes should the deck present?" and "Which Ministry fixes should the deck cover?".
    return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.6;
  });
}

export function compileInsights(analysis: SheetAnalysis, answers: SheetAnswers): string {
  const lines: string[] = [];
  // Only a file has a use: a brief's answers once carried "Reinterpret this
  // file" too, with no file in sight (12 Oct 2026).
  if (analysis.questions.some((q) => q.id === USE_QUESTION_ID) && fileUseOf(answers) === "reinterpret") {
    lines.push("Reinterpret this file: tell its story in a new structure of your choosing, keeping its facts and figures.");
  }
  for (const q of analysis.questions) {
    if (q.id === USE_QUESTION_ID) continue;
    const a = answers[q.id];
    const text = Array.isArray(a) ? a.filter(Boolean).join(", ") : (a ?? "").trim();
    // Missing material skipped is a placeholder too: left to the model it was
    // filled with "No issues were identified." (13 Oct 2026). But only for
    // what the brief leaves out: a doubt raised about an outline item that
    // already lists its contents ("Q1 data refresh, Q2 cost model update…"),
    // skipped, turned all four quarters into "[Q1 activities and timing]"
    // and the answered comparison table into "[Main blocker]" (18 Oct 2026).
    if (!text && !q.placeholder) continue;
    if (!text || text === PLACEHOLDER_ANSWER) {
      lines.push(
        `${q.question} No answer beyond the brief: first take every value the brief and the files give for it, wherever they give it (a count, a stage or a date stated on another slide of the outline goes in its cell), word for word; only what none of them gives is a placeholder in square brackets that names what goes there (for example "[Total budget 2027]" or "[Decision 1]"), to be filled in by hand; never invent it.`,
      );
      continue;
    }
    // A slot's answer is labelled, so the pipeline can read it back (slotsFromNotes).
    const label = SLOT_LABELS[q.id as BriefSlot];
    lines.push(label ? `${label} ${text.replace(/\.$/, "")}.` : `${q.question} Answer: ${text.replace(/\.$/, "")}. Use it as given, never a placeholder in its place.`);
  }
  // One answer per line: run together, five placeholder notes drowned the one
  // real answer between them.
  return lines.join("\n");
}

/** How many of the questions carry an answer. */
export function answeredCount(analysis: SheetAnalysis, answers: SheetAnswers): number {
  return analysis.questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : !!(a ?? "").trim();
  }).length;
}

/**
 * The deck's length, asked in the questions dialog when the brief names none
 * (Mario, 1 Oct 2026: most briefs give no number, and the deck came out at
 * whatever length the model chose). The last step before Generate; skipped
 * for a two-pager and a replica, which keep their own length. Skip or "Let
 * the builder decide" leave the length to the model, as before.
 */
export const LENGTH_QUESTION_ID = "deck-length";
// Auto, two lengths and a number of your own (Mario, 6 Oct 2026).
export const LENGTH_DECIDE = "Auto";
const LENGTHS: [number, string][] = [
  [12, "A full presentation or a proposal"],
  [20, "A long report or a workshop"],
];
const lengthAnalysis: SheetAnalysis = {
  summary: "Your brief doesn't say how long the deck should be.",
  questions: [
    {
      id: LENGTH_QUESTION_ID,
      question: "How many slides should the deck have?",
      why: "The cover counts; the closing slide comes on top. You can add or remove slides afterwards.",
      kind: "single",
      options: [LENGTH_DECIDE, ...LENGTHS.map(([n]) => `${n} slides`)],
      details: ["Sized to what the brief and the material need", ...LENGTHS.map(([, d]) => d)],
      custom: { label: "Custom", unit: "slides", min: 3, max: MAX_SLIDES, detail: `Any length up to ${MAX_SLIDES} slides` },
    },
  ],
};
/** The count picked in the length question, or undefined for "decide" and no answer. */
export function lengthOf(answers: SheetAnswers | undefined): number | undefined {
  const a = answers?.[LENGTH_QUESTION_ID];
  const n = typeof a === "string" ? parseInt(a, 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The length question as the user sees it: with Chapters on, a length under
 * MIN_SLIDES_WITH_CHAPTERS (brief.ts) says it leaves the chapters out, since
 * runGenerate drops them there (no room for an agenda and dividers).
 */
export function lengthAnalysisFor(chapters: boolean): SheetAnalysis {
  if (!chapters) return lengthAnalysis;
  const q = lengthAnalysis.questions[0];
  return {
    ...lengthAnalysis,
    questions: [{ ...q, details: q.details?.map((d, i) => (parseInt(q.options[i], 10) < MIN_SLIDES_WITH_CHAPTERS ? `${d}. Too short for chapters: they'll be left out` : d)) }],
  };
}

/**
 * A brief that talks about a file nobody attached (Mario, 5 Oct 2026): the
 * model then wrote a whole deck about the missing source ("No source file
 * provided", "Results cannot be quantified"). Before generating, the
 * questions dialog asks first: attach it, or generate without it. English,
 * Italian, Spanish and French wordings; a link in the brief is a source too.
 */
const MENTIONS_FILE =
  /\b(attached|attachment|enclosed|source (file|document|deck)|(the|this|my|our) (file|pdf|pptx|powerpoint|spreadsheet|excel|workbook|report attached)|uploaded|allegat[oaie]|in allegato|(il|questo|nel) (file|pdf|documento allegato)|file sorgente|adjunt[oa]s?|el archivo|ci-joint|pi[eè]ce jointe|le fichier)\b/i;
export function mentionsMissingFile(brief: string): boolean {
  return MENTIONS_FILE.test(brief) && !/https?:\/\//i.test(brief);
}
/**
 * A brief that asks the builder to research on its own ("search the web",
 * "cerca su internet", "do your own analysis"). The builder never does
 * (Mario, 14 Oct 2026): the user chooses the sources, so every fact has one
 * they know. The wizard says so, in the app's words, and asks for the links.
 */
const ASKS_RESEARCH =
  /\b(search (?:the )?(?:web|internet|online)|(?:web|online|internet) (?:search|research)|look (?:it )?(?:up )?online|browse the web|do (?:your|some) (?:own )?research|research (?:it|this|online)|find the latest|your own analysis|cerca(?:re)? (?:su|in) (?:internet|rete|web|google)|ricerca (?:su|in) internet|fai (?:una|tu (?:la|una)) ricerca|analisi tua|tua analisi|fai (?:un'|una )?analisi (?:tua|autonoma)|busca(?:r)? en (?:internet|la web|google)|investiga en internet|cherche(?:r)? sur (?:internet|le web))\b/i;
export function asksForResearch(brief: string): boolean {
  return ASKS_RESEARCH.test(brief) && !/https?:\/\//i.test(brief);
}
export const RESEARCH_QUESTION_ID = "research";
export const ADD_LINKS = "Add links to the brief";
export const researchAnalysis: SheetAnalysis = {
  summary: "Your brief asks for research. The builder does not search the web on its own: you choose the sources, so you keep control of where every fact comes from.",
  questions: [
    {
      id: RESEARCH_QUESTION_ID,
      question: "Paste the links of the pages to draw on in your brief?",
      why: "",
      kind: "single",
      options: [ADD_LINKS, "Go on without links"],
      details: ["Puts the cursor at the end of the brief, on a new line for the links", "The deck uses the brief, your answers and Giga's own facts only"],
    },
  ],
};

export const MISSING_FILE_QUESTION_ID = "missing-file";
export const ATTACH_IT = "Attach the file";
export const missingFileAnalysis: SheetAnalysis = {
  summary: "Your brief mentions a file, but nothing is attached.",
  questions: [
    {
      id: MISSING_FILE_QUESTION_ID,
      question: "Do you want to attach it first?",
      why: "Without it, the deck can only use what the brief says.",
      kind: "single",
      options: [ATTACH_IT, "Generate without it"],
      details: ["Opens the file picker; press Generate again once it's in", "The deck is written from the brief alone"],
    },
  ],
};
