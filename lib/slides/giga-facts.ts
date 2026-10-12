/**
 * Giga's own facts, in one place, each with where it comes from and when it
 * was last read (Mario, 12 Oct 2026: the two prompts carried two hand-written
 * copies, with a "146 countries" giga.global never said, and decks about Giga
 * never said it is UNICEF's and ITU's). Both system prompts list them; they
 * are allowed only in a deck the brief makes about Giga. Mapped, monitored and
 * connected schools are three different figures. Re-read the source before
 * changing one, and move the date.
 */
export interface GigaFact {
  fact: string;
  source: string;
  verified: string;
}

export const GIGA_FACTS: GigaFact[] = [
  { fact: "Giga is a joint partnership between UNICEF and ITU, established in 2019, to connect every school to the internet", source: "giga.global", verified: "2026-10-12" },
  { fact: "2.2M+ schools mapped", source: "giga.global", verified: "2026-10-12" },
  { fact: "136K+ schools reporting real-time connectivity (monitored, not connected)", source: "giga.global", verified: "2026-10-12" },
  { fact: "54 countries engaged with Giga", source: "giga.global", verified: "2026-10-12" },
  { fact: "21 countries where mapping and modeling has been completed", source: "giga.global", verified: "2026-10-12" },
  { fact: "website giga.global", source: "giga.global", verified: "2026-10-12" },
];

/** The facts as the prompts list them, in one line. */
export const GIGA_FACTS_LINE = GIGA_FACTS.map((f) => f.fact).join("; ");
