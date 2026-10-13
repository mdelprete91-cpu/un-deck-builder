/**
 * What the brief says about the deck's shape, read before the model sees
 * it: how many slides, whether it is one slide per item, whether the
 * partnership-tier table was asked for. Pure functions so the QA suite
 * (tools/qa-suite.ts) runs the same reading the editor does.
 */

/**
 * What counts as asking for the partnership-tier slides: the tier table, the
 * partnership tiers, the sponsorship levels. Never the word "tier" on its own.
 */
export const TIERS_REQUEST =
  /\b(?:partner(?:ship)?|sponsor(?:ship)?|membership|funding|support)\s+tiers?\b|\btiers?\s+(?:table|slides?|grid|overview)\b|\blivelli\s+di\s+(?:partnership|partenariato|sponsorizzazione|adesione)\b|\btabella\s+(?:dei\s+)?livelli\b/i;

/**
 * Below this a named count cannot hold chapters: cover, agenda, two dividers,
 * two content slides and the closing slide are eight already. Such a deck is
 * generated without them, whatever the toggle says, and the sidebar says so.
 */
export const MIN_SLIDES_WITH_CHAPTERS = 8;

/**
 * Number words the brief may use instead of a digit ("Six slides" went
 * unread on 22 Sep 2026 and the model chose fourteen). English and Italian,
 * from two up to `MAX_SLIDES`. One is not here on purpose:
 * "uno slide deck per UNICEF" and "one slide deck for the board" are
 * articles, and read as a count of one they produced a cover and a closing
 * slide and nothing else (23 Sep 2026). A deck of one slide does not exist.
 */
const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
  due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
  diciassette: 17, diciotto: 18, diciannove: 19, venti: 20,
  // Spanish and French (26 Sep 2026: "Douze diapositives" was read as no count).
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11,
  douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, "dix-sept": 17, "dix-huit": 18,
  "dix-neuf": 19, vingt: 20,
  // Tens past twenty (28 Sep 2026, when the ceiling went to forty); other
  // counts past twenty are written in digits in practice.
  thirty: 30, forty: 40, trenta: 30, quaranta: 40, treinta: 30, cuarenta: 40, trente: 30, quarante: 40,
};

/**
 * The longest deck the route writes (Mario, 28 Sep 2026: a 38-slide
 * investment case to rebuild with all its text; twenty was the ceiling
 * before). The route budgets tokens and time for it.
 */
export const MAX_SLIDES = 40;

/**
 * The slide count named in the brief ("a 20-page deck", "in 6 slides", "Six
 * slides", "10 diapositive"), clamped to `MAX_SLIDES`. Undefined when the
 * brief names none, and then the model chooses the length. Sent as `count` so
 * the prompt can demand it exactly and the route can budget output tokens for
 * it: left as prose, the model anchored on its own "typically 8-14" and the
 * budget for 20 slides truncated the deck around slide 12 (22 Sep 2026).
 *
 * "One slide per objective" is a structure, not a length, so a count followed
 * by per / each / ogni is passed over and the search goes on. A count under
 * two ("1 slide on X") is no count either: the model chooses the length.
 */
function countMatch(brief: string): RegExpExecArray | null {
  const words = Object.keys(NUMBER_WORDS).join("|");
  const re = new RegExp(
    `\\b(\\d{1,2}|${words})\\s*(?:-\\s*)?(?:slides?|pages?|pagine|pagina|diapositives?|diapositiva|diapositivas?|diapos?|transparencias?|páginas?|folien|seiten)\\b(?!\\s+(?:per|each|for each|for every|a|ogni|per ogni)\\b)`,
    "gi",
  );
  return re.exec(brief);
}

export function countFromBrief(brief: string): number | undefined {
  const m = countMatch(brief);
  if (!m) return undefined;
  const n = /^\d/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1].toLowerCase()];
  if (!n || n < 2) return undefined;
  return Math.min(MAX_SLIDES, n);
}

/**
 * "One slide per objective", "a slide for each country", "una slide per ogni
 * paese": the brief prescribes a series. Sent as `perItem` so the prompt can
 * read a named count as the number of items rather than as a ceiling on the
 * deck (Haiku obeyed "exactly 6" and dropped two objectives, 22 Sep 2026).
 */
export function seriesFromBrief(brief: string): boolean {
  return /\b(?:one|a|1|una?)\s+(?:slides?|pages?|pagina|diapositiva|folie|seite)\s+(?:per|for each|for every|each|a|ogni|per ogni)\b/i.test(brief);
}


