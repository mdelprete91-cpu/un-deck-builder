/**
 * The two-pager golden test: the two Estonia pieces (figma-to-pptx-source/
 * estonia), written as block stacks in tools/twopager-golden.json, drawn by
 * the page renderer and screenshotted, so they can be held up against the
 * PDFs Mario signed off. Also prints how each page sits in its sheet.
 *
 *   npx tsx tools/twopager-golden.ts [out-dir] [brand]
 */
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BRANDS, type BrandId } from "../lib/slides/brand";
import { renderPage } from "../lib/slides/pages/render";
import { normalizeSlide, type Slide } from "../lib/slides/schema";
import { A4_PX } from "../lib/slides/pages/a4";

const out = process.argv[2] ?? "tools/out/twopager";
const brand = (process.argv[3] ?? "inclusion") as BrandId;
const ESTONIA = path.join(process.env.HOME ?? "", "Desktop/figma-to-pptx-source/estonia");

const FONTS = `
@font-face{font-family:'Manrope';font-weight:200 800;src:url(/fonts/manrope-var-normal-latin.woff2) format('woff2');}
@font-face{font-family:'Manrope';font-weight:200 800;src:url(/fonts/manrope-var-normal-latin-ext.woff2) format('woff2');unicode-range:U+0100-024F,U+20AC;}
@font-face{font-family:'Open Sans';font-weight:300 800;src:url(/fonts/open-sans-var-normal-latin.woff2) format('woff2');}
@font-face{font-family:'Open Sans';font-weight:300 800;src:url(/fonts/open-sans-var-normal-latin-ext.woff2) format('woff2');unicode-range:U+0100-024F,U+20AC;}
body{margin:0;background:#888;} .p{margin:0 0 20px;}`;

async function main() {
  const golden = JSON.parse(readFileSync("tools/twopager-golden.json", "utf8")) as Record<string, unknown[]>;
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Math.ceil(A4_PX.w), height: Math.ceil(A4_PX.h) }, deviceScaleFactor: 2 });
  await page.route("http://golden.test/**", async (route) => {
    const url = new URL(route.request().url());
    const file = url.pathname.startsWith("/golden/")
      ? path.join(ESTONIA, url.pathname.slice("/golden/".length))
      : path.join("public", decodeURIComponent(url.pathname));
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<html></html>" });
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ path: file });
  });
  await page.goto("http://golden.test/");
  const theme = BRANDS[brand];
  for (const [name, raw] of Object.entries(golden)) {
    const slides = raw.map((s, i) => normalizeSlide({ ...(s as object), id: `${name}-${i}` } as Slide) as Slide);
    for (let i = 0; i < slides.length; i++) {
      const html = renderPage(slides[i], theme, { index: i, total: slides.length });
      await page.setContent(`<html><head><style>${FONTS}</style></head><body>${html}</body></html>`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const fit = await page.evaluate(() => {
        const z = document.querySelector<HTMLElement>("[data-page-zone]")!;
        const f = document.querySelector<HTMLElement>("[data-page-flow]")!;
        return (f.offsetHeight - z.offsetHeight) * 0.75;
      });
      const file = path.join(out, `${name}-${i + 1}.png`);
      await page.locator("section").screenshot({ path: file });
      console.log(`${name} page ${i + 1}: ${fit > 0 ? `OVER by ${fit.toFixed(1)}pt` : `${(-fit).toFixed(1)}pt left`}  ${file}`);
    }
  }
  await browser.close();
}
main();
