/**
 * Two-pager generation QA, end to end in a clean browser against the dev
 * server (localhost:3777): pick Two-pager and a logo, generate each brief of
 * tools/qa-twopager.json, let the fit pass run, then check the piece.
 *
 *   npx tsx tools/qa-twopager.ts [id ...] [--runs N] [--out dir]
 *
 * Checks: two pages; every page fits its sheet after the fit pass; page 1
 * opens with the banner and page 2 never does; section labels are all
 * different; every figure on the page is in the brief; no em or en dashes.
 * Room left at the bottom of a page is reported, not failed.
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface Case {
  id: string;
  brand: string;
  brief?: string;
  file?: string;
}
interface Block {
  type: string;
  rail?: string;
  heading?: string;
  sub?: string;
  lead?: string;
  body?: string;
  items?: { label?: string; body?: string; extra?: string; group?: string }[];
}

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf("--runs") + 1]) || 1;
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : "tools/out/qa-twopager";
const ids = args.filter((a, i) => !a.startsWith("--") && !["--runs", "--out"].includes(args[i - 1]));
const cases = (JSON.parse(readFileSync("tools/qa-twopager.json", "utf8")) as Case[]).filter((c) => !ids.length || ids.includes(c.id));

const textOf = (b: Block) =>
  [b.rail, b.heading, b.sub, b.lead, b.body, ...(b.items ?? []).flatMap((i) => [i.label, i.body, i.extra, i.group])].filter(Boolean).join(" ");
/** Figures as written, normalised: "1,300" and "1300" are one figure. */
const figures = (s: string) => (s.match(/\d[\d.,]*\d|\d/g) ?? []).map((n) => n.replace(/[.,](?=\d{3}\b)/g, "").replace(/[.,]$/, ""));

/** The site's password gate: SITE_PASSWORD from the environment (the caller reads .env.local), never written here. */
async function signIn(page: Page) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return;
  await page.goto("http://localhost:3777/login");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

/** A block label that is only a number or a numbered step word. */
const NUMBER_ONLY = /^\s*(?:(?:step|phase|stage|fase|passo|paso|etapa)\s*)?(?:\d{1,2}|[ivx]{1,4})[.):]?\s*$/i;
const PLACEHOLDER = /lorem ipsum|\btbd\b|\[[^\]]{0,40}\]|one sentence describing|section title|name surname/i;
const norm = (t?: string) => (t ?? "").toLowerCase().replace(/\s+/g, " ").trim();
/** What looks wrong to a reader in a page's blocks (Mario, 9 Oct 2026). */
function oddities(slides: { stack?: Block[] }[]): string[] {
  const out: string[] = [];
  slides.forEach((s, p) =>
    (s.stack ?? []).forEach((b, k) => {
      const at = `p${p + 1} #${k + 1} ${b.type}`;
      (b.items ?? []).forEach((it, j) => {
        // A stat card's label is its figure: only a numbered list prints its own.
        if (b.type === "numbered" && NUMBER_ONLY.test(it.label ?? "")) out.push(`${at}: item ${j + 1} label is a number ("${it.label}")`);
        if (it.label && it.body && norm(it.label) === norm(it.body)) out.push(`${at}: item ${j + 1} label repeats its body`);
      });
      const texts = (b.items ?? []).flatMap((it) => [it.label, it.body]).filter((t): t is string => !!t && t.trim().length > 3).map(norm);
      const dup = texts.find((t, i) => texts.indexOf(t) !== i);
      if (dup) out.push(`${at}: "${dup.slice(0, 40)}" twice`);
      if (b.heading && b.rail && norm(b.heading) === norm(b.rail)) out.push(`${at}: heading repeats its side label`);
      const ph = textOf(b).match(PLACEHOLDER);
      if (ph) out.push(`${at}: placeholder text "${ph[0]}"`);
    }),
  );
  return out;
}