/**
 * The brief's language, when it is plainly not English. "Write in the same
 * language as the brief" was ignored on short Italian briefs (two of two on
 * 23 Sep 2026: "creami uno slide deck per unicef" came back in English), so
 * the user turn names the language instead. Stopword counts, nothing
 * cleverer: a language wins when it beats English and has two hits.
 */
const STOPWORDS: Record<string, RegExp> = {
  English: /\b(the|and|of|for|with|to|about|on)\b/gi,
  Italian: /\b(il|lo|la|gli|le|di|del|della|dei|delle|degli|per|con|una|uno|che|sul|sulla|sui|sulle|nel|nella|al|alla|dal|dalla|e|ed|creami|fammi|crea|genera|presentazione|diapositive|obiettivi|numeri|prossimi|passi|risultati|progetto|programma)\b/gi,
  Spanish: /\b(el|los|las|de|del|para|con|una|que|y|sobre|crea|presentación|diapositivas)\b/gi,
  French: /\b(le|la|les|des|du|pour|avec|une|sur|et|que|diapositives|présentation)\b/gi,
  Portuguese: /\b(o|os|as|do|da|dos|das|para|com|uma|que|sobre|apresentação)\b/gi,
  German: /\b(der|die|das|und|für|mit|eine|über|zu|folien|präsentation)\b/gi,
};

export function languageOf(brief: string): string | undefined {
  const counts = Object.entries(STOPWORDS).map(([lang, re]) => [lang, (brief.match(re) ?? []).length] as const);
  const english = counts.find(([l]) => l === "English")![1];
  const best = counts.filter(([l]) => l !== "English").sort((a, b) => b[1] - a[1])[0];
  if (!best) return undefined;
  // Two hits and more than English, or one hit with no English at all
  // ("Dieci slide sul programma Giga in Brasile" has one stopword and no
  // English ones).
  return (best[1] >= 2 && best[1] > english) || (best[1] >= 1 && english === 0) ? best[0] : undefined;
}

/**
 * "Same layout for all", "stesso layout": the brief wants the series
 * uniform, so the rhythm pass leaves the model's layout alone (23 Sep 2026,
 * when the pass alternated a series the brief had asked to keep uniform).
 */
export function uniformFromBrief(brief: string): boolean {
  return /\b(?:same|identical|one)\s+layout\b|\bstesso\s+layout\b|\blayout\s+(?:uguale|identico)\b/i.test(brief);
}

/**
 * True when the brief's number is a ceiling, not a length: "8 slides max",
 * "at most 10 slides", "fino a 12 slide". The closing slide then stays inside
 * the number (A5, 13 Oct 2026: "8 slides max" and "end with a clear ask" came
 * back as nine).
 */
export function countIsCeiling(brief: string): boolean {
  const m = countMatch(brief);
  if (!m) return false;
  const before = brief.slice(Math.max(0, m.index - 30), m.index);
  const after = brief.slice(m.index + m[0].length, m.index + m[0].length + 20);
  return (
    /\b(?:max(?:imum)?|at most|no more than|not more than|up to|massimo|al massimo|fino a|non più di|como m[aá]ximo|hasta|au plus|maximum)\s*$/i.test(before) ||
    /^\s*(?:max(?:imum)?|at most|tops|al massimo|massimo|como m[aá]ximo|maximum)\b/i.test(after)
  );
}

