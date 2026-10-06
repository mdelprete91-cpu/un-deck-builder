/**
 * The deck language without the browser or the model: the memory, the
 * switch plan, what an edit can go back to. A fake translator tags every text with its
 * target language, so what came from memory and what was translated is
 * visible.
 *
 *   npx tsx tools/i18n-test.ts
 */
import { AI_LAYOUT_IDS, type Slide } from "../lib/slides/schema";
import { defaultContent } from "../lib/slides/defaults";
import { defaultBlock } from "../lib/slides/pages/presets";
import { PAGE_BLOCK_TYPES } from "../lib/slides/pages/schema";
import { apply, plan, remember, snapshot, textFields, newEdits, type DeckLang, type Lang } from "../lib/slides/i18n";
import { readPath, setPath } from "../lib/slides/state";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
};

// A fake translator: "[es] text".
let calls = 0;
function translate(lang: DeckLang, slides: Slide[], to: Lang) {
  const texts = snapshot(slides, lang);
  const { ready, jobs } = plan(slides, lang, texts, to);
  calls += jobs.length;
  const done = new Map<string, string>();
  for (const j of jobs) {
    let t = j.text.replace(/^\[\w\w\] /, "");
    done.set(`${j.slide}\u0000${j.path}`, to === lang.source ? t : `[${to}] ${t}`);
  }
  const next = apply(slides, ready, done);
  return { slides: next, lang: { ...lang, current: to, texts: remember(next, texts, lang, to, jobs, done) }, jobs };
}

// 1. textFields on every layout and every page block: no ids, urls, emails.
const deck: Slide[] = AI_LAYOUT_IDS.map((id, i) => ({ ...defaultContent(id), id: `s${i}` }) as Slide);
deck.push({ id: "p0", layoutId: "a4-page", stack: PAGE_BLOCK_TYPES.map((t) => defaultBlock(t)), footerLabel: "Digital Inclusion" } as Slide);
const all = deck.flatMap((s) => textFields(s));
check("text fields found on every layout", deck.every((s) => textFields(s).length > 0), deck.filter((s) => !textFields(s).length).map((s) => s.layoutId).join(","));
check("no ids, emails or links", !all.some((f) => /@|https?:|^s\d+$|^\/library\//.test(f.text)), all.filter((f) => /@|https?:/.test(f.text)).map((f) => f.path).slice(0, 5).join(","));
check("every path reads back its text", deck.every((s) => textFields(s).every((f) => readPath(s, f.path) === f.text)));

// 2. EN -> ES -> fix -> FR -> ES: the fix is kept, nothing retranslated.
let lang: DeckLang = { source: "en", current: "en", texts: {} };
let slides = deck;
({ slides, lang } = translate(lang, slides, "es"));
check("everything translated to es", textFields(slides[0]).every((f) => f.text.startsWith("[es] ")));
const target = textFields(slides[1])[0];
const before = target.text;
const fixed = before.replace(/(\[es\] \S+)/, "$1-arreglado");
slides = slides.map((s, i) => (i === 1 ? setPath(s, target.path, fixed) : s));
const asked = newEdits(slides, lang);
check("leaving es asks about the one edit, with its translation", asked.length === 1 && asked[0].translation === before && asked[0].text === fixed, JSON.stringify(asked));
check("nothing to ask in the original", newEdits(slides, { ...lang, current: "en" }).length === 0);
({ slides, lang } = translate(lang, slides, "fr"));
check("fr from the english source, not from the spanish", textFields(slides[1])[0].text.startsWith("[fr] ") && !textFields(slides[1])[0].text.includes("[es]"));
calls = 0;
({ slides, lang } = translate(lang, slides, "es"));
check("back to es: the fix is there", readPath(slides[1], target.path) === fixed);
check("back to es: nothing translated again", calls === 0, `${calls} calls`);
check("a kept edit is not asked about again", newEdits(slides, lang).length === 0);
// Changed again, then put back to the translation: no longer an edit.
const again = slides.map((s, i) => (i === 1 ? setPath(s, target.path, "[es] otra cosa") : s));
check("a second edit is asked about", newEdits(again, lang).length === 1 && newEdits(again, lang)[0].translation === before);

// 3. Back to EN, change a sentence: only that field is retranslated into es, the fix stays.
({ slides, lang } = translate(lang, slides, "en"));
check("back to en: the english text", textFields(slides[1])[0].text === textFields(deck[1])[0].text);
const other = textFields(slides[2])[0];
slides = slides.map((s, i) => (i === 2 ? setPath(s, other.path, "A new english sentence") : s));
calls = 0;
({ slides, lang } = translate(lang, slides, "es"));
check("only the changed field is retranslated", calls === 1, `${calls} calls`);
check("the changed field is new spanish", readPath(slides[2], other.path) === "[es] A new english sentence");
check("the fix survives", readPath(slides[1], target.path) === fixed);

// 4. A point deleted in Spanish: that slide is retranslated, the others stay.
const withBullets = slides.findIndex((s) => (s.bullets?.length ?? 0) >= 3);
if (withBullets >= 0) {
  slides = slides.map((s, i) => (i === withBullets ? { ...s, bullets: s.bullets!.slice(1) } : s));
  ({ slides, lang } = translate(lang, slides, "en"));
  const en = slides[withBullets].bullets ?? [];
  check("deleted point: english comes from the spanish on screen, aligned", en.every((b) => !b.startsWith("[")) && en.length === deck[withBullets].bullets!.length - 1, JSON.stringify(en.slice(0, 2)));
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
