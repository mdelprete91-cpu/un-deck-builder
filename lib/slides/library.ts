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
  // The photo set Mario added on 13 Oct 2026 (UNICEF photos, OneDrive). Places
  // only where the picture itself says it (a flag, a language on the board, a
  // school's name); the rest is described by what it shows.
  {
    id: "steppe-donkey",
    label: "A girl riding a donkey to school, Kyrgyzstan",
    description: "A girl in a teal coat with a school backpack rides a donkey across a dry steppe under a deep blue sky; Kyrgyzstan.",
    useFor: "the journey to school, remote and rural schools, the last mile, Kyrgyzstan or Central Asia",
    places: ["Kyrgyzstan"],
  },
  {
    id: "kyrgyz-computer-lab",
    label: "Pupils in a school computer lab, Kyrgyzstan",
    description: "Two girls in school uniforms smile at a computer screen, boys in red blazers at the next desks, the Kyrgyz flag on the wall.",
    useFor: "computer labs, digital skills, connected schools, Kyrgyzstan",
    places: ["Kyrgyzstan"],
  },
  {
    id: "kyrgyz-teacher-lab",
    label: "A teacher guiding pupils at computers, Kyrgyzstan",
    description: "A teacher in a headscarf leans over two boys typing at computers, a girl in front, the Kyrgyz flag behind.",
    useFor: "teachers, digital skills, training, connected classrooms, Kyrgyzstan",
    places: ["Kyrgyzstan"],
  },
  {
    id: "kyrgyz-school-door",
    label: "Pupils leaving a rural school, Kyrgyzstan",
    description: "A girl and a boy in black uniforms read a book together as they walk out of a small brick school with the Kyrgyz flag on its roof. Portrait.",
    useFor: "rural schools, the school as a place, Kyrgyzstan",
    places: ["Kyrgyzstan"],
  },
  {
    id: "classroom-tablet-pair",
    label: "Two pupils sharing a tablet",
    description: "A boy and a girl in white school shirts look at a tablet together at a classroom desk, classmates behind.",
    useFor: "learning on devices, digital content in class, children learning together",
  },
  {
    id: "steps-tablets-group",
    label: "Pupils with tablets on the school steps",
    description: "A dozen pupils in white shirts sit on school steps in pairs, looking at tablets.",
    useFor: "learning on devices, what connectivity brings to a whole school, children",
  },
  {
    id: "two-women-phone",
    label: "Two young women looking at a phone",
    description: "Two young women in headscarves, one in red, one in black with glasses, smile at a smartphone against a dark wall.",
    useFor: "girls' and women's digital inclusion, mobile access, young people online",
  },
  {
    id: "tent-classroom-visit",
    label: "A visitor among children in a tent classroom",
    description: "A smiling woman in a field vest sits among children at desks in a white tent classroom.",
    useFor: "field visits, education in emergencies, displaced children",
  },
  {
    id: "youth-laptop-lab",
    label: "Young people around a laptop",
    description: "Young men gather round a laptop while one explains something on the screen; a hands-on training room.",
    useFor: "youth digital skills, training, coding, young people",
  },
  {
    id: "girl-tablet-pink",
    label: "A girl using a tablet in class",
    description: "A girl in a pink jacket works on a tablet at a blue desk, classmates with tablets behind her.",
    useFor: "learning on devices, girls and technology, digital learning",
  },
  {
    id: "masked-boy-writing",
    label: "A boy in a face mask writing in class",
    description: "A boy in a face mask writes in his exercise book in a full classroom of masked pupils.",
    useFor: "education continuity, the pandemic, keeping schools open",
  },
  {
    id: "empty-classroom",
    label: "An empty classroom",
    description: "An empty classroom with blue chairs, worn desks, a blackboard and breeze-block walls.",
    useFor: "schools without connectivity, school closures, infrastructure gaps, the need",
  },
  {
    id: "madagascar-reading",
    label: "A young woman reading a schoolbook, Madagascar",
    description: "A young woman in a red and yellow wrap reads a Malagasy schoolbook, sitting on a bed in a wooden room; Madagascar.",
    useFor: "learning at home, girls' education, Madagascar",
    places: ["Madagascar"],
  },
  {
    id: "classroom-unicef-bags",
    label: "UNICEF school bags on classroom desks",
    description: "An empty classroom with blue UNICEF school bags laid on every desk, French lessons on the blackboard.",
    useFor: "back to school, school supplies, UNICEF support to schools, French-speaking countries",
  },
  {
    id: "masked-hands-up",
    label: "Masked pupils raising their hands",
    description: "Pupils in brown uniforms and face masks raise their hands at wooden desks.",
    useFor: "education continuity, the pandemic, participation in class",
  },
  {
    id: "girl-smile-classroom",
    label: "A girl smiling in class",
    description: "A girl in an orange top and sequined headscarf smiles over her shoulder at her desk, a blackboard full of writing behind.",
    useFor: "girls' education, the joy of learning, a hopeful opening",
  },
  {
    id: "two-girls-phone",
    label: "Two girls sharing a phone outdoors",
    description: "Two girls in headscarves look at a phone together beside a white wall in bright sun.",
    useFor: "mobile access, girls and technology, young people online",
  },
  {
    id: "teacher-tablet-girl",
    label: "A teacher showing a girl a tablet",
    description: "A teacher in a blue striped hijab shows a tablet to a smiling girl in a white dress, a blackboard behind.",
    useFor: "teachers, learning on devices, girls' education",
  },
  {
    id: "girl-chalkboard-sums",
    label: "A girl writing sums on the blackboard",
    description: "A smiling girl in a white headscarf writes additions in chalk on a blackboard.",
    useFor: "learning outcomes, numeracy, girls' education",
  },
  {
    id: "girl-tablet-blackboard",
    label: "A girl reading a tablet before the blackboard",
    description: "A girl in a navy hijab reads a tablet in front of a blackboard covered in French handwriting.",
    useFor: "learning on devices, girls and technology, French-speaking countries",
  },
  {
    id: "tablet-maths-game",
    label: "A maths game on a tablet",
    description: "Close-up of hands holding a tablet with a multiplication game, a blue UNICEF school bag on the desk.",
    useFor: "digital learning content, learning apps, devices in schools",
  },
  {
    id: "ethiopia-alphabet",
    label: "A boy at the alphabet board, Ethiopia",
    description: "A boy points with a stick at the English alphabet chalked on a green board, Amharic notes beside; Ethiopia.",
    useFor: "foundational learning, literacy, Ethiopia",
    places: ["Ethiopia"],
  },
  {
    id: "girl-chalk-smile",
    label: "A laughing girl holding chalk",
    description: "Close portrait of a girl in a floral headscarf laughing, holding up a stick of chalk before a blackboard.",
    useFor: "girls' education, the joy of learning, a hopeful opening or closing",
  },
  {
    id: "young-woman-tablet",
    label: "A young woman smiling at a tablet",
    description: "A young woman in a leather jacket smiles at a tablet against a warm orange wall.",
    useFor: "young people online, digital skills, adolescent girls",
  },
  {
    id: "unicef-desk-readers",
    label: "Two boys reading at a UNICEF desk",
    description: "Two boys read a book together at a wooden desk stamped 'Don de l'Unicef', a classroom behind.",
    useFor: "UNICEF's support to schools, reading, French-speaking countries",
  },
  {
    id: "girl-answers-class",
    label: "A girl answering in front of the class, DR Congo",
    description: "A girl in a white blouse raises her hand at the front of a classroom, lessons in French and Swahili on the blackboard; DR Congo.",
    useFor: "participation, girls' education, DR Congo",
    places: ["DRC", "Congo"],
  },
  {
    id: "cameroon-tablet-pair",
    label: "Pupils on tablets, Cameroon",
    description: "A girl smiles at the camera over her tablet, a boy beside her, at an outdoor table among plants; a school in Cameroon.",
    useFor: "learning on devices, digital learning, Cameroon",
    places: ["Cameroon"],
  },
  {
    id: "cameroon-girl-tablet",
    label: "A girl holding a tablet, Cameroon",
    description: "A girl in a yellow EPA Melen school uniform holds a tablet, pupils working on tablets behind; Cameroon.",
    useFor: "learning on devices, girls and technology, Cameroon",
    places: ["Cameroon"],
  },
  {
    id: "cameroon-boy-tablet",
    label: "A boy using a tablet, Cameroon",
    description: "A boy in a green school smock looks up from his tablet at a wooden table among plants; Cameroon.",
    useFor: "learning on devices, digital learning, Cameroon",
    places: ["Cameroon"],
  },
  {
    id: "girls-yellow-hijab",
    label: "Girls writing in class",
    description: "Girls in yellow hijabs write in their notebooks at a long worn desk.",
    useFor: "girls' education, learning, secondary school",
  },
  {
    id: "crowded-classroom",
    label: "A crowded classroom",
    description: "A teacher holds up a ruler before a packed classroom of children sitting on the floor, all hands raised.",
    useFor: "the scale of need, overcrowded schools, teachers, demand for learning",
  },
  {
    id: "girl-portrait",
    label: "Portrait of a schoolgirl",
    description: "A teenage girl with a turquoise backpack looks into the camera against a white wooden wall; Asia.",
    useFor: "a child's voice, adolescent girls, a quote or story slide",
  },
  {
    id: "three-girls-reading",
    label: "Three girls laughing over a book",
    description: "Three girls in colourful headscarves laugh as they share a book at a classroom desk.",
    useFor: "girls' education, reading, the joy of learning",
  },
  {
    id: "girl-tablet-tent",
    label: "A girl with a tablet in front of a tent",
    description: "A girl with wind-blown hair and a mask under her chin holds a tablet before a white tent.",
    useFor: "education in emergencies, displaced children, learning on devices",
  },
  {
    id: "classroom-laughing",
    label: "A girl laughing in class",
    description: "A teenage girl in a green uniform laughs over a booklet, classmates behind her in a dim classroom.",
    useFor: "adolescent girls, secondary school, the joy of learning",
  },
  {
    id: "girls-headphones-tablet",
    label: "Two girls on a tablet in a straw classroom",
    description: "Two girls in white headscarves, one with headphones, laugh at a tablet inside a straw hut.",
    useFor: "learning on devices, education in emergencies, out-of-school children",
  },
  {
    id: "teacher-headphones-hut",
    label: "A teacher helping a girl on a tablet",
    description: "A teacher in a white headscarf helps a girl in red with headphones use a tablet, inside a straw hut classroom.",
    useFor: "teachers, learning on devices, education in emergencies",
  },
  {
    id: "mural-painting",
    label: "Children painting a mural",
    description: "Young children in white T-shirts paint a black and white mural of houses outdoors.",
    useFor: "community, creativity, children's participation",
  },
  {
    id: "timor-learning-app",
    label: "A girl showing a learning app, Timor-Leste",
    description: "A smiling girl in a red T-shirt holds up a phone showing the 'Eskola ba Uma' learning platform; Timor-Leste.",
    useFor: "learning at home, digital learning platforms, Timor-Leste",
    places: ["Timor-Leste"],
  },
  {
    id: "girl-phone-ladder",
    label: "A girl with a phone on a wooden ladder",
    description: "A smiling girl sits on the wooden ladder of a house on stilts, holding a phone; Southeast Asia.",
    useFor: "mobile access at home, children online, reaching every child",
  },
  {
    id: "boy-phone-park",
    label: "A boy smiling at his phone outdoors",
    description: "A boy in a green school polo smiles at his phone at a picnic table under trees.",
    useFor: "young people online, mobile learning, digital access",
  },
  {
    id: "woman-laptop-sofa",
    label: "A young woman working on a laptop",
    description: "A young woman in a grey hijab smiles behind a laptop on a carved wooden sofa.",
    useFor: "young people's digital skills, online work and study",
  },
];

/**
 * Photos of children, the fallback for any photo slot the model left empty
 * (Mario, 27 Sep 2026: the AI-generated placeholder is never to be shown).
 * Handed out in turn so a deck does not repeat one picture.
 */
export const CHILDREN_PHOTOS = ["students-tablet", "laptop-smile", "tablet-lesson", "mountain-walk", "health-centre", "kyrgyz-computer-lab", "cameroon-tablet-pair", "cameroon-girl-tablet", "cameroon-boy-tablet", "timor-learning-app", "classroom-tablet-pair", "teacher-tablet-girl", "tablet-maths-game", "unicef-desk-readers", "girls-headphones-tablet"];

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

/** The countries a library picture shows, or undefined for one that shows no particular place. */
export const photoPlaces = (src: string | undefined) => (src ? PLACES.get(src) : undefined);

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
