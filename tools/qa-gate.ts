/**
 * The quality gate (Mario, 13 Oct 2026: "if the logic changes make it worse,
 * do not deploy them"). Each variant is a commit (with commits to revert, if
 * any) checked out in its own worktree, served by its own dev server, and run
 * through ITS OWN tools/qa-suite.ts (its pipeline) on today's cases, several
 * times. Every run is then scored by TODAY's content judge (tools/qa-content.ts)
 * and today's blocking checks, so all variants face the same judge.
 *
 *   npx tsx tools/qa-gate.ts tools/qa-gate.json [runs=3] [parallel=2]
 *
 * qa-gate.json: [{ "name": "P", "ref": "origin/main" }, { "name": "R1AC", "ref": "cbd41ce", "revert": ["41d3701"] }]
 * Output: .omc/qa/gate-<stamp>/<variant>/run-<n>/ and gate.md. The deploy rule
 * is in CONTEXT.md ("Before a deploy").
 */
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { countriesIn, photoPlaces } from "../lib/slides/library";

const ROOT = resolve(".");
const [, , file = "tools/qa-gate.json", runsArg = "3", parArg = "2"] = process.argv;
const RUNS = Number(runsArg);
const PARALLEL = Number(parArg);
/** A variant: a commit, commits to revert, and literal patches (a switch turned off without a revert that would conflict). */
interface Variant {
  name: string;
  ref: string;
  revert?: string[];
  patch?: { file: string; from: string; to: string }[];
}
const variants = JSON.parse(readFileSync(file, "utf8")) as Variant[];
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
const OUT = join(ROOT, ".omc/qa", `gate-${stamp}`);
const TREES = process.env.GATE_TREES ?? join(ROOT, ".omc/gate-trees");
mkdirSync(OUT, { recursive: true });
const password = (readFileSync(".env.local", "utf8").match(/^SITE_PASSWORD=(.*)$/m)?.[1] ?? "").replace(/^"|"$/g, "");
const sh = (cmd: string, cwd = ROOT) => execSync(cmd, { cwd, stdio: "pipe", encoding: "utf8" });
const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

interface Case {
  id: string;
  brief?: string;
  briefFile?: string;
  expect: { text?: string[]; noText?: string[]; lastContentHas?: string[]; noForeignPhotos?: boolean };
}
const cases = JSON.parse(readFileSync("tools/qa-prompts.json", "utf8")) as Case[];
const RETEST = ["thin-ministry", "thin-ministry-answered", "pitch-senegal", "mission-notes", "tech-review", "linked-article"];

/** A worktree at the variant, today's cases and briefs in it, node_modules cloned (APFS clone: no disk, no symlink). */
function prepare(v: Variant): string {
  const dir = join(TREES, v.name);
  if (existsSync(dir)) {
    try {
      sh(`git worktree remove --force "${dir}"`);
    } catch {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  sh(`git worktree add --detach "${dir}" ${v.ref}`);
  for (const c of v.revert ?? []) sh(`git -c user.name=gate -c user.email=gate@local revert --no-edit ${c}`, dir);
  for (const p of v.patch ?? []) {
    const f = join(dir, p.file);
    const text = readFileSync(f, "utf8");
    if (!text.includes(p.from)) throw new Error(`${v.name}: patch anchor not found in ${p.file}`);
    writeFileSync(f, text.replace(p.from, p.to));
  }
  sh(`cp -cR "${join(ROOT, "node_modules")}" "${join(dir, "node_modules")}"`);
  cpSync(join(ROOT, ".env.local"), join(dir, ".env.local"));
  cpSync(join(ROOT, "tools/qa-briefs"), join(dir, "tools/qa-briefs"), { recursive: true });
  return dir;
}

async function serve(dir: string, port: number): Promise<ChildProcess> {
  const p = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: dir, stdio: "ignore", detached: true });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`http://localhost:${port}/login`);
      if (res.ok) {
        // Warm the generate route so the first case does not pay the compile.
        await fetch(`http://localhost:${port}/api/generate`, { method: "POST", body: "{}" }).catch(() => {});
        return p;
      }
    } catch {
      /* not up yet */
    }
  }
  throw new Error(`server on ${port} did not start`);
}

