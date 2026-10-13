import { countFromBrief, outlineFromBrief, outlineRuns } from "./brief";
import { figuresIn, spelledToDigits } from "./provenance";

/**
 * What a brief gets wrong or leaves open, found without the model (Mario,
 * 13 Oct 2026: "the model must ask when something is unclear, when some
 * numbers do not add up; every bug has to be prevented"). Only what can be
 * told for certain, or nearly: each finding goes to the brief's analysis as
 * a hint (app/api/analyze), and the model asks about it only if the brief
 * really leaves it open. The slide count is the one finding the client asks
 * itself (`countQuestion`), since its answer sets the deck's length.
 */
export interface BriefFinding {
  kind: "count" | "parts" | "shares" | "date" | "list";
  /** One plain sentence for the analysis' prompt. */
  hint: string;
  /** The words of the brief it is about. */
  about: string;
}

/** The line that introduces a slide outline: "Structure I want (12 slides):", "Agenda:", "Scaletta". */
const OUTLINE_HEAD = /\b(slides?|structure|outline|agenda|deck|struttura|scaletta|estructura|diapositivas?|plan)\b/i;

/** The brief names N slides and lists another number of them under a slide heading. */
function countFinding(brief: string): (BriefFinding & { named: number; listed: number }) | null {
  const named = countFromBrief(brief);
  if (named === undefined) return null;
  for (const run of outlineRuns(brief)) {
    if (run.length < 3 || run.length === named) continue;
    const head = brief.slice(0, run[0].at).split("\n").filter((l) => l.trim()).at(-1) ?? "";
    if (!OUTLINE_HEAD.test(head)) continue;
    return {
      kind: "count",
      named,
      listed: run.length,
      about: head.trim(),
      hint: `The brief asks for ${named} slides but its outline lists ${run.length}.`,
    };
  }
  return null;
}

const NUMBER: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
/** Parts a brief announces by number: "a migration plan in 3 phases", "four pillars", "tre fasi". */
const PARTS = /\b(\d|two|three|four|five|six|seven|eight|nine|ten|due|tre|quattro|cinque|sei|dos|tres|cuatro|cinco)\s+(phases?|steps?|stages?|pillars?|options?|scenarios?|priorities|recommendations?|workstreams?|milestones?|waves?|fasi|fase|pilastri|opzioni|scenari|priorità|raccomandazioni|tappe|fases|etapas|pilares|opciones|escenarios)\b/gi;
const STEM: Record<string, RegExp> = {
  phase: /\bphase|\bfase/i,
  step: /\bstep|\bpass/i,
  stage: /\bstage|\btapp|\betapa/i,
  pillar: /\bpillar|\bpilast|\bpilar/i,
  option: /\boption|\bopzion|\bopci/i,
  scenario: /\bscenari|\bescenari/i,
  priorit: /\bpriorit/i,
  recommendation: /\brecommend|\braccomand/i,
  workstream: /\bworkstream/i,
  milestone: /\bmilestone/i,
  wave: /\bwave/i,
};

/**
 * "Migration plan in 3 phases" with the phases never named: the slide would
 * have to make them up. The parts count as described when the brief numbers
 * them ("Phase 1", "first phase") or lists them under the announcing line.
 */
function partsFindings(brief: string): BriefFinding[] {
  const out: BriefFinding[] = [];
  for (const m of brief.matchAll(PARTS)) {
    const n = /^\d$/.test(m[1]) ? Number(m[1]) : NUMBER[m[1].toLowerCase()];
    if (!n || n < 2) continue;
    const noun = m[2].toLowerCase();
    const stem = Object.entries(STEM).find(([k]) => noun.startsWith(k.slice(0, 4)))?.[1] ?? new RegExp(`\\b${noun.slice(0, 4)}`, "i");
    // Named one by one: "Phase 1", "phase one", "first phase", "Fase 2".
    const named = new RegExp(`(${stem.source.replace(/\\b/g, "")})\\w*\\s*(\\d|one|two|three|four|five|uno|due|tre|i{1,3}\\b|iv\\b)|\\b(first|second|third|prima|seconda|terza|primera|segunda)\\s+(${stem.source.replace(/\\b/g, "")})`, "gi");
    if ((brief.match(named) ?? []).length >= Math.min(n, 2)) continue;
    // Listed right under the line that announces them: as many lines or items as the parts.
    const after = brief.slice(m.index! + m[0].length);
    const lineEnd = after.indexOf("\n");
    const rest = (lineEnd < 0 ? "" : after.slice(lineEnd + 1)).split("\n");
    const items = rest.findIndex((l) => !/^\s*(\d{1,2}[.)]|[-*•]|[a-z][.)])\s+\S/i.test(l));
    if ((items < 0 ? rest.length : items) >= n) continue;
    // Spelled out on the same line after a colon: "in 3 phases: pilot, scale, handover".
    const sameLine = (lineEnd < 0 ? after : after.slice(0, lineEnd)).replace(/^\s*\)?/, "");
    if (/^[:(]/.test(sameLine.trim()) && sameLine.split(/,|;|\band\b|\be\b|\by\b/).length >= n) continue;
    const line = brief.slice(brief.lastIndexOf("\n", m.index!) + 1, m.index! + m[0].length + Math.max(0, lineEnd < 0 ? after.length : lineEnd)).trim();
    out.push({ kind: "parts", about: line, hint: `The brief announces ${m[0].trim()} but does not say what they are.` });
  }
  return out;
}

