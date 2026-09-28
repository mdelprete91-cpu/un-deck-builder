/**
 * Records one help video: drives the real editor on localhost:3777 with
 * Playwright at 1920x1080, scene by scene, each scene as long as its
 * voice-over clip (tools/help-video/voice.ts), with a camera zoom and a
 * visible cursor. Generation and the file questions are recorded once
 * from the real routes and replayed afterwards (.omc/help-video/fixtures),
 * so a re-record costs nothing and looks the same.
 *
 *   npx tsx tools/help-video/record.ts create|edit
 * Writes .omc/help-video/raw/<video>.webm and <video>.timeline.json.
 */
import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STAGE_JS } from "./stage";
import { ensureId, normalizeSlide, type SlideContent } from "../../lib/slides/schema";
import { defaultContent } from "../../lib/slides/defaults";

const APP_URL = process.env.HELP_URL ?? "http://localhost:3777";
const ROOT = ".omc/help-video";
const video = process.argv[2] as "create" | "edit";
if (video !== "create" && video !== "edit") throw new Error("usage: record.ts create|edit");

type Scene = { id: string; chapter: string; text: string };
const script = JSON.parse(readFileSync("tools/help-video/script.json", "utf8"))[video] as { scenes: Scene[] };
const durations = Object.fromEntries(script.scenes.map((s) => [s.id, JSON.parse(readFileSync(join(ROOT, "voice", `${video}-${s.id}.json`), "utf8")).duration as number]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- fixtures: record once, replay after ----------
mkdirSync(join(ROOT, "fixtures"), { recursive: true });
const counters: Record<string, number> = {};
async function mock(page: Page) {
  for (const path of ["/api/generate", "/api/analyze"]) {
    await page.route(`**${path}`, async (route) => {
      const body = route.request().postDataJSON() as { mode?: string; kind?: string };
      const tag = `${video}-${path.split("/").pop()}-${body.mode ?? body.kind ?? "x"}`;
      const n = (counters[tag] = (counters[tag] ?? 0) + 1);
      const file = join(ROOT, "fixtures", `${tag}-${n}.txt`);
      if (existsSync(file)) {
        const [type, ...rest] = readFileSync(file, "utf8").split("\n");
        return route.fulfill({ status: 200, contentType: type, body: rest.join("\n") });
      }
      const res = await route.fetch();
      const text = await res.text();
      writeFileSync(file, `${res.headers()["content-type"] ?? "application/json"}\n${text}`);
      return route.fulfill({ status: res.status(), contentType: res.headers()["content-type"], body: text });
    });
  }
}

/**
 * Replay in the page: a recorded generation streams back one line (one
 * slide) at a time, so the video shows slides landing as they do live;
 * route.fulfill can only hand the whole body over at once.
 */
function replayFixtures() {
  const map: Record<string, { type: string; lines: string[] }> = {};
  for (const f of readdirSync(join(ROOT, "fixtures"))) {
    if (!f.startsWith(`${video}-`)) continue;
    const [type, ...rest] = readFileSync(join(ROOT, "fixtures", f), "utf8").split("\n");
    map[f.replace(/\.txt$/, "")] = { type, lines: rest.filter(Boolean) };
  }
  return { video, map, gap: 550 };
}
const REPLAY_JS = ({ video, map, gap }: ReturnType<typeof replayFixtures>) => {
  const counters: Record<string, number> = {};
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = url.match(/\/api\/(generate|analyze)$/);
    if (!m || typeof init?.body !== "string") return real(input, init);
    const body = JSON.parse(init.body);
    const tag = `${video}-${m[1]}-${body.mode ?? body.kind ?? "x"}`;
    const n = (counters[tag] = (counters[tag] ?? 0) + 1);
    const fx = map[`${tag}-${n}`];
    if (!fx) return real(input, init);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(c) {
        for (const line of fx.lines) {
          await new Promise((r) => setTimeout(r, m[1] === "generate" ? gap : 400));
          c.enqueue(enc.encode(line + "\n"));
        }
        c.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": fx.type } });
  };
};

// ---------- the deck the edit video starts from ----------
function editDeck() {
  const pick = (id: SlideContent["layoutId"], patch: Partial<SlideContent> = {}) => normalizeSlide({ ...defaultContent(id), ...patch }, { brandId: "did" })!;
  const slides = [
    pick("cover", { title: "Kenya school connectivity", subtitle: "Donor steering committee, 2025" }),
    pick("icon-cards", { title: "What the programme does", blocks: [{ label: "Map", body: "Every school located and verified with the ministry" }, { label: "Monitor", body: "Daily connectivity checks in 4,800 schools" }, { label: "Connect", body: "Fibre, mobile and satellite links" }], icons: ["map-pin", "activity", "wifi"] }),
    pick("example-image-left", { title: "The northern counties", image: "/library/mountain-walk.jpg", blocks: [{ label: "Challenge", body: "Remote schools with no fibre and little power" }, { label: "Plan", body: "900 schools on satellite by June" }] }),
    pick("chart-columns-grouped", { title: "Connected schools, 2024 vs 2025", series: ["2024", "2025"], bars: [{ label: "Nairobi", value: 890, values: [890, 1015] }, { label: "Coast", value: 720, values: [720, 980] }, { label: "Rift Valley", value: 960, values: [960, 1410] }, { label: "Western", value: 610, values: [610, 905] }, { label: "North", value: 120, values: [120, 300] }] }),
    pick("progress", { title: "Where the programme stands", current: 2 }),
    pick("thank-you"),
  ].map((s) => ensureId(s));
  return { version: 2, name: "Kenya connectivity", brandId: "did", format: "slides", brief: "", count: 8, chapters: false, slides, activeIndex: 0, usage: { inputTokens: 0, outputTokens: 0 } };
}

// ---------- helpers ----------
type Stage = {
  moveXY(x: number, y: number): void;
  click(): void;
  zoomRect(r: { x: number; y: number; width: number; height: number }, scale: number): void;
  reset(): void;
  hideCursor(): void;
  showCursor(): void;
};
/** window inside page.evaluate, where STAGE_JS put the stage. */
type StageWindow = { __stage: Stage };
// Selectors are Playwright's; the page only ever gets coordinates.
async function box(page: Page, sel: string) {
  const l = page.locator(sel).first();
  await l.waitFor({ timeout: 8000 });
  await l.scrollIntoViewIfNeeded().catch(() => {});
  return (await l.boundingBox())!;
}
async function moveXY(page: Page, x: number, y: number, ms = 700) {
  await page.evaluate(([a, c]) => (window as unknown as StageWindow).__stage.moveXY(a, c), [x, y] as const);
  await sleep(ms);
}
async function point(page: Page, sel: string, dx = 0.5, dy = 0.5) {
  const b = await box(page, sel);
  await moveXY(page, b.x + b.width * dx, b.y + b.height * dy);
}
async function click(page: Page, sel: string) {
  await point(page, sel);
  await page.evaluate(() => (window as unknown as StageWindow).__stage.click());
  await page.locator(sel).first().click();
  await sleep(250);
}
async function zoom(page: Page, sel: string, scale: number) {
  const b = await box(page, sel);
  await page.evaluate(([r, k]) => (window as unknown as StageWindow).__stage.zoomRect(r, k), [b, scale] as const);
  await sleep(950);
}
async function reset(page: Page) {
  await page.evaluate(() => (window as unknown as StageWindow).__stage.reset());
  await sleep(850);
}
async function thumb(page: Page, i: number) {
  const t = page.locator("div.cursor-grab").nth(i);
  const b = (await t.boundingBox())!;
  await moveXY(page, b.x + b.width / 2, b.y + b.height / 2, 650);
  await page.evaluate(() => (window as unknown as StageWindow).__stage.click());
  await t.click();
  await sleep(600);
}
async function type(page: Page, sel: string, text: string) {
  await page.locator(sel).first().pressSequentially(text, { delay: 32 });
}

// ---------- scenes ----------
type Act = (page: Page) => Promise<void>;
const PROMPT = '[data-tour="prompt"] textarea';
const create: Record<string, Act> = {
  intro: async (p) => { await sleep(1800); await zoom(p, '[data-tour="prompt"]', 1.7); },
  brief: async (p) => { await click(p, PROMPT); await type(p, PROMPT, "Eight slides for the donor steering committee on school connectivity in Kenya in 2025."); },
  attach: async (p) => {
    const chooser = p.waitForEvent("filechooser");
    await click(p, 'button[aria-label="Attach files"]');
    await (await chooser).setFiles([join(ROOT, "kenya-schools-2025.xlsx"), join(ROOT, "kenya-programme-summary.docx")]);
    await sleep(1200);
  },
  chapters: async (p) => { await point(p, '[data-tour="chapters"]'); },
  questions: async (p) => {
    await reset(p);
    await click(p, '[data-tour="generate"]');
    const dlg = '[aria-labelledby="sheet-wizard-title"]';
    await p.locator(dlg).waitFor({ timeout: 30000 });
    await p.locator(`${dlg} [role="radio"], ${dlg} [role="checkbox"]`).first().waitFor({ timeout: 30000 }).catch(() => {});
    await zoom(p, dlg, 1.25);
    for (let k = 0; k < 12 && (await p.locator(dlg).count()); k++) {
      const opt = p.locator(`${dlg} [role="radio"], ${dlg} [role="checkbox"]`).first();
      if (await opt.count()) { await click(p, `${dlg} [role="radio"], ${dlg} [role="checkbox"]`); }
      const next = p.locator(`${dlg} button`).filter({ hasText: /^(Next|Next file|Generate|Done)/ }).first();
      if (!(await next.count())) { await sleep(500); continue; }
      const nb = await next.boundingBox();
      if (nb) await moveXY(p, nb.x + nb.width / 2, nb.y + nb.height / 2, 500);
      await p.evaluate(() => (window as unknown as StageWindow).__stage.click());
      await next.click();
      await sleep(500);
    }
    await reset(p);
  },
  generate: async (p) => {
    await moveXY(p, 1700, 600);
    await p.locator('[data-tour="canvas"]').waitFor({ timeout: 60000 });
    await p.locator('[data-tour="generate"][aria-label="Regenerate deck"]').waitFor({ timeout: 60000 });
    await thumb(p, 0);
  },
  add: async (p) => {
    await reset(p);
    await click(p, 'button:has-text("Generate more slides")');
    const ta = 'textarea[placeholder^="E.g. team structure"]';
    await p.locator(ta).waitFor();
    await zoom(p, ta, 1.3);
    await type(p, ta, "One slide on the risks in the northern counties");
    await click(p, 'div.pop-in button:has-text("Generate")');
    await reset(p);
    await sleep(2500);
    await click(p, '[data-tour="insert"]');
    await sleep(700);
    await click(p, 'button[title="Progress"]');
  },
  present: async (p) => {
    await thumb(p, 0);
    await click(p, 'button[aria-label="Present full screen"]');
    await p.evaluate(() => (window as unknown as StageWindow).__stage.hideCursor());
    await sleep(3200); await p.keyboard.press("ArrowRight"); await sleep(2000);
    await p.keyboard.press("Escape");
    await p.locator('button[aria-label="Close presentation (Esc)"]').click().catch(() => {});
    await p.evaluate(() => (window as unknown as StageWindow).__stage.showCursor());
  },
  download: async (p) => {
    await click(p, 'button:has-text("Download")');
    await zoom(p, 'button:has-text("Download")', 1.8);
    await sleep(3500);
    await p.keyboard.press("Escape");
  },
};
const edit: Record<string, Act> = {
  text: async (p) => {
    await thumb(p, 0);
    const t = '[data-tour="canvas"] [data-edit="title"]';
    await zoom(p, t, 1.4);
    await click(p, t);
    await p.keyboard.press("Meta+A");
    await p.keyboard.type("Kenya connectivity, 2025", { delay: 40 });
    await sleep(500);
    await p.keyboard.press("Tab").catch(() => {});
    await reset(p);
  },
  ai: async (p) => {
    await thumb(p, 1);
    await click(p, 'button:has-text("Edit with AI")');
    const dlg = '[aria-labelledby="edit-ai-title"]';
    await p.locator(dlg).waitFor();
    await click(p, `${dlg} textarea`);
    await type(p, `${dlg} textarea`, "Shorter, and lead with the numbers");
    await sleep(400);
    await point(p, `${dlg} [role="radio"] >> nth=1`);
    await point(p, `${dlg} [role="radio"] >> nth=4`);
    await point(p, `${dlg} [role="radio"] >> nth=5`);
    await click(p, `${dlg} button:has-text("Rewrite")`);
    await sleep(2500);
  },
  images: async (p) => {
    await thumb(p, 2);
    await click(p, '[data-tour="canvas"] img[data-image]');
    await click(p, 'button[role="tab"]:has-text("Library")');
    await sleep(500);
    await click(p, 'button[aria-label="Two students on a tablet"]');
    await sleep(900);
    const img = p.locator('[data-tour="canvas"] img[data-image]').first();
    const b = await img.boundingBox();
    if (b) {
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await moveXY(p, x, y, 600);
      await p.mouse.move(x, y); await p.mouse.down();
      for (let k = 1; k <= 20; k++) { await p.mouse.move(x - k * 6, y - k * 2); await moveXY(p, x - k * 6, y - k * 2, 40); }
      await p.mouse.up();
    }
  },
  icons: async (p) => {
    await thumb(p, 1);
    await zoom(p, '[data-tour="canvas"] [data-icon-pick] >> nth=0', 1.3);
    await click(p, '[data-tour="canvas"] [data-icon-pick] >> nth=0');
    await reset(p);
    const search = 'input[placeholder^="Search icons"]';
    await type(p, search, "school");
    await sleep(500);
    await click(p, 'button[title="school"]');
    await sleep(800);
  },
  charts: async (p) => {
    await thumb(p, 3);
    await click(p, '[data-tour="canvas"] [data-chart]');
    const input = 'input[inputmode="decimal"]';
    await p.locator(input).nth(3).waitFor({ timeout: 5000 });
    await click(p, `${input} >> nth=3`);
    await p.keyboard.press("Meta+A");
    await p.keyboard.type("1180", { delay: 80 });
    await sleep(1400);
    await click(p, 'button[aria-label="Close"]');
  },
  progress: async (p) => {
    await thumb(p, 4);
    await zoom(p, '[data-tour="canvas"] [data-set] >> nth=2', 1.35).catch(() => {});
    await click(p, '[data-tour="canvas"] [data-set="current"] >> nth=2');
    await sleep(1200);
    await reset(p);
  },
  elements: async (p) => {
    await thumb(p, 1);
    await click(p, 'button:has-text("Element")');
    await sleep(700);
    await point(p, '[data-tour="canvas"] [data-item] >> nth=1');
    await p.locator('[data-tour="canvas"] [data-item]').nth(1).hover();
    await sleep(500);
    await click(p, '[data-tour="canvas"] .item-delete >> nth=0');
    await sleep(700);
    await click(p, 'button:has-text("Undo")');
  },
  order: async (p) => {
    const src = p.locator("div.cursor-grab").nth(3);
    const dst = p.locator("div.cursor-grab").nth(1);
    const a = await src.boundingBox(), b = await dst.boundingBox();
    if (a && b) {
      await moveXY(p, a.x + a.width / 2, a.y + a.height / 2);
      await src.dragTo(dst);
      await moveXY(p, b.x + b.width / 2, b.y + b.height / 3, 800);
    }
    await point(p, 'button[aria-label="Present full screen"]');
  },
};

async function main() {
  const rawDir = join(ROOT, "raw", video);
  mkdirSync(rawDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });
  const t0 = Date.now();
  await context.addInitScript(STAGE_JS);
  // Headless full screen shrinks the page to the virtual screen: refused,
  // the presenter covers the window instead, as it does in any browser that
  // says no.
  await context.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error("no")); });
  if (video === "edit") {
    const deck = editDeck();
    await context.addInitScript((d) => { try { localStorage.setItem("giga-deck:session", d); } catch {} }, JSON.stringify(deck));
  }
  await context.addInitScript(REPLAY_JS, replayFixtures());
  // The Next.js dev badge is not part of the product.
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style");
      st.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(st);
    });
  });
  const page = await context.newPage();
  await mock(page);
  await page.goto(APP_URL);
  await page.locator('[data-tour="prompt"]').waitFor();
  await sleep(1500);
  if (video === "edit") {
    await page.locator("button", { hasText: /^Open$/ }).first().click();
    await sleep(1500);
  }
  const acts = video === "create" ? create : edit;
  const timeline: { id: string; chapter: string; start: number; duration: number }[] = [];
  for (const s of script.scenes) {
    const start = (Date.now() - t0) / 1000;
    const d = durations[s.id];
    try { await acts[s.id](page); } catch (e) { console.warn(`${s.id}: ${(e as Error).message.split("\n")[0]}`); }
    const left = start + d + 0.5 - (Date.now() - t0) / 1000;
    if (left > 0) await sleep(left * 1000);
    timeline.push({ id: s.id, chapter: s.chapter, start, duration: d });
    console.log(`${s.id} ${start.toFixed(1)}s (+${d.toFixed(1)}s voice, took ${((Date.now() - t0) / 1000 - start).toFixed(1)}s)`);
  }
  await sleep(1000);
  const end = (Date.now() - t0) / 1000;
  await context.close();
  await browser.close();
  const webm = readdirSync(rawDir).filter((f) => f.endsWith(".webm")).map((f) => join(rawDir, f)).pop()!;
  renameSync(webm, join(ROOT, "raw", `${video}.webm`));
  writeFileSync(join(ROOT, "raw", `${video}.timeline.json`), JSON.stringify({ end, timeline }, null, 1));
  console.log("recorded", join(ROOT, "raw", `${video}.webm`));
}
main();
