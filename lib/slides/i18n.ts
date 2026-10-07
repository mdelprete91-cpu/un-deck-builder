import type { Slide, SlideContent } from "./schema";

/**
 * The deck's language (Mario, 6 Oct 2026): the whole piece switches between
 * English, Spanish, French and Portuguese, and a word Mario fixes by hand in
 * one language is never lost, whatever he switches to and back.
 *
 * `state.slides` always holds the language on screen, so rendering, editing,
 * exports and the fit pass do not know about languages at all. Beside it the
 * deck keeps a memory of every language's text, field by field (the paths
 * `setPath` writes), and a glossary of Mario's fixes per language, which goes
 * into every translation into that language.
 */

/**
 * The 30 most spoken languages, plus Italian (Mario, 6 Oct 2026), each as
 * [code, its own name, its English name]. Order: by number of speakers,
 * Italian last. The model translates into all of them; the self-hosted
 * Manrope and Open Sans cover Latin scripts only, so the others are drawn
 * in the system's font, and right-to-left languages keep the template's
 * left-to-right layout.
 */
const LANGUAGES = [
  ["en", "English", "English"],
  ["zh", "中文", "Chinese (Simplified)"],
  ["hi", "हिन्दी", "Hindi"],
  ["es", "Español", "Spanish"],
  ["ar", "العربية", "Arabic"],
  ["fr", "Français", "French"],
  ["bn", "বাংলা", "Bengali"],
  ["pt", "Português", "Portuguese"],
  ["ru", "Русский", "Russian"],
  ["id", "Bahasa Indonesia", "Indonesian"],
  ["ur", "اردو", "Urdu"],
  ["de", "Deutsch", "German"],
  ["ja", "日本語", "Japanese"],
  ["pcm", "Naijá", "Nigerian Pidgin"],
  ["mr", "मराठी", "Marathi"],
  ["vi", "Tiếng Việt", "Vietnamese"],
  ["te", "తెలుగు", "Telugu"],
  ["ha", "Hausa", "Hausa"],
  ["tr", "Türkçe", "Turkish"],
  ["pa", "ਪੰਜਾਬੀ", "Punjabi"],
  ["sw", "Kiswahili", "Swahili"],
  ["fil", "Filipino", "Filipino"],
  ["ta", "தமிழ்", "Tamil"],
  ["fa", "فارسی", "Persian"],
  ["ko", "한국어", "Korean"],
  ["th", "ไทย", "Thai"],
  ["jv", "Basa Jawa", "Javanese"],
  ["gu", "ગુજરાતી", "Gujarati"],
  ["am", "አማርኛ", "Amharic"],
  ["yo", "Yorùbá", "Yoruba"],
  ["it", "Italiano", "Italian"],
] as const;

export type Lang = (typeof LANGUAGES)[number][0];
export const LANGS: Lang[] = LANGUAGES.map((l) => l[0]);
/** The language by its own name, for the menu ("Español"). */
export const LANG_LABELS = Object.fromEntries(LANGUAGES.map(([c, own]) => [c, own])) as Record<Lang, string>;
/** The language by its English name, for the prompts and the menu's search. */
export const LANG_NAMES = Object.fromEntries(LANGUAGES.map(([c, , en]) => [c, en])) as Record<Lang, string>;
/** Written right to left. */
export const RTL_LANGS = new Set<Lang>(["ar", "ur", "fa"]);

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && x in LANG_LABELS;
}

/**
 * A text's language: by its script first (Han, kana, Hangul, Arabic,
 * Devanagari, Cyrillic…, which languageOf's stopwords cannot see), then by
 * languageOf's answer for Latin text. Arabic script is read as Arabic and
 * Devanagari as Hindi: Urdu, Persian and Marathi are told apart only by the
 * user's choice in the menu.
 */