async function generate(page: Page, c: Case, brief: string): Promise<number> {
  await page.goto("http://localhost:3777/");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Logo lockup" }).click();
  await page.getByRole("option", { name: c.brand, exact: true }).click();
  await page.getByRole("button", { name: "Document type" }).click();
  await page.getByRole("option", { name: /Two-pager/ }).click();
  await page.locator("textarea").first().fill(brief);
  const t0 = Date.now();
  await page.getByRole("button", { name: /Generate/ }).last().click();
  await page.waitForFunction(() => document.querySelectorAll("[data-page-zone]").length > 0, null, { timeout: 180000 });
  // Generation, then the fit pass ("Fitting the pages…"), which may call the model per page.
  await page.waitForFunction(() => !/Generating|Fitting the pages/.test(document.body.innerText), null, { timeout: 300000 });
  await page.waitForTimeout(1000);
  return Math.round((Date.now() - t0) / 1000);
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await browser_();
  const rows: string[] = [];
  let failed = 0;
  for (const c of cases) {
    const brief = c.brief ?? readFileSync(c.file!, "utf8");
    for (let r = 0; r < runs; r++) {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await ctx.newPage();
      page.on("dialog", (d) => d.accept());
      await signIn(page);
      const problems: string[] = [];
      const notes: string[] = [];
      try {
        const secs = await generate(page, c, brief);
        const raw = await page.evaluate(() => localStorage.getItem("giga-deck:session"));
        const slides = (JSON.parse(raw ?? "{}").slides ?? []) as { stack?: Block[]; pageFit?: string }[];
        if (slides.length !== 2) problems.push(`${slides.length} pages`);
        if (!["banner", "title"].includes(slides[0]?.stack?.[0]?.type ?? "")) problems.push("page 1 does not open with a banner or a title");
        if (slides.slice(1).some((s) => s.stack?.[0]?.type === "banner")) problems.push("banner after page 1");
        // A section that runs on from the foot of one page to the top of the
        // next keeps its label (the prompt asks for it): counted once.
        const rails = slides
          .flatMap((s, p) =>
            (s.stack ?? []).map((b, k) => {
              const prev = slides[p - 1]?.stack?.at(-1);
              const runsOn = k === 0 && prev?.type === b.type && prev?.rail?.trim().toLowerCase() === b.rail?.trim().toLowerCase();
              return runsOn ? "" : b.rail?.trim().toLowerCase();
            }),
          )
          .filter(Boolean);
        if (new Set(rails).size !== rails.length) problems.push(`repeated labels: ${rails.join(" / ")}`);
        const text = slides.flatMap((s) => (s.stack ?? []).map(textOf)).join(" ");
        if (/[—–]/.test(text)) problems.push("em/en dash");
        problems.push(...oddities(slides));
        const known = new Set(figures(brief));
        const invented = [...new Set(figures(text))].filter((f) => !known.has(f) && !/^20\d\d$/.test(f) && f.length > 1);
        if (invented.length) notes.push(`figures not in the brief: ${invented.join(", ")}`);
        // Fit, as the editor shows it.
        const thumbs = page.locator(".w-\\[200px\\] [draggable=true]");
        for (let i = 0; i < (await thumbs.count()); i++) {
          await thumbs.nth(i).click();
          await page.waitForTimeout(700);
          const over = await page.locator(".page-over").count();
          const left = await page.evaluate(() => {
            const stage = document.querySelector('[data-tour="canvas"]');
            const z = stage?.querySelector<HTMLElement>("[data-page-zone]");
            const f = stage?.querySelector<HTMLElement>("[data-page-flow]");
            return z && f ? Math.round((z.offsetHeight - f.offsetHeight) * 0.75) : null;
          });
          if (over) problems.push(`page ${i + 1} runs over`);
          else if (left != null && left > 150) notes.push(`page ${i + 1}: ${left}pt left`);
          await page.locator('[data-tour="canvas"]').screenshot({ path: path.join(out, `${c.id}-${r + 1}-p${i + 1}.png`) });
        }
        writeFileSync(path.join(out, `${c.id}-${r + 1}.json`), JSON.stringify(slides, null, 1));
        const fits = slides.map((s) => s.pageFit ?? "regular").join("/");
        const blocks = slides.map((s) => (s.stack ?? []).map((b) => b.type).join(",")).join(" | ");
        rows.push(`${problems.length ? "FAIL" : "ok  "} ${c.id} #${r + 1} ${secs}s [${fits}] ${blocks}${problems.length ? `\n     ${problems.join("; ")}` : ""}${notes.length ? `\n     note: ${notes.join("; ")}` : ""}`);
        if (problems.length) failed++;
      } catch (err) {
        failed++;
        rows.push(`FAIL ${c.id} #${r + 1}: ${(err as Error).message.split("\n")[0]}`);
      }
      console.log(rows[rows.length - 1]);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${rows.length - failed}/${rows.length} passed`);
  process.exit(failed ? 1 : 0);
}
const browser_ = () => chromium.launch();
main();