/**
 * Shares of one whole that pass 100%: "40% of schools on fibre, 35% on
 * satellite, 30% offline". Only within one sentence, only with words that
 * make them parts of one whole, so "60% faster and 80% coverage" is left alone.
 */
function sharesFindings(brief: string): BriefFinding[] {
  const out: BriefFinding[] = [];
  for (const sentence of brief.split(/(?<=[.!?;])\s+|\n+/)) {
    const shares = figuresIn(spelledToDigits(sentence)).filter((f) => f.endsWith("%")).map((f) => parseFloat(f.replace(/,/g, "")));
    if (shares.length < 2) continue;
    if (!/\b(of|share|split|are|were|on|in|via|through|use|using|di|sono|del|de|son)\b/i.test(sentence)) continue;
    if (/\b(increase|decrease|grow|grew|growth|rose|rise|fell|fall|drop|gain|reach|faster|slower|higher|lower|more|less|up|down|improv|reduc|boost|cut|cresc|aument|ridu|by|vs|versus|compared)\b/i.test(sentence)) continue;
    const total = shares.reduce((a, b) => a + b, 0);
    if (total > 100.5) out.push({ kind: "shares", about: sentence.trim(), hint: `These percentages add up to ${Math.round(total * 10) / 10}%: if they are parts of one whole, one of them is wrong.` });
  }
  return out;
}

/** A deadline or a launch in a year that has gone: "will launch in 2024", "by 2025" written in 2026. */
function dateFindings(brief: string, today: Date): BriefFinding[] {
  const out: BriefFinding[] = [];
  const year = today.getFullYear();
  const FUTURE = /\b(by|will|until|deadline|target|launch(?:es|ing)? in|starting|from|next|entro|partirà|lancio|para|hasta)\b[^.\n]{0,40}?\b(20\d\d)\b/gi;
  for (const m of brief.matchAll(FUTURE)) {
    const y = Number(m[2]);
    if (y >= year) continue;
    // "from 2019 to 2024", "since 2020": a span in the past, not a plan.
    if (/^(from|starting)$/i.test(m[1]) && /\b(to|until|through|-|–)\s*20\d\d\b/.test(m[0] + brief.slice(m.index! + m[0].length, m.index! + m[0].length + 12))) continue;
    out.push({ kind: "date", about: m[0].trim(), hint: `"${m[0].trim()}" points to ${y}, which has already passed (today is ${year}).` });
  }
  return out;
}

/**
 * Slides of the outline whose items only the presenter knows: "12. Decisions
 * needed from this meeting", "11. Risks and open questions", a timeline, next
 * steps, a budget. The model went through the outline in order and ran out
 * of questions before them (tech review, 13 Oct 2026), so they are named to
 * it, in this order, to check before anything else. The parts check says
 * when a phase list was announced and left empty; these go to the model only
 * when the brief names none of the items under the slide's own line.
 */
const LIST_SLIDE = /\b(decisions?|decide|risks?|open questions?|next steps?|timeline|roadmap|milestones?|budget|costs?|team|owners?|the ask|asks?|recommendations?|decisioni|rischi|prossimi passi|decisiones|riesgos|pr[oó]ximos pasos)\b/i;
function listFindings(brief: string): BriefFinding[] {
  return outlineFromBrief(brief, countFromBrief(brief))
    .filter((o) => LIST_SLIDE.test(o.title))
    .map((o) => ({ kind: "list" as const, about: `${o.order}. ${o.title}`, hint: `Slide ${o.order} ("${o.title}") is a list only the presenter knows: ask for its items unless the brief gives them.` }));
}

export function briefFindings(brief: string, today = new Date()): BriefFinding[] {
  const count = countFinding(brief);
  return [...(count ? [count] : []), ...listFindings(brief), ...partsFindings(brief), ...sharesFindings(brief), ...dateFindings(brief, today)];
}

/** The count finding alone, with both numbers, for the client's own question. */
export function countConflict(brief: string): { named: number; listed: number; about: string } | null {
  const f = countFinding(brief);
  return f ? { named: f.named, listed: f.listed, about: f.about } : null;
}