export function detectLang(text: string, latin: string | undefined): Lang {
  const counts: [Lang, RegExp][] = [
    ["ja", /[\u3040-\u30ff]/g],
    ["ko", /[\uac00-\ud7af]/g],
    ["zh", /[\u4e00-\u9fff]/g],
    ["ar", /[\u0600-\u06ff]/g],
    ["hi", /[\u0900-\u097f]/g],
    ["bn", /[\u0980-\u09ff]/g],
    ["pa", /[\u0a00-\u0a7f]/g],
    ["gu", /[\u0a80-\u0aff]/g],
    ["ta", /[\u0b80-\u0bff]/g],
    ["te", /[\u0c00-\u0c7f]/g],
    ["th", /[\u0e00-\u0e7f]/g],
    ["am", /[\u1200-\u137f]/g],
    ["ru", /[\u0400-\u04ff]/g],
  ];
  const letters = (text.match(/\p{L}/gu) ?? []).length || 1;
  // Kana anywhere means Japanese, even when most characters are kanji.
  for (const [lang, re] of counts) {
    const n = (text.match(re) ?? []).length;
    if (lang === "ja" ? n > 0 : n / letters > 0.3) return lang;
  }
  return langFromName(latin);
}

/** languageOf's answer (an English name, undefined for English) as a code. */
export function langFromName(name: string | undefined): Lang {
  const hit = (Object.keys(LANG_NAMES) as Lang[]).find((k) => LANG_NAMES[k] === name);
  return hit ?? "en";
}

/** One field in one language. */
export interface Field {
  text: string;
  /** A translation: the source-language text it was made from. Stale when that text has changed. */
  basis?: string;
  /** Mario changed it by hand: kept as it is, and his wording guides a retranslation. */
  edited?: boolean;
  /** The translation as it came, before any edit: what "Use the translation" puts back. */
  machine?: string;
}

export interface DeckLang {
  /** The language the deck was written in: translations are made from it. */
  source: Lang;
  /** The language on screen. */
  current: Lang;
  /** language -> slide id -> path -> field */
  texts: Partial<Record<Lang, Record<string, Record<string, Field>>>>;
}

// ─── The text of a slide, field by field ───────────────────────────────────

const SINGLE = ["title", "subtitle", "stat", "support", "quote", "author", "body", "notes", "takeaway", "footerLabel", "pageDate"] as const;

/**
 * Every field of a slide that is words on the page, with its setPath path.
 * Not ids, layouts, images, icons, maps, colours, bar values, emails, links
 * or the tier grid's markers. Empty fields are left out.
 */
export function textFields(s: SlideContent): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const add = (path: string, text: unknown) => {
    // An email or a link is the same in every language.
    if (typeof text === "string" && text.trim() && /\p{L}/u.test(text) && !/^\S+@\S+$|^(https?:\/\/|www\.)\S+$/.test(text.trim())) out.push({ path, text });
  };
  for (const k of SINGLE) add(k, s[k]);
  s.bullets?.forEach((t, i) => add(`bullets.${i}`, t));
  s.series?.forEach((t, i) => add(`series.${i}`, t));
  s.blocks?.forEach((b, i) => {
    add(`blocks.${i}.label`, b.label);
    add(`blocks.${i}.body`, b.body);
    b.items?.forEach((t, j) => add(`blocks.${i}.items.${j}`, t));
    b.stats?.forEach((x, j) => {
      add(`blocks.${i}.stats.${j}.value`, x.value);
      add(`blocks.${i}.stats.${j}.label`, x.label);
    });
  });
  s.stats?.forEach((x, i) => {
    add(`stats.${i}.value`, x.value);
    add(`stats.${i}.label`, x.label);
  });
  s.bars?.forEach((b, i) => add(`bars.${i}.label`, b.label));
  s.contacts?.forEach((c, i) => {
    add(`contacts.${i}.name`, c.name);
    add(`contacts.${i}.role`, c.role);
    add(`contacts.${i}.location`, c.location);
  });
  s.channels?.forEach((c, i) => add(`channels.${i}.label`, c.label));
  // The tier grid: only cells that are words ("Once annually"), not the on/half markers.
  s.grid?.forEach((row, r) => row.forEach((cell, c) => cell && cell !== "on" && cell !== "half" && add(`grid.${r}.${c}`, cell)));
  s.stack?.forEach((b, i) => {
    for (const k of ["rail", "heading", "highlight", "sub", "lead", "body"] as const) add(`stack.${i}.${k}`, b[k]);
    b.items?.forEach((it, j) => {
      add(`stack.${i}.items.${j}.label`, it.label);
      add(`stack.${i}.items.${j}.body`, it.body);
      add(`stack.${i}.items.${j}.extra`, it.extra);
      add(`stack.${i}.items.${j}.group`, it.group);
      it.cells?.forEach((c, k) => add(`stack.${i}.items.${j}.cells.${k}`, c));
    });
    b.heads?.forEach((h, k) => add(`stack.${i}.heads.${k}`, h));
  });
  return out;
}