/** Today's blocking checks, the same for every variant. */
function blocking(id: string, slides: { layoutId: string; image?: string }[]): string[] {
  const c = cases.find((x) => x.id === id);
  if (!c) return [];
  const brief = c.brief ?? readFileSync(join("tools/qa-briefs", c.briefFile!), "utf8");
  const all = JSON.stringify(slides).toLowerCase();
  const out: string[] = [];
  if (slides[0]?.layoutId !== "cover") out.push("no cover");
  if (slides.at(-1)?.layoutId !== "thank-you") out.push("no closing");
  const end = slides.findIndex((s) => s.layoutId === "thank-you");
  const last = JSON.stringify(slides[(end < 0 ? slides.length : end) - 1] ?? {}).toLowerCase();
  c.expect.lastContentHas?.forEach((t) => !last.includes(t.toLowerCase()) && out.push(`last slide lacks "${t}"`));
  c.expect.noText?.forEach((t) => all.includes(t.toLowerCase()) && out.push(`"${t}" present`));
  c.expect.text?.forEach((t) => !all.includes(t.toLowerCase()) && out.push(`"${t}" missing`));
  const named = countriesIn(brief);
  slides.forEach((s) => {
    const pl = photoPlaces(s.image);
    if (pl && named.length && !named.some((n) => pl.some((p) => p.toLowerCase() === n))) out.push(`foreign photo ${s.image}`);
  });
  return out;
}

interface RunScore {
  overall: number;
  criteria: Record<string, number>;
  perDeck: Record<string, number>;
  blocking: Record<string, string[]>;
  firstSlide?: number;
  cost: number;
}

async function runVariant(v: Variant, port: number): Promise<RunScore[]> {
  log(`${v.name}: preparing ${v.ref}${v.revert?.length ? ` minus ${v.revert.join(",")}` : ""}`);
  const dir = prepare(v);
  const server = await serve(dir, port);
  log(`${v.name}: server on ${port}`);
  const scores: RunScore[] = [];
  const judges: Promise<void>[] = [];
  try {
    for (let r = 1; r <= RUNS; r++) {
      const before = new Set(existsSync(join(dir, ".omc/qa")) ? readdirSync(join(dir, ".omc/qa")) : []);
      await new Promise<void>((res, rej) => {
        const p = spawn("npx", ["tsx", "tools/qa-suite.ts", ...(process.env.GATE_IDS?.split(",") ?? [])], {
          cwd: dir,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, QA_URL: `http://localhost:${port}`, QA_FILE: join(ROOT, "tools/qa-prompts.json"), SITE_PASSWORD: password },
        });
        let outText = "";
        p.stdout.on("data", (d) => (outText += d));
        p.on("exit", (code) => {
          writeFileSync(join(OUT, `${v.name}-run${r}.log`), outText);
          code === 0 ? res() : rej(new Error(`${v.name} run ${r} exit ${code}`));
        });
      });
      const made = readdirSync(join(dir, ".omc/qa")).filter((d) => !before.has(d) && !d.startsWith("gate"));
      const src = join(dir, ".omc/qa", made.sort().at(-1)!);
      const dst = join(OUT, v.name, `run-${r}`);
      mkdirSync(dst, { recursive: true });
      cpSync(src, dst, { recursive: true });
      log(`${v.name}: run ${r} decks in ${dst}`);
      // The judge runs while the next run generates.
      judges.push(
        new Promise<void>((res) => {
          const j = spawn("npx", ["tsx", "--env-file=.env.local", "tools/qa-content.ts", dst, "tools/qa-prompts.json"], { cwd: ROOT, stdio: "ignore" });
          j.on("exit", () => {
            scores.push(score(dst));
            log(`${v.name}: run ${r} judged ${scores.at(-1)!.overall.toFixed(2)}`);
            res();
          });
        }),
      );
    }
    await Promise.all(judges);
  } finally {
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* gone */
    }
  }
  return scores;
}

