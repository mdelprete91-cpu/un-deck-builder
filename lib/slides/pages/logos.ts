/**
 * Programme logos a two-pager carries at the top right of its first page,
 * where the date goes otherwise (Mario, 7 Oct 2026: Songbird's two-pager has
 * the Songbird logo there). One entry per logo we ship, under
 * public/logos/programmes. A piece about the programme gets its logo by
 * itself: the brief or an attached file names it (`logoFor`). The user can
 * also pick one, upload one, or remove it on the page.
 */
export interface ProgrammeLogo {
  id: string;
  name: string;
  src: string;
  /** Words that name the programme in a brief or a document, as whole words. */
  names: string[];
}

export const PROGRAMME_LOGOS: ProgrammeLogo[] = [
  // Traced from the 136 px raster in the Songbird two-pager (no vector source
  // yet); songbird.png beside it is the raster itself.
  { id: "songbird", name: "Songbird", src: "/logos/programmes/songbird.svg", names: ["Songbird"] },
];

/** The logo of the programme a text is about, when it names one we have. */
export function logoFor(text: string): ProgrammeLogo | undefined {
  return PROGRAMME_LOGOS.find((l) => l.names.some((n) => new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "iu").test(text)));
}