/** Write a dotted path inside a (cloned) slide, as setPath does, in place. */
function writePath(slide: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split(".");
  let node: unknown = slide;
  for (let i = 0; i < keys.length - 1; i++) {
    node = Array.isArray(node) ? node[Number(keys[i])] : (node as Record<string, unknown>)?.[keys[i]];
    if (node == null) return;
  }
  const last = keys[keys.length - 1];
  if (Array.isArray(node)) node[Number(last)] = value;
  else (node as Record<string, unknown>)[last] = value;
}

// ─── The memory ────────────────────────────────────────────────────────────

/**
 * A slide's shape: how many points, blocks, cards, rows it has, not what they
 * say. Paths are positions ("bullets.2"), so a point deleted in Spanish would
 * shift every English text after it onto the wrong point: a slide whose
 * shape changed since a language was remembered is translated afresh from
 * what is on screen.
 */
export function shapeOf(s: SlideContent): string {
  const n = (a?: unknown[]) => a?.length ?? 0;
  return [
    s.layoutId,
    n(s.bullets),
    n(s.series),
    (s.blocks ?? []).map((b) => `${n(b.items)}/${n(b.stats)}`).join(","),
    n(s.stats),
    n(s.bars),
    n(s.contacts),
    n(s.channels),
    (s.grid ?? []).map((r) => r.length).join(","),
    (s.stack ?? []).map((b) => `${b.type}:${n(b.items)}`).join(","),
  ].join("|");
}

/** Where a slide's shape is kept beside its fields. No text path starts with "#". */
const SHAPE = "#shape";

/**
 * The text on screen, written into the memory of the language on screen. A
 * translated field whose text is not what the memory holds was changed by
 * hand: it is marked edited, and keeps the basis it was translated from.
 */
export function snapshot(slides: Slide[], lang: DeckLang): DeckLang["texts"] {
  const texts = structuredClone(lang.texts);
  const cur = lang.current;
  const mem = (texts[cur] ??= {});
  for (const s of slides) {
    // A slide whose shape changed starts a fresh memory for this language.
    if (mem[s.id]?.[SHAPE]?.text !== shapeOf(s)) mem[s.id] = {};
    const fields = mem[s.id];
    fields[SHAPE] = { text: shapeOf(s) };
    for (const { path, text } of textFields(s)) {
      const was = fields[path];
      if (cur === lang.source) fields[path] = { text };
      else {
        // Edited means different from the translation as it came: a text put back is a translation again.
        const machine = was?.machine ?? was?.text;
        fields[path] = { text, basis: was?.basis, edited: machine !== undefined && text !== machine, ...(machine !== undefined ? { machine } : {}) };
      }
    }
  }
  return texts;
}

/** A field that has to be translated for a switch. */
export interface Job {
  slide: string;
  path: string;
  /** The text to translate and its language. */
  text: string;
  from: Lang;
  /** Mario's own earlier wording in the target language, when the source changed under it. */
  previous?: string;
}

/**
 * What a switch to `to` needs: the fields the memory already has in that
 * language (kept as they are, fixes included), and the jobs for the rest
 * (new fields, and fields whose source text changed since they were
 * translated).
 */
export function plan(slides: Slide[], lang: DeckLang, texts: DeckLang["texts"], to: Lang): { ready: Map<string, string>; jobs: Job[] } {
  const ready = new Map<string, string>();
  const jobs: Job[] = [];
  const src = texts[lang.source] ?? {};
  const target = texts[to] ?? {};
  for (const s of slides) {
    const shape = shapeOf(s);
    const srcFields = src[s.id]?.[SHAPE]?.text === shape ? src[s.id] : undefined;
    const haveFields = target[s.id]?.[SHAPE]?.text === shape ? target[s.id] : undefined;
    for (const { path, text } of textFields(s)) {
      const key = `${s.id}\u0000${path}`;
      const source = srcFields?.[path];
      const have = haveFields?.[path];
      if (to === lang.source) {
        if (source) ready.set(key, source.text);
        // A field written in another language (a point added in Spanish): into the source.
        else jobs.push({ slide: s.id, path, text, from: lang.current });
        continue;
      }
      if (have && (!source || have.basis === source.text)) {
        ready.set(key, have.text);
        continue;
      }
      jobs.push({
        slide: s.id,
        path,
        text: source?.text ?? text,
        from: source ? lang.source : lang.current,
        previous: have?.edited ? have.text : undefined,
      });
    }
  }
  return { ready, jobs };
}

