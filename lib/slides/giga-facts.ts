import HEADLINE from "@/kb/giga-facts.json";
/**
 * Giga's own facts, in one place, each with where it comes from and when it
 * was last read (Mario, 12 Oct 2026: the two prompts carried two hand-written
 * copies, with a "146 countries" giga.global never said, and decks about Giga
 * never said it is UNICEF's and ITU's). Both system prompts list them; they
 * are allowed only in a deck the brief makes about Giga. Mapped, monitored and
 * connected schools are three different figures. Re-read the source before
 * changing one, and move the date. Since 13 Oct 2026 the figures are read
 * weekly (kb/giga-facts.json); a change reaches decks only through the pull
 * request Mario merges.
 */
export interface GigaFact {
  fact: string;
  source: string;
  verified: string;
}

/**
 * The headline figures come from giga.global through the knowledge base
 * (kb/giga-facts.json, refreshed by the weekly pull request, Mario 13 Oct
 * 2026); the sentences that do not change stay written here. "Monitored, not
 * connected" stays beside the real-time figure: the easiest one to misread.
 */
const READ = (HEADLINE as { source: string; read: string; figures: { value: string; label: string }[] });
const note = (label: string) => (/real-time connectivity/i.test(label) ? `${label} (monitored, not connected)` : label);

export const GIGA_FACTS: GigaFact[] = [
  { fact: "Giga is a joint partnership between UNICEF and ITU, established in 2019, to connect every school to the internet", source: "giga.global", verified: READ.read },
  ...READ.figures.map((f) => ({ fact: `${f.value} ${note(f.label)}`, source: READ.source, verified: READ.read })),
  { fact: "website giga.global", source: "giga.global", verified: READ.read },
];

/**
 * Giga's four pillars by name: without them decks about Giga wrote "Map,
 * Model, Monitor" and "Mappare, Monitorare, Connettere" (18 Oct 2026, read on
 * giga.global that day). They reach the model only when the brief, the
 * answers or the material name Giga (pillarsNote in prompt.ts): in the shared
 * facts line they turned up in five decks of the gate that never named Giga.
 */
export const GIGA_PILLARS: GigaFact = {
  fact: "Giga works in four pillars, in this order: Map (identify schools and monitor their connectivity in real time), Model (the infrastructure and investment needed), Finance (mobilise capital through innovative instruments and partnerships), Contract (streamline public procurement); Capacity Development runs across them",
  source: "giga.global",
  verified: "2026-10-18",
};

/** The facts as the prompts list them, in one line. */
export const GIGA_FACTS_LINE = GIGA_FACTS.map((f) => f.fact).join("; ");
