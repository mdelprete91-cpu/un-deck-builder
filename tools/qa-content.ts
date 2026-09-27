/**
 * Content QA: a judge reads each deck of a suite run next to its brief and
 * material and scores it against what good presentation practice asks for
 * (26 Sep 2026: tools/qa-suite.ts checks structure, counts and numbers; this
 * checks whether the words are any good). Uses gpt-6-sol with reasoning,
 * a stronger model than the one that wrote the deck.
 *
 *   npx tsx --env-file=.env.local tools/qa-content.ts .omc/qa/<run> [prompts.json]
 *
 * Writes content-report.md and content.json into the run folder.
 */
import OpenAI from "openai";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractDocx, extractPptx, extractXlsx } from "../lib/slides/attachments";

const CRITERIA = [
  ["fidelity", "Fidelity: facts, names, figures and terms come from the brief and material, correct and in their own words; nothing is invented or reinterpreted into claims the source does not make."],
  ["selection", "Selection: the text shown is what matters most in the material for this brief; nothing important the brief asks for is missing; no filler or generic sentences."],
  ["arrangement", "Arrangement: each text sits where its shape fits (parallel points as labelled blocks, sequences as steps or timelines, figures as stats or charts), with a clear label/body hierarchy and balanced blocks."],
  ["consistency", "Consistency: parallel slides and blocks use the same kind of label, the same terms and the same level of detail; the brief's terms are used the same way throughout."],
  ["no_repetition", "No repetition: no slide restates what another already shows (the same figures, the same points)."],
  ["numbers", "Numbers: every figure has its unit or currency and, where the source gives one, its date or period; no bare or mismatched figures side by side."],
] as const;

const SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      properties: Object.fromEntries(CRITERIA.map(([k]) => [k, { type: "integer" }])),
      required: CRITERIA.map(([k]) => k),
      additionalProperties: false,
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slide: { type: "integer" },
          criterion: { type: "string", enum: CRITERIA.map(([k]) => k) },
          problem: { type: "string" },
          fix: { type: "string" },
        },
        required: ["slide", "criterion", "problem", "fix"],
        additionalProperties: false,
      },
    },
    verdict: { type: "string" },
  },
  required: ["scores", "issues", "verdict"],
  additionalProperties: false,
} as const;

const INSTRUCTIONS = `You are a senior presentation editor at an international organisation (UNICEF, ITU). You review slide decks written by an AI from a user's brief and reference material. The layouts and design are fixed and approved. The owner's priority is consistency with the source: the deck should show the brief's and the material's own content, well chosen and well placed, not reinterpret it. Judge only which text is shown and how it is laid out on the slides; do not reward persuasive rewording. Score each criterion from 1 (poor) to 5 (excellent), strictly: 5 means a senior communications officer would ship it unchanged, 3 means it needs a pass, 1 means it misleads or fails the brief. Then list the concrete issues, the worst first, at most eight, each with the slide number (1-based, cover is 1), the criterion, what is wrong in one sentence quoting the slide, and the fix in one sentence. The closing "Thanks" slide and the contacts are fixed by the tool: do not judge them. Criteria:\n${CRITERIA.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\nEnd with a one-sentence verdict. Write in English.`;

type Prompt = { id: string; brief?: string; briefFile?: string; files?: string[]; xlsx?: string; insights?: string };

async function materialOf(p: Prompt): Promise<string> {
  const paths = [...(p.xlsx ? [join("tools/qa-briefs", p.xlsx)] : []), ...(p.files ?? [])];
  const parts: string[] = [];
  for (const path of paths) {
    const buf = readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const ext = path.split(".").pop()!.toLowerCase();
    const text =
      ext === "xlsx" ? await extractXlsx(ab) : ext === "docx" ? await extractDocx(ab) : ext === "pptx" ? await extractPptx(ab) : ext === "pdf" ? "(a PDF the model read as pages; judge fidelity only on what the brief states)" : buf.toString("utf8");
    parts.push(`File "${path.split("/").pop()}":\n${text.slice(0, 12000)}`);
  }
  return parts.join("\n\n");
}

