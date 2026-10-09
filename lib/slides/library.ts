import { COUNTRY_MAPS } from "./country-maps";

/**
 * The photo library: Giga's own pictures, served from `public/library` at
 * 1920px (JPEG, 82) with 480px thumbnails for the picker grid. A slide
 * stores the path (`image: "/library/<id>.jpg"`), never the pixels, like
 * the placeholder photo and the country maps: the deck stays small, the
 * deck file's SAFE_ASSET check accepts a root path, and the HTML export
 * inlines the file once. The pictures come from the giga.global website
 * export Mario handed over on 24 Sep 2026.
 */
export interface LibraryImage {
  id: string;
  /** What the picker says on hover and screen readers read. */
  label: string;
  /** What is in the picture, for the model (27 Sep 2026: it picks library photos for photo slots). */
  description: string;
  /** The slides it suits, for the model. */
  useFor: string;
  /**
   * The countries the picture shows, when it shows a recognisable place:
   * a slide or card that names another country does not get it (Kenya over
   * the Central Asian steppe, 9 Oct 2026). No places: fits anywhere.
   */
  places?: string[];
}

// Descriptions written from the pictures themselves (27 Sep 2026). The two
// buildings are named by Mario: Ca l'Alier is the Giga Technology Center in
// Barcelona, Campus Biotech the Giga Technology Center in Geneva.
export const LIBRARY: LibraryImage[] = [
  {
    id: "students-tablet",
    label: "Students sharing a tablet on the school steps",
    description: "Four primary pupils in white-and-navy school uniforms sit on concrete steps looking at one tablet together, a UNICEF backpack beside them; bright, cheerful.",
    useFor: "children learning with digital devices, what connectivity brings to pupils, UNICEF's work for children, a hopeful opening",
  },
  {
    id: "laptop-smile",
    label: "A student at a laptop in class",
    description: "A smiling boy in a checked school shirt at a row of laptops in a classroom, other pupils working behind him; warm light, Africa.",
    useFor: "connected classrooms, digital learning, schools that got connected, impact on students",
  },
  {
    id: "tablet-lesson",
    label: "Two students on a tablet",
    description: "Close-up of two girls in face masks working on a tablet at a wooden desk, braided hair, green and red shirts; focused.",
    useFor: "learning on devices, digital content in class, education continuity, girls' access to technology",
  },
  {
    id: "mountain-walk",
    label: "Two children walking to school under the mountains",
    description: "Two small boys in jackets and hats walk across a dry steppe towards the camera, a village and snow-capped mountains behind them; Central Asia.",
    useFor: "rural and remote schools, the last mile, why connectivity is hard to reach, Central Asia or Kazakhstan, equity",
    places: ["Kazakhstan", "Kyrgyzstan", "Tajikistan", "Uzbekistan", "Turkmenistan"],
  },
  {
    id: "health-centre",
    label: "A mother and child at a health centre",
    description: "A mother holds her smiling toddler at a rural health centre; two nurses in white work at a desk with a laptop behind them; Southeast Asia.",
    useFor: "health facilities, connecting clinics, health workers, mothers and children, the health-facility mapping work",
    places: ["Cambodia", "Lao PDR", "Laos", "Viet Nam", "Vietnam", "Thailand", "Philippines", "Indonesia", "Myanmar", "Timor-Leste", "Malaysia"],
  },
  {
    id: "kazakhstan-forum",
    label: "Giga Maps on stage, Kazakhstan",
    description: "A speaker on stage in front of a large screen showing the Giga Maps connectivity map of Kazakhstan, audience in the foreground.",
    useFor: "Giga Maps, the connectivity map, data and mapping, Kazakhstan, presenting results to governments",
    places: ["Kazakhstan"],
  },
  {
    id: "connectivity-forum",
    label: "Giga Connectivity Forum, ITU",
    description: "Nine speakers on stage at the Giga Connectivity Forum 2024 at ITU hold coloured signs: Connect every school, Destination 2030, Opportunity for every child, I love Giga.",
    useFor: "partnerships and coalitions, events and convening, the 2030 goal, global commitment, a closing or rallying slide",
    places: ["Switzerland"],
  },
  {
    id: "panel-talk",
    label: "A panel at a Giga event",
    description: "Three panellists seated on stage, a man in a suit speaking into a microphone, a Giga banner behind them.",
    useFor: "policy dialogue, events, speakers and advocacy, conversations with partners",
  },
  {
    id: "roundtable",
    label: "A roundtable at ITU",
    description: "People around a meeting table at ITU with laptops, an 'Understand infrastructure' banner behind; formal working session.",
    useFor: "governance, steering committees, government and partner meetings, infrastructure planning, decisions",
    places: ["Switzerland"],
  },
  {
    id: "sri-lanka-workshop",
    label: "A workshop over the Sri Lanka maps",
    description: "A team in a workshop room looks at connectivity maps of Sri Lanka on a screen, a blackboard of notes behind them.",
    useFor: "workshops, capacity building, working with ministries on data, Sri Lanka, collaborative mapping",
    places: ["Sri Lanka"],
  },
  {
    id: "learning-hub",
    label: "The Giga Learning Hub",
    description: "Four colleagues at a table of laptops and cables, one standing and pointing at a screen; hands-on technical work.",
    useFor: "training, the learning hub, technical teams, data engineering, hands-on work",
  },
  {
    id: "ca-lalier",
    label: "Giga Technology Center, Barcelona",
    description: "Ca l'Alier, a restored red-brick industrial building with green walls of plants and a courtyard: the Giga Technology Center in Barcelona.",
    useFor: "only when the slide is about the Giga Technology Center in Barcelona, the Barcelona team or office",
    places: ["Spain"],
  },
  {
    id: "campus-biotech",
    label: "Giga Technology Center, Geneva",
    description: "Campus Biotech, a large glass building in Geneva under a blue sky: the Giga Technology Center in Geneva.",
    useFor: "only when the slide is about the Giga Technology Center in Geneva, the Geneva team or office",
    places: ["Switzerland"],
  },
];

