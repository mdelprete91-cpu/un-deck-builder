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
 * from two up to the route's ceiling of twenty. One is not here on purpose:
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
};

/**
 * The slide count named in the brief ("a 20-page deck", "in 6 slides", "Six
 * slides", "10 diapositive"), clamped to the route's 1-20. Undefined when the
 * brief names none, and then the model chooses the length. Sent as `count` so
 * the prompt can demand it exactly and the route can budget output tokens for
 * it: left as prose, the model anchored on its own "typically 8-14" and the
 * budget for 20 slides truncated the deck around slide 12 (22 Sep 2026).
 *
 * "One slide per objective" is a structure, not a length, so a count followed
 * by per / each / ogni is passed over and the search goes on. A count under
 * two ("1 slide on X") is no count either: the model chooses the length.
 */
export function countFromBrief(brief: string): number | undefined {
  const words = Object.keys(NUMBER_WORDS).join("|");
  const re = new RegExp(
    `\\b(\\d{1,2}|${words})\\s*(?:-\\s*)?(?:slides?|pages?|pagine|pagina|diapositives?|diapositiva|diapositivas?|diapos?|transparencias?|páginas?|folien|seiten)\\b(?!\\s+(?:per|each|for each|for every|a|ogni|per ogni)\\b)`,
    "gi",
  );
  const m = re.exec(brief);
  if (!m) return undefined;
  const n = /^\d/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1].toLowerCase()];
  if (!n || n < 2) return undefined;
  return Math.min(20, n);
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
