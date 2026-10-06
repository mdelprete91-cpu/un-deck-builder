import { tokens } from "../fidelity";
import type { SlideContent } from "../schema";
import type { PageItem } from "./schema";
import { undash } from "./schema";

/**
 * A two-pager replica's safety net (6 Oct 2026), the page twin of
 * lib/slides/restore.ts: the model drops whole paragraphs of a long document
 * now and then, whatever the prompt says, and a second pass does not always
 * bring them back. Every source line the fidelity check found missing goes
 * back as a paragraph, after the nearest line before it in the source that
 * the piece does carry, in the same section. No model call.
 */

/** Where a text sits in the piece: page, block, item. */
interface Spot {
  page: number;
  block: number;
  item: number;
}

const key = (text: string) => tokens(text).join(" ");

/** The section item that carries this source line, by its opening words. */
function find(pages: SlideContent[], line: string): Spot | null {
  const head = tokens(line).slice(0, 8).join(" ");
  if (!head) return null;
  for (let p = 0; p < pages.length; p++) {
    const stack = pages[p].stack ?? [];
    for (let b = 0; b < stack.length; b++) {
      const items = stack[b].items ?? [];
      for (let i = 0; i < items.length; i++) {
        if (key(`${items[i].label} ${items[i].body}`).includes(head)) return { page: p, block: b, item: i };
      }
    }
  }
  return null;
}

/** The last text item of the last section of the piece: where a line with no anchor goes. */
function lastSection(pages: SlideContent[]): Spot | null {
  for (let p = pages.length - 1; p >= 0; p--) {
    const stack = pages[p].stack ?? [];
    for (let b = stack.length - 1; b >= 0; b--) {
      if (stack[b].type === "section") return { page: p, block: b, item: (stack[b].items?.length ?? 1) - 1 };
    }
  }
  return null;
}

/**
 * Put every missing line back. `order` is the source's lines in reading
 * order (SourceUnits.lines), `missing` the ones the check did not find.
 * Returns the pages and how many lines went back.
 */
export function putBackLines(pages: SlideContent[], order: string[], missing: string[]): { pages: SlideContent[]; putBack: number } {
  const out = structuredClone(pages);
  const gone = new Set(missing);
  let putBack = 0;
  // Lines already placed by this pass become anchors for the next ones, so a
  // run of missing paragraphs comes back in its own order.
  for (let k = 0; k < order.length; k++) {
    const line = order[k];
    if (!gone.has(line)) continue;
    let spot: Spot | null = null;
    for (let j = k - 1; j >= 0 && !spot; j--) {
      const s = find(out, order[j]);
      // Only into a section: a stat card or a table row cannot hold a paragraph.
      if (s && out[s.page].stack![s.block].type === "section") spot = s;
    }
    spot ??= lastSection(out);
    if (!spot) continue;
    const items = (out[spot.page].stack![spot.block].items ??= []);
    const para: PageItem = { kind: "para", label: "", body: undash(line.replace(/^-\s+/, "")), extra: "" };
    if (/^-\s/.test(line)) para.kind = "bullet";
    items.splice(spot.item + 1, 0, para);
    putBack++;
  }
  return { pages: out, putBack };
}