/** A numbered outline line: "12. Decisions needed from this meeting". */
const OUTLINE_LINE = /^\s*(\d{1,2})[.)]\s+(.+?)\s*$/gm;
/** What closes a deck, as opposed to a last slide of content. */
const CLOSING_ITEM = /\b(thanks?|thank you|grazie|gracias|merci|contacts?|contatti|contactos)\b/i;
/** The brief naming its last slide: "a final slide with 3 questions", "end with a clear ask", "chiudi con le richieste". */
const LAST_SLIDE = [
  /\b(?:a |the )?(?:final|last|closing|concluding) slide (?:with|on|for|about|that|listing|of)\s+([^.\n]+)/i,
  /\bends? (?:it |the deck |the presentation )?(?:with|on)\s+([^.\n]+)/i,
  /\b(?:ultima|l'ultima) slide (?:con|su|per|sulle|sui|sulla)\s+([^.\n]+)/i,
  /\b(?:chiudi|chiudere|termina|terminare|finisci) con\s+([^.\n]+)/i,
  /\b[úu]ltima diapositiva (?:con|sobre|para)\s+([^.\n]+)/i,
  /\b(?:termina|terminar|cierra|cerrar) con\s+([^.\n]+)/i,
];

/**
 * The last content slide the brief prescribes, in its own words, or null:
 * "add a final slide with 3 questions" → "3 questions"; a numbered outline as
 * long as the named count whose last item is not a closing → that item. The
 * evaluation of 12 Oct 2026: "12. Decisions needed from this meeting" and "a
 * final slide with 3 questions" both came back as "Thanks", because the
 * count held the closing slide and the cap cut the slide before it.
 */
export function lastSlideFromBrief(brief: string, count: number | undefined): string | null {
  // A brief can hold several numbered lists (a proposal in four points,
  // then the twelve-slide outline): each run starts again at 1.
  const runs: { n: number; text: string }[][] = [];
  for (const m of brief.matchAll(OUTLINE_LINE)) {
    const it = { n: Number(m[1]), text: m[2] };
    if (it.n === 1 || !runs.length) runs.push([it]);
    else runs[runs.length - 1].push(it);
  }
  const outline = runs.find((r) => count !== undefined && r.length >= 2 && r.length === count && r.every((it, i) => it.n === i + 1));
  if (outline) {
    const last = outline[outline.length - 1].text;
    if (!CLOSING_ITEM.test(last)) return last;
  }
  for (const re of LAST_SLIDE) {
    const m = re.exec(brief);
    if (m && !CLOSING_ITEM.test(m[1])) return m[1].trim().replace(/[,;:]$/, "");
  }
  return null;
}

/** "12 slides", "20-page": a length, not material. */
const SLIDE_COUNT = /\b\d{1,2}\s*(?:-\s*)?(?:slides?|pages?|diapositiv\w*|pagine)\b/gi;
/** Under this the brief gives little to build on: the knowledge base may fill the gaps (lib/slides/kb.ts). */
export const SCARCE_MATERIAL = 30;

/**
 * How much material the deck has to work with (Mario, 13 Oct 2026): the
 * brief's meaningful words past its length, three points a figure it gives,
 * the attached text (a hundredth of its characters, sixty at most) and six
 * points an answered question. Measured on the QA briefs: thin-ministry 7,
 * count-giga 5, with its answers 25; long-prose 207, an attached sheet 70.
 */
export function materialScore(brief: string, opts: { attachedChars?: number; answered?: number } = {}): number {
  const text = brief.replace(SLIDE_COUNT, " ");
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !/^\d/.test(w) && !BRIEF_STOP.has(w)).length;
  const figures = (text.match(/\d[\d,.]*\s*%?/g) ?? []).length;
  return words + 3 * figures + Math.min(60, Math.round((opts.attachedChars ?? 0) / 100)) + 6 * (opts.answered ?? 0);
}
const BRIEF_STOP = new Set("the and for with that this from into about our your their are was were will have has can a an of to in on by as at is it be or di del della per con che una uno dei delle sul sulla los las para con por que una".split(" "));

/**
 * The slides a numbered outline prescribes ("2. Current architecture … 12.
 * Decisions needed"), read from the brief itself: the outline as long as the
 * named count, or, with no count, any outline of three items or more. Cover
 * and closing items are left out. This is the part of the brief's contract
 * that brought quality, without the side call to the model it cost (Mario,
 * 13 Oct 2026: same cost as production, quality kept).
 */
export function outlineFromBrief(brief: string, count: number | undefined): { order: number; title: string }[] {
  const runs: { n: number; text: string }[][] = [];
  for (const m of brief.matchAll(OUTLINE_LINE)) {
    const it = { n: Number(m[1]), text: m[2] };
    if (it.n === 1 || !runs.length) runs.push([it]);
    else runs[runs.length - 1].push(it);
  }
  const ok = (r: { n: number }[]) => r.every((it, i) => it.n === i + 1);
  const outline = runs.find((r) => ok(r) && (count !== undefined ? r.length === count : r.length >= 3));
  if (!outline) return [];
  return outline
    .filter((it) => !/^(title|cover|title slide|thanks?|thank you|contacts?|q ?& ?a|questions?)$/i.test(it.text.replace(/\s*\(.*\)\s*$/, "").trim()))
    .map((it) => ({ order: it.n, title: it.text.replace(/\s*\(.*\)\s*$/, "").trim() }));
}