/**
 * Photos of children, the fallback for any photo slot the model left empty
 * (Mario, 27 Sep 2026: the AI-generated placeholder is never to be shown).
 * Handed out in turn so a deck does not repeat one picture.
 */
export const CHILDREN_PHOTOS = ["students-tablet", "laptop-smile", "tablet-lesson", "mountain-walk", "health-centre"];

/** The picture an empty photo slot shows: a photo of children, never the AI placeholder. */
export const DEFAULT_PHOTO = "/library/students-tablet.jpg";

/**
 * Fills every empty photo slot with a children photo the deck does not use
 * yet, cycling when all are taken. The model's own picks and the user's
 * uploads are left as they are.
 */
export function fillPhotos<T extends { layoutId: string; image?: string; map?: string }>(slides: T[]): T[] {
  const used = new Set(slides.map((s) => s.image).filter(Boolean));
  const all = CHILDREN_PHOTOS.map(librarySrc);
  let k = 0;
  const next = (text: string) => {
    const pool = all.filter((p) => photoFits(p, text));
    const pick = pool.find((p) => !used.has(p)) ?? pool[k++ % pool.length];
    used.add(pick);
    return pick;
  };
  return slides.map((s) => (PHOTO_LAYOUTS.has(s.layoutId) && !s.image && !s.map ? { ...s, image: next(slideWords(s)) } : s));
}

/**
 * The same for a two-pager: every photo card and every photo figure left
 * empty gets a children photo the piece does not use yet. The banner keeps
 * its own default (the data strip), and a figure with a map is a map.
 */
export function fillPagePhotos<T extends { stack?: { type: string; image?: string; map?: string; items?: { image?: string }[] }[] }>(pages: T[]): T[] {
  const used = new Set<string>();
  for (const p of pages)
    for (const b of p.stack ?? []) {
      if (b.image) used.add(b.image);
      for (const it of b.items ?? []) if (it.image) used.add(it.image);
    }
  const all = CHILDREN_PHOTOS.map(librarySrc);
  let k = 0;
  const next = (text: string) => {
    const pool = all.filter((p) => photoFits(p, text));
    const pick = pool.find((p) => !used.has(p)) ?? pool[k++ % pool.length];
    used.add(pick);
    return pick;
  };
  return pages.map((p) => ({
    ...p,
    stack: p.stack?.map((b) =>
      b.type === "photos"
        ? { ...b, items: b.items?.map((it) => (it.image ? it : { ...it, image: next(slideWords(it)) })) }
        : b.type === "figure" && !b.image && !b.map
          ? { ...b, image: next(slideWords(b)) }
          : b,
    ),
  }));
}

