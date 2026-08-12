import { z } from "zod";
import { isBrandId } from "./brand";
import { isCountryMap } from "./country-maps";
import { ensureId, normalizeSlide } from "./schema";
import type { Slide, SlideContent } from "./schema";
import type { DeckState } from "./state";

/**
 * The deck file format. The exported HTML deck doubles as the project file:
 * it carries the deck's data model in an inert JSON block so the builder can
 * reopen it and carry on editing. Both halves of the contract live here on
 * purpose — a format whose writer and reader sit in different modules drifts.
 *
 * The localStorage `VERSION` in storage.ts is a separate counter with a
 * different trust model (we wrote it, this tab, seconds ago). Do not merge them.
 */

export const DECK_FILE_VERSION = 1;
const FORMAT = "giga-deck";

const OPEN = `<script id="giga-deck-state" type="application/json">`;
const CLOSE = "</script>";

/** Slides beyond this are a corrupt or hostile file, not a deck someone made. */
const MAX_SLIDES = 200;

/**
 * Data URLs (what an upload becomes) and app-relative paths. Anything else in
 * an `image` or a `logos` value came from a hand-edited file and is dropped:
 * renderers put these straight into a `src`, and SlideFrame injects the markup
 * with innerHTML, which does not run <script> but does wire `onerror`.
 */
const SAFE_ASSET = /^(data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*|\/[\w./-]*)$/i;

const envelopeSchema = z.object({
  format: z.literal(FORMAT),
  version: z.number(),
  deck: z.object({
    brandId: z.unknown().optional(),
    brief: z.string().optional(),
    count: z.number().optional(),
    chapters: z.boolean().optional(),
    activeIndex: z.number().optional(),
    slides: z.array(z.unknown()),
  }),
});

export type DeckFileResult =
  | { ok: true; state: Partial<DeckState>; dropped: number }
  | { ok: false; message: string };

/**
 * The JSON block to embed in an exported deck.
 *
 * `usage` is deliberately left out: the token cost belongs to the session that
 * spent it, so reopening a colleague's deck must not inflate your readout.
 */
export function deckStateScript(state: DeckState): string {
  const payload = {
    format: FORMAT,
    version: DECK_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    deck: {
      brandId: state.brandId,
      brief: state.brief,
      count: state.count,
      chapters: state.chapters,
      activeIndex: state.activeIndex,
      slides: state.slides,
    },
  };
  // In JSON a `<` can only occur inside a string, so escaping every one of them
  // is lossless (JSON.parse restores the character) and it removes the only two
  // sequences that could end the script block: `</script` and `<!--`.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `${OPEN}${json}${CLOSE}`;
}

/** Drop an asset field that did not come from an upload, keeping the slide. */
function safeAssets(slide: SlideContent): void {
  if (slide.image !== undefined && !SAFE_ASSET.test(slide.image)) delete slide.image;
  // A map is a slug we resolve to a path we own, so it only has to be one we
  // actually ship: a file from an older build can name a country we dropped.
  if (slide.map !== undefined && !isCountryMap(slide.map)) delete slide.map;
  if (slide.logos) {
    for (const [slug, src] of Object.entries(slide.logos)) {
      if (!SAFE_ASSET.test(src)) delete slide.logos[slug];
    }
  }
}

/**
 * Read a deck out of an exported HTML file. Everything here is untrusted input:
 * validate, drop what cannot be read, and never throw.
 */
export function parseDeckFile(html: string): DeckFileResult {
  const start = html.indexOf(OPEN);
  if (start === -1) {
    return {
      ok: false,
      message:
        "There is no deck data in this file. Only an HTML deck exported from here can be reopened, older exports can be presented but not edited again.",
    };
  }
  // The payload carries no literal `<`, so the first `</script>` after the
  // marker is its terminator.
  const from = start + OPEN.length;
  const end = html.indexOf(CLOSE, from);

  const damaged = {
    ok: false as const,
    message:
      "This deck file is damaged and can't be read. Try exporting it again from the session it came from.",
  };
  if (end === -1) return damaged;

  let envelope: z.infer<typeof envelopeSchema>;
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(html.slice(from, end)));
    if (!parsed.success) return damaged;
    envelope = parsed.data;
  } catch {
    return damaged;
  }

  if (envelope.version > DECK_FILE_VERSION) {
    return {
      ok: false,
      message:
        "This deck file was made with a newer version of the builder. Reload the page to update, then open it again.",
    };
  }

  const raw = envelope.deck;
  const slides: Slide[] = [];
  let dropped = 0;
  for (const item of raw.slides.slice(0, MAX_SLIDES)) {
    // The user's own wording wins on the closing slide: this file is their
    // output, not the model's.
    const content = normalizeSlide(item, { keepClosingTitle: true });
    if (!content) {
      dropped++;
      continue;
    }
    safeAssets(content);
    slides.push(ensureId(content));
  }
  dropped += Math.max(0, raw.slides.length - MAX_SLIDES);

  if (slides.length === 0) {
    return {
      ok: false,
      message:
        "No slides in this file could be read. It may have been edited by hand, or made by a different version of the builder.",
    };
  }

  const state: Partial<DeckState> = {
    slides,
    activeIndex: Math.min(Math.max(0, Math.trunc(raw.activeIndex ?? 0)), slides.length - 1),
    brief: raw.brief ?? "",
    count: Math.min(20, Math.max(1, Math.trunc(raw.count ?? 8))),
    chapters: raw.chapters ?? true,
  };
  // An unknown brand leaves the current one alone rather than picking for the user.
  if (isBrandId(raw.brandId)) state.brandId = raw.brandId;

  return { ok: true, state, dropped };
}