function score(dir: string): RunScore {
  const content = JSON.parse(readFileSync(join(dir, "content.json"), "utf8")) as { id: string; scores: Record<string, number> }[];
  const criteria: Record<string, number> = {};
  const perDeck: Record<string, number> = {};
  for (const d of content) {
    const vals = Object.values(d.scores);
    perDeck[d.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    for (const [k, v] of Object.entries(d.scores)) criteria[k] = (criteria[k] ?? 0) + v / content.length;
  }
  const blockingMap: Record<string, string[]> = {};
  let first: number[] = [];
  let cost = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && !["content.json"].includes(x))) {
    const deck = JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; slides: { layoutId: string; image?: string }[]; firstSlide?: number; cost?: number };
    if (!deck.id || !deck.slides) continue;
    blockingMap[deck.id] = blocking(deck.id, deck.slides);
    if (deck.firstSlide) first.push(deck.firstSlide);
    cost += deck.cost ?? 0;
  }
  first = first.sort((a, b) => a - b);
  const overall = Object.values(perDeck).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(perDeck).length);
  return { overall, criteria, perDeck, blocking: blockingMap, firstSlide: first[Math.floor(first.length / 2)], cost };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

(async () => {
  const results: Record<string, RunScore[]> = {};
  const queue = variants.map((v, i) => ({ v, port: 3781 + i }));
  const worker = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      try {
        results[job.v.name] = await runVariant(job.v, job.port);
      } catch (e) {
        log(`${job.v.name} failed: ${(e as Error).message}`);
      }
      writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 1));
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const names = variants.map((v) => v.name).filter((n) => results[n]?.length);
  const base = names[0];
  const crit = Object.keys(results[base]?.[0]?.criteria ?? {});
  const avg = (n: string, f: (s: RunScore) => number) => mean(results[n].map(f));
  const lines = [
    `# Quality gate ${stamp}`,
    "",
    `${RUNS} runs a variant, judged by today's tools/qa-content.ts. Baseline: ${base}.`,
    "",
    `| variant | overall (sd) | ${crit.join(" | ")} | retest 6 | blocking | 1st slide s | cost/run |`,
    `|---|---|${crit.map(() => "---").join("|")}|---|---|---|---|`,
    ...names.map((n) => {
      const rs = results[n];
      const retest = mean(rs.flatMap((s) => RETEST.map((id) => s.perDeck[id]).filter((x) => x !== undefined)));
      const block = mean(rs.map((s) => Object.values(s.blocking).filter((b) => b.length).length));
      return `| ${n} | ${avg(n, (s) => s.overall).toFixed(2)} (${sd(rs.map((s) => s.overall)).toFixed(2)}) | ${crit.map((k) => avg(n, (s) => s.criteria[k]).toFixed(2)).join(" | ")} | ${retest.toFixed(2)} | ${block.toFixed(1)} decks | ${avg(n, (s) => s.firstSlide ?? 0).toFixed(1)} | $${avg(n, (s) => s.cost).toFixed(3)} |`;
    }),
    "",
    "## Deploy rule (CONTEXT.md)",
    ...names.slice(1).map((n) => {
      const d = avg(n, (s) => s.overall) - avg(base, (s) => s.overall);
      const worst = crit.map((k) => [k, avg(n, (s) => s.criteria[k]) - avg(base, (s) => s.criteria[k])] as const).sort((a, b) => a[1] - b[1])[0];
      const rt = (x: string) => mean(results[x].flatMap((s) => RETEST.map((id) => s.perDeck[id]).filter((y) => y !== undefined)));
      const ok = d >= -0.05 && worst[1] >= -0.15 && rt(n) >= rt(base) - 0.05;
      return `- ${n}: overall ${d >= 0 ? "+" : ""}${d.toFixed(2)}, worst criterion ${worst[0]} ${worst[1].toFixed(2)}, retest ${(rt(n) - rt(base)).toFixed(2)} → ${ok ? "PASSES" : "does not pass"}`;
    }),
    "",
    "## Blocking findings, last run",
    ...names.flatMap((n) => Object.entries(results[n].at(-1)!.blocking).filter(([, b]) => b.length).map(([id, b]) => `- ${n} · ${id}: ${b.join("; ")}`)),
  ];
  writeFileSync(join(OUT, "gate.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
})();
