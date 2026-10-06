/**
 * Names that must survive translation: divisions, products, initiatives
 * (Mario, 6 Oct 2026: "UNICEF DID" must never be translated). Sends the
 * texts of tools/qa-names.json to /api/translate (dev server on 3777) for
 * each language and reports every name that does not come back as written.
 *
 *   npx tsx tools/qa-names.ts [runs]
 */
import { readFileSync } from "node:fs";

const { names, texts } = JSON.parse(readFileSync("tools/qa-names.json", "utf8")) as { names: string[]; texts: string[] };
const runs = Number(process.argv[2] ?? 1);

async function main() {
  let lost = 0;
  let total = 0;
  for (const to of ["es", "fr", "pt"]) {
    for (let r = 0; r < runs; r++) {
      const res = await fetch("http://localhost:3777/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "en", to, items: texts.map((text, i) => ({ id: String(i), text })) }),
      });
      const { items } = (await res.json()) as { items: { id: string; text: string }[] };
      const out = new Map(items.map((x) => [Number(x.id), x.text]));
      texts.forEach((src, i) => {
        // Longest names first, each counted once per text.
        let rest = src;
        for (const n of [...names].sort((a, b) => b.length - a.length)) {
          if (!rest.includes(n)) continue;
          rest = rest.split(n).join(" ");
          total++;
          const got = out.get(i) ?? "";
          if (!got.includes(n)) {
            lost++;
            console.log(`${to}: "${n}" lost in: ${got}`);
          }
        }
      });
    }
  }
  console.log(`\n${total - lost}/${total} names kept`);
  process.exit(lost ? 1 : 0);
}
main();
