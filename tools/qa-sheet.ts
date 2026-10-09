/**
 * Contact sheets for a QA run: every deck of a tools/qa-suite.ts output
 * folder drawn slide by slide (renderSlide plus the autofit pass, fonts and
 * library photos from the dev server) into one PNG per deck, for a look at
 * what the checks cannot see (cut text, empty charts, odd photos).
 *
 *   npx tsx tools/qa-sheet.ts .omc/qa/<timestamp>
 *
 * Needs the dev server on localhost:3777 for fonts and photos.
 */
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderSlide } from "../lib/slides/layouts";
import { BRANDS } from "../lib/slides/brand";
import { AUTOFIT_JS } from "../lib/slides/autofit";
import { ensureId, type SlideContent } from "../lib/slides/schema";

const URL = process.env.QA_URL ?? "http://localhost:3777";
const dir = process.argv[2];
if (!dir) throw new Error("usage: qa-sheet.ts <qa output folder>");

const FONTS = `
@font-face{font-family:Manrope;font-weight:200 800;src:url(/fonts/manrope-var-normal-latin.woff2) format("woff2")}
@font-face{font-family:"Open Sans";font-weight:300 800;src:url(/fonts/open-sans-var-normal-latin.woff2) format("woff2")}`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2048, height: 1080 } });
  await p.goto(`${URL}/login`);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; slides: SlideContent[] };
    const theme = BRANDS.did;
    const cells = r.slides
      .map((s, i) => `<div class="cell"><div class="slide">${renderSlide(ensureId(s), theme)}</div><div class="n">${i + 1} · ${s.layoutId}</div></div>`)
      .join("");
    const cols = 4;
    const html = `<!doctype html><html><head><base href="${URL}/"><style>${FONTS}
body{margin:0;background:#2a2a2a;font-family:system-ui}
.grid{display:grid;grid-template-columns:repeat(${cols},480px);gap:16px;padding:16px}
.cell{width:480px}.slide{width:1920px;height:1080px;transform:scale(.25);transform-origin:0 0;margin-bottom:-810px;overflow:hidden;background:#fff}
.n{color:#ddd;font-size:13px;margin-top:4px}</style></head><body><div class="grid">${cells}</div><script>${AUTOFIT_JS}</script></body></html>`;
    await p.setContent(html, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    const out = join(dir, `${r.id}.png`);
    await p.locator(".grid").screenshot({ path: out });
    console.log("sheet", out);
  }
  await b.close();
})();