/** The slides whose layout has a photo slot the model may fill from the library. */
export const PHOTO_LAYOUTS = new Set<string>([
  "callout",
  "example-image-left",
  "example-image-right",
  "section-image-deep",
  "section-image-light",
  "photo",
]);

/** A model's photo choice as a slide image path, or undefined for an unknown id. */
/**
 * The library path for a photo id the model wrote, or undefined. Tolerant of
 * the spellings it drifts into ("Kazakhstan_forum", "/library/x.jpg"): a
 * missed id left the slot to the children fallback under a caption about
 * another picture (9 Oct 2026).
 */
export const libraryPhoto = (id: unknown): string | undefined => {
  if (typeof id !== "string") return undefined;
  const key = id
    .trim()
    .toLowerCase()
    .replace(/^.*\//, "")
    .replace(/\.jpe?g$/, "")
    .replace(/[\s_]+/g, "-");
  return LIBRARY.some((l) => l.id === key) ? librarySrc(key) : undefined;
};

/** Countries a brief often names that have no Giga map export, so photoFits sees them too. */
const MORE_COUNTRIES = [
  "Nigeria", "Uganda", "Burundi", "Cameroon", "Chad", "Mali", "Burkina Faso", "Côte d'Ivoire", "Ivory Coast", "Togo",
  "Somalia", "Sudan", "South Sudan", "Egypt", "Morocco", "Tunisia", "Algeria", "Madagascar", "Angola", "Congo",
  "DRC", "Afghanistan", "Pakistan", "India", "Bangladesh", "Nepal", "Bhutan", "China", "Japan", "Korea",
  "Colombia", "Peru", "Ecuador", "Bolivia", "Chile", "Argentina", "Paraguay", "Uruguay", "Venezuela", "Nicaragua",
  "Costa Rica", "Haiti", "Jamaica", "Cuba", "Ukraine", "Georgia", "Armenia", "Azerbaijan", "Turkey", "Türkiye",
  "Jordan", "Lebanon", "Syria", "Iraq", "Yemen", "Estonia", "Italy", "France", "Germany", "United Kingdom",
  "United States", "Canada", "Papua New Guinea", "Vanuatu", "Samoa", "Tonga",
];

const PLACES = new Map(LIBRARY.filter((l) => l.places).map((l) => [librarySrc(l.id), l.places!]));
const COUNTRY_RE = new RegExp(
  `\\b(?:${[...new Set([...COUNTRY_MAPS.map((c) => c.name), ...MORE_COUNTRIES, ...LIBRARY.flatMap((l) => l.places ?? [])])]
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "gi",
);

/** The countries a piece of text names, lower-cased. */
export function countriesIn(text: string): string[] {
  return [...new Set((text.match(COUNTRY_RE) ?? []).map((m) => m.toLowerCase()))];
}

/**
 * False when the picture shows a place and the text names countries that
 * are not it: a photo of the steppe under "Kenya", a Sri Lanka workshop
 * under "Rwanda". A text that names no country takes any picture.
 */
export function photoFits(src: string | undefined, text: string): boolean {
  const places = src ? PLACES.get(src) : undefined;
  if (!places) return true;
  const named = countriesIn(text);
  return !named.length || named.some((n) => places.some((p) => p.toLowerCase() === n));
}

/** A slide's own words, for photoFits: everything but paths and ids. */
export function slideWords(s: object): string {
  return JSON.stringify(s, (k, v) => (k === "image" || k === "photo" || k === "id" || k === "layoutId" ? undefined : v));
}

export function librarySrc(id: string) {
  return `/library/${id}.jpg`;
}
export const libraryThumb = (id: string) => `/library/thumbs/${id}.jpg`;

/** True for an image path that points into the library. */
export const isLibraryImage = (src: string | undefined) => !!src && /^\/library\/[\w-]+\.jpg$/.test(src);