/**
 * The deck in `to`: every field from the ready texts or the translations.
 * A page title's accent phrase must still be inside its heading, or it goes.
 */
export function apply(slides: Slide[], ready: Map<string, string>, translated: Map<string, string>): Slide[] {
  return slides.map((s) => {
    const clone = structuredClone(s) as unknown as Record<string, unknown>;
    for (const { path } of textFields(s)) {
      const key = `${s.id}\u0000${path}`;
      const text = translated.get(key) ?? ready.get(key);
      if (text !== undefined) writePath(clone, path, text);
    }
    const out = clone as unknown as Slide;
    out.stack?.forEach((b) => {
      if (b.highlight && !(b.heading ?? "").includes(b.highlight)) b.highlight = "";
    });
    return out;
  });
}

/** The memory after a switch: what was translated, written into the target language with its basis. */
export function remember(
  slides: Slide[],
  texts: DeckLang["texts"],
  lang: DeckLang,
  to: Lang,
  jobs: Job[],
  translated: Map<string, string>,
): DeckLang["texts"] {
  const out = structuredClone(texts);
  const mem = (out[to] ??= {});
  const src = (out[lang.source] ??= {});
  // Every slide's memory in this language is for its present shape.
  for (const s of slides) {
    if (mem[s.id]?.[SHAPE]?.text !== shapeOf(s)) mem[s.id] = { [SHAPE]: { text: shapeOf(s) } };
  }
  for (const j of jobs) {
    const text = translated.get(`${j.slide}\u0000${j.path}`);
    if (text === undefined) continue;
    const fields = (mem[j.slide] ??= {});
    if (to === lang.source) {
      fields[j.path] = { text };
    } else {
      // A field born in another language gets its source text too, so the next switch has a basis.
      const basis = src[j.slide]?.[j.path]?.text;
      fields[j.path] = { text, basis, machine: text };
    }
  }
  return out;
}

/**
 * The texts changed by hand in the language on screen since it was last
 * shown: on screen, different from what the memory holds and from the
 * translation as it came. What the switch asks about before it leaves the
 * language (components/EditChoice.tsx). Edits already kept are not asked
 * again: the memory holds them.
 */
export function newEdits(slides: Slide[], lang: DeckLang | undefined): { slide: string; path: string; text: string; translation: string }[] {
  if (!lang || lang.current === lang.source) return [];
  const mem = lang.texts[lang.current] ?? {};
  const out: { slide: string; path: string; text: string; translation: string }[] = [];
  for (const s of slides) {
    for (const { path, text } of textFields(s)) {
      const f = mem[s.id]?.[path];
      if (!f) continue;
      const translation = f.machine ?? f.text;
      if (text !== f.text && text !== translation) out.push({ slide: s.id, path, text, translation });
    }
  }
  return out;
}

// ─── Names that are never translated ───────────────────────────────────────

/**
 * Divisions, products and initiatives, as written (Mario, 6 Oct 2026: "UNICEF
 * DID" is never translated). The model translated "Digital Impact Division"
 * every time it was asked not to, so the names never reach it: they go out
 * as placeholders and come back exactly as written (`protectNames`).
 * Case-sensitive on purpose: "digital inclusion" in a sentence is a phrase
 * to translate, "Digital Inclusion" the team.
 */
export const PROTECTED_NAMES = [
  "UNICEF Digital Impact Division",
  "UNICEF Digital Inclusion",
  "Digital Impact Division",
  "Digital Inclusion",
  "UNICEF DID",
  "UNICEF Supply Division",
  "Supply Division",
  "Global Procurement Facility",
  "Giga Technology Centre",
  "Giga Technology Center",
  "Connectivity Credits",
  "Giga Maps",
  "Giga Meter",
  "Giga",
  "UNICEF",
  "ITU",
  "Smart Africa",
  "AI Leap",
  "Team Europe",
];

