/**
 * A replica checked against its source by eye, locally (lib/slides/replica-check.ts):
 *
 *   npx tsx tools/replica-compare.ts <source.pptx|source.pdf> <result.pdf> [--url http://localhost:3777]
 *
 * The source is drawn as it is (LibreOffice turns a PowerPoint into a PDF,
 * PyMuPDF draws the pages), the result from the deck's PDF export, each as a
 * contact sheet of numbered tiles (written next to the result as
 * *.source-sheet.jpg and *.result-sheet.jpg), then both go to
 * /api/replica-check, the route the editor uses. One model call.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const [src, res] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const url = process.argv.find((a, i) => process.argv[i - 1] === "--url") ?? process.env.QA_URL ?? "http://localhost:3777";
if (!src || !res) {
  console.error("usage: npx tsx tools/replica-compare.ts <source.pptx|source.pdf> <result.pdf> [--url …]");
  process.exit(1);
}
const SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";

function toPdf(file: string): string {
  if (/\.pdf$/i.test(file)) return file;
  const out = mkdtempSync(join(tmpdir(), "replica-"));
  execFileSync(SOFFICE, ["--headless", "--convert-to", "pdf", "--outdir", out, file], { stdio: "ignore" });
  const pdf = join(out, basename(file).replace(/\.[^.]+$/, ".pdf"));
  if (!existsSync(pdf)) throw new Error(`LibreOffice could not convert ${file}`);
  return pdf;
}

/** The pages as a grid of numbered tiles, JPEG; returns the path and the page count. */
function sheet(pdf: string, out: string): { path: string; pages: number } {
  const py = `
import sys, fitz
from PIL import Image, ImageDraw, ImageFont
d = fitz.open(sys.argv[1]); W = 360
tiles = []
for p in d:
    pix = p.get_pixmap(matrix=fitz.Matrix(W / p.rect.width, W / p.rect.width))
    tiles.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
cols = 4 if len(tiles) > 6 else 3
h = max(t.height for t in tiles); gap = 14
rows = (len(tiles) + cols - 1) // cols
S = Image.new("RGB", (cols * (W + gap) + gap, rows * (h + gap) + gap), (200, 200, 200))
dr = ImageDraw.Draw(S)
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
except Exception: font = ImageFont.load_default()
for i, t in enumerate(tiles):
    x = gap + (i % cols) * (W + gap); y = gap + (i // cols) * (h + gap)
    S.paste(t, (x, y))
    dr.rectangle([x, y, x + 40, y + 30], fill=(220, 0, 60))
    dr.text((x + 8, y + 3), str(i + 1), fill=(255, 255, 255), font=font)
S.save(sys.argv[2], "JPEG", quality=72)
print(len(tiles))
`;
  const pages = Number(execFileSync("python3", ["-c", py, pdf, out], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().split("\n").pop());
  return { path: out, pages };
}

async function main() {
  const base = res.replace(/\.pdf$/i, "");
  const a = sheet(toPdf(src), `${base}.source-sheet.jpg`);
  const b = sheet(res, `${base}.result-sheet.jpg`);
  console.log(`source: ${a.pages} pages, result: ${b.pages} slides (sheets: ${a.path}, ${b.path})`);
  const dataUrl = (p: string) => `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
  const r = await fetch(`${url}/api/replica-check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: dataUrl(a.path), result: dataUrl(b.path) }) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const { problems, usage } = (await r.json()) as { problems: { source: number; result: number[]; kind: string; detail: string; fix: string }[]; usage: { inputTokens: number; outputTokens: number } };
  for (const p of problems) console.log(`- [${p.kind}] source ${p.source} → result ${p.result.join(", ")}: ${p.detail}\n    fix: ${p.fix}`);
  if (!problems.length) console.log("No problems: every page kept its shape.");
  console.log(`cost ≈ $${((usage.inputTokens * 0.1 + usage.outputTokens * 0.5) / 1e6).toFixed(4)} (${usage.inputTokens} in, ${usage.outputTokens} out)`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
