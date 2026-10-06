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

export const LANGS = ["en", "es", "fr", "pt"] as const;
export type Lang = (typeof LANGS)[number] | "it" | "de";

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  it: "Italiano",
  de: "Deutsch",
};

/** For the prompts: the language by its English name. */
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  it: "Italian",
  de: "German",
};

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && x in LANG_LABELS;
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
}

export interface Glossary {
  from: string;
  to: string;
}

export interface DeckLang {
  /** The language the deck was written in: translations are made from it. */
  source: Lang;
  /** The language on screen. */
  current: Lang;
  /** language -> slide id -> path -> field */
  texts: Partial<Record<Lang, Record<string, Record<string, Field>>>>;
  /** Mario's fixes per language, as term rules for every translation into it. */
  glossary: Partial<Record<Lang, Glossary[]>>;
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
    });
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
 * what is on screen (the glossary still brings the fixes back).
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
      else fields[path] = { text, basis: was?.basis, edited: was?.edited || (!!was && was.text !== text) };
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
      fields[j.path] = { text, basis };
    }
  }
  return out;
}

// ─── Fixes → glossary ──────────────────────────────────────────────────────

/**
 * The terms Mario replaced in a translated text: word runs swapped for
 * other words ("conectividad escolar" -> "conexión de escuelas"). Pure
 * insertions and deletions are edits, not terms; a run past six words is a
 * rewrite, not a term.
 */
export function diffTerms(before: string, after: string): Glossary[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  // Longest common subsequence of words, then the runs between matches.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = clean(a[i]) === clean(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Glossary[] = [];
  let i = 0;
  let j = 0;
  let ra: string[] = [];
  let rb: string[] = [];
  const flush = () => {
    if (ra.length && rb.length && ra.length <= 6 && rb.length <= 6) {
      const from = strip(ra.join(" "));
      const to = strip(rb.join(" "));
      if (from && to && from.toLowerCase() !== to.toLowerCase()) out.push({ from, to });
    }
    ra = [];
    rb = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && clean(a[i]) === clean(b[j])) {
      flush();
      i++;
      j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) rb.push(b[j++]);
    else ra.push(a[i++]);
  }
  flush();
  return out;
}

const clean = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");

/** Merge new rules into a language's glossary: a rule for the same term replaces the old one. */
export function addTerms(list: Glossary[] | undefined, terms: Glossary[]): Glossary[] {
  const out = [...(list ?? [])];
  for (const t of terms) {
    const k = out.findIndex((g) => g.from.toLowerCase() === t.from.toLowerCase());
    if (k >= 0) out[k] = t;
    else out.push(t);
  }
  return out.slice(-200);
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

export const UI_STRINGS: Record<Lang, UiStrings> = {
  en: { done: "Done", inProgress: "In progress", next: "Next", agenda: "Agenda", partners: "Our partners", thanks: "Thank you!" },
  es: { done: "Hecho", inProgress: "En curso", next: "Próximo", agenda: "Agenda", partners: "Nuestros socios", thanks: "¡Gracias!" },
  fr: { done: "Fait", inProgress: "En cours", next: "À venir", agenda: "Ordre du jour", partners: "Nos partenaires", thanks: "Merci !" },
  pt: { done: "Concluído", inProgress: "Em andamento", next: "Próximo", agenda: "Agenda", partners: "Nossos parceiros", thanks: "Obrigado!" },
  it: { done: "Fatto", inProgress: "In corso", next: "Prossimo", agenda: "Agenda", partners: "I nostri partner", thanks: "Grazie!" },
  de: { done: "Erledigt", inProgress: "Läuft", next: "Als Nächstes", agenda: "Agenda", partners: "Unsere Partner", thanks: "Danke!" },
};

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
          };
        }
        outL[id] = outF;
      }
      texts[l] = outL;
    }
  }
  const glossary: DeckLang["glossary"] = {};
  if (r.glossary && typeof r.glossary === "object") {
    for (const [l, list] of Object.entries(r.glossary as Record<string, unknown>)) {
      if (!isLang(l) || !Array.isArray(list)) continue;
      glossary[l] = list
        .filter((g): g is Glossary => !!g && typeof g.from === "string" && typeof g.to === "string")
        .slice(0, 200)
        .map((g) => ({ from: g.from.slice(0, 120), to: g.to.slice(0, 120) }));
    }
  }
  return { source: r.source, current: r.current, texts, glossary };
}