const NAME_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${[...PROTECTED_NAMES].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`,
  "gu",
);

/** A text with its protected names swapped for ⟦1⟧, ⟦2⟧…, and the way back. */
export function protectNames(text: string): { text: string; restore: (out: string) => string } {
  const found: string[] = [];
  const masked = text.replace(NAME_RE, (name) => {
    let k = found.indexOf(name);
    if (k < 0) k = found.push(name) - 1;
    return `⟦${k + 1}⟧`;
  });
  return {
    text: masked,
    restore: (out) => out.replace(/⟦\s*(\d+)\s*⟧/g, (hit, n: string) => found[Number(n) - 1] ?? hit),
  };
}

// ─── Strings the renderers draw themselves ─────────────────────────────────

export interface UiStrings {
  done: string;
  inProgress: string;
  next: string;
  agenda: string;
  partners: string;
  thanks: string;
}

export const UI_STRINGS: Partial<Record<Lang, UiStrings>> = {
  en: { done: "Done", inProgress: "In progress", next: "Next", agenda: "Agenda", partners: "Our partners", thanks: "Thank you!" },
  es: { done: "Hecho", inProgress: "En curso", next: "Próximo", agenda: "Agenda", partners: "Nuestros socios", thanks: "¡Gracias!" },
  fr: { done: "Fait", inProgress: "En cours", next: "À venir", agenda: "Ordre du jour", partners: "Nos partenaires", thanks: "Merci !" },
  pt: { done: "Concluído", inProgress: "Em andamento", next: "Próximo", agenda: "Agenda", partners: "Nossos parceiros", thanks: "Obrigado!" },
  it: { done: "Fatto", inProgress: "In corso", next: "Prossimo", agenda: "Agenda", partners: "I nostri partner", thanks: "Grazie!" },
  de: { done: "Erledigt", inProgress: "Läuft", next: "Als Nächstes", agenda: "Agenda", partners: "Unsere Partner", thanks: "Danke!" },
};

/** The renderers' own words in a language; English where there is no entry (the deck's text is translated all the same). */
export function uiStrings(lang: Lang): UiStrings {
  return UI_STRINGS[lang] ?? UI_STRINGS.en!;
}

// ─── Saving ────────────────────────────────────────────────────────────────

const MAX_FIELD = 4000;

/**
 * A language memory read back from a session or a deck file: client input,
 * so only known languages, string fields of bounded length and paths of the
 * shape textFields writes survive. The text only ever reaches a slide
 * through setPath and the renderers' escaping, never as markup.
 */
export function sanitizeLang(raw: unknown): DeckLang | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (!isLang(r.source) || !isLang(r.current)) return undefined;
  const texts: DeckLang["texts"] = {};
  if (r.texts && typeof r.texts === "object") {
    for (const [l, bySlide] of Object.entries(r.texts as Record<string, unknown>)) {
      if (!isLang(l) || !bySlide || typeof bySlide !== "object") continue;
      const outL: Record<string, Record<string, Field>> = {};
      for (const [id, fields] of Object.entries(bySlide as Record<string, unknown>).slice(0, 400)) {
        if (!/^[\w-]{1,64}$/.test(id) || !fields || typeof fields !== "object") continue;
        const outF: Record<string, Field> = {};
        for (const [path, f] of Object.entries(fields as Record<string, unknown>).slice(0, 600)) {
          if (!/^(#shape|[a-zA-Z]+(\.\d+(\.[a-zA-Z]+)?(\.\d+)?(\.[a-zA-Z]+)?)?)$/.test(path)) continue;
          const v = f as Record<string, unknown>;
          if (!v || typeof v.text !== "string") continue;
          outF[path] = {
            text: v.text.slice(0, MAX_FIELD),
            ...(typeof v.basis === "string" ? { basis: v.basis.slice(0, MAX_FIELD) } : {}),
            ...(v.edited === true ? { edited: true } : {}),
            ...(typeof v.machine === "string" ? { machine: v.machine.slice(0, MAX_FIELD) } : {}),
          };
        }
        outL[id] = outF;
      }
      texts[l] = outL;
    }
  }
  // A `glossary` in a file saved on 6 Oct 2026 is ignored: the term rules come later, designed apart.
  return { source: r.source, current: r.current, texts };
}