function slideText(s: Record<string, unknown>, i: number): string {
  const lines = [`Slide ${i + 1} [${s.layoutId}]`];
  for (const k of ["title", "subtitle", "stat", "support", "quote", "author", "body"]) if (s[k]) lines.push(`  ${k}: ${s[k]}`);
  for (const b of (s.blocks as { label: string; body: string }[]) ?? []) lines.push(`  - ${b.label}: ${b.body}`);
  for (const x of (s.stats as { value: string; label: string }[]) ?? []) lines.push(`  - ${x.value} — ${x.label}`);
  for (const b of (s.bullets as string[]) ?? []) lines.push(`  - ${b}`);
  const series = s.series as string[] | undefined;
  for (const b of (s.bars as { label: string; value: number; values?: number[] }[]) ?? []) lines.push(`  bar ${b.label}: ${b.values?.length ? b.values.map((v, j) => `${series?.[j] ?? j}=${v}`).join(", ") : b.value}`);
  if (s.current) lines.push(`  current stage: ${s.current}`);
  return lines.join("\n");
}

async function main() {
  const [dir, promptFile = ".omc/qa-usecases.json"] = process.argv.slice(2);
  const prompts = new Map((JSON.parse(readFileSync(promptFile, "utf8")) as Prompt[]).map((p) => [p.id, p]));
  const decks = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "content.json").map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const client = new OpenAI({ maxRetries: 3 });
  const results: { id: string; scores: Record<string, number>; issues: { slide: number; criterion: string; problem: string; fix: string }[]; verdict: string }[] = [];
  let cost = 0;
  const queue = decks.filter((d) => prompts.has(d.id));
  async function worker() {
    for (let d = queue.shift(); d; d = queue.shift()) {
      const p = prompts.get(d.id)!;
      const brief = p.brief ?? readFileSync(join("tools/qa-briefs", p.briefFile!), "utf8");
      const input = `BRIEF:\n${brief}${p.insights ? `\n\nUSER ANSWERS ABOUT THE MATERIAL: ${p.insights}` : ""}\n\nMATERIAL:\n${(await materialOf(p)) || "(none)"}\n\nDECK:\n${(d.slides as Record<string, unknown>[]).map(slideText).join("\n")}`;
      const r = await client.responses.create({
        model: "gpt-6-sol",
        instructions: INSTRUCTIONS,
        input,
        reasoning: { effort: "medium" },
        text: { format: { type: "json_schema", name: "review", schema: SCHEMA as unknown as Record<string, unknown>, strict: true } },
      });
      const u = r.usage;
      cost += ((u?.input_tokens ?? 0) * 1.25 + (u?.output_tokens ?? 0) * 10) / 1_000_000;
      const j = JSON.parse(r.output_text);
      results.push({ id: d.id, ...j });
      console.log(`${d.id.padEnd(28)} ${CRITERIA.map(([k]) => `${k.slice(0, 5)}=${j.scores[k]}`).join(" ")}`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  results.sort((a, b) => a.id.localeCompare(b.id));
  const avg = (k: string) => results.reduce((n, r) => n + r.scores[k], 0) / results.length;
  const counts: Record<string, number> = {};
  for (const r of results) for (const i of r.issues) counts[i.criterion] = (counts[i.criterion] ?? 0) + 1;
  const lines = [
    `# Content QA ${dir}`,
    "",
    "| criterion | average /5 | issues |",
    "|---|---|---|",
    ...CRITERIA.map(([k]) => `| ${k} | ${avg(k).toFixed(2)} | ${counts[k] ?? 0} |`),
    "",
    `Overall ${(CRITERIA.reduce((n, [k]) => n + avg(k), 0) / CRITERIA.length).toFixed(2)} / 5 over ${results.length} decks. Judge cost about $${cost.toFixed(3)}.`,
    "",
    ...results.flatMap((r) => [`## ${r.id}`, "", r.verdict, "", ...r.issues.map((i) => `- s${i.slide} ${i.criterion}: ${i.problem} → ${i.fix}`), ""]),
  ];
  writeFileSync(join(dir, "content-report.md"), lines.join("\n"));
  writeFileSync(join(dir, "content.json"), JSON.stringify(results, null, 1));
  console.log(`\n${lines.slice(2, 13).join("\n")}\nreport: ${dir}/content-report.md`);
}
main();
