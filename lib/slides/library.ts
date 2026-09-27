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
  },
  {
    id: "health-centre",
    label: "A mother and child at a health centre",
    description: "A mother holds her smiling toddler at a rural health centre; two nurses in white work at a desk with a laptop behind them; Southeast Asia.",
    useFor: "health facilities, connecting clinics, health workers, mothers and children, the health-facility mapping work",
  },
  {
    id: "kazakhstan-forum",
    label: "Giga Maps on stage, Kazakhstan",
    description: "A speaker on stage in front of a large screen showing the Giga Maps connectivity map of Kazakhstan, audience in the foreground.",
    useFor: "Giga Maps, the connectivity map, data and mapping, Kazakhstan, presenting results to governments",
  },
  {
    id: "connectivity-forum",
    label: "Giga Connectivity Forum, ITU",
    description: "Nine speakers on stage at the Giga Connectivity Forum 2024 at ITU hold coloured signs: Connect every school, Destination 2030, Opportunity for every child, I love Giga.",
    useFor: "partnerships and coalitions, events and convening, the 2030 goal, global commitment, a closing or rallying slide",
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
  },
  {
    id: "sri-lanka-workshop",
    label: "A workshop over the Sri Lanka maps",
    description: "A team in a workshop room looks at connectivity maps of Sri Lanka on a screen, a blackboard of notes behind them.",
    useFor: "workshops, capacity building, working with ministries on data, Sri Lanka, collaborative mapping",
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
  },
  {
    id: "campus-biotech",
    label: "Giga Technology Center, Geneva",
    description: "Campus Biotech, a large glass building in Geneva under a blue sky: the Giga Technology Center in Geneva.",
    useFor: "only when the slide is about the Giga Technology Center in Geneva, the Geneva team or office",
  },
];

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
export const libraryPhoto = (id: unknown): string | undefined =>
  typeof id === "string" && LIBRARY.some((l) => l.id === id.trim()) ? librarySrc(id.trim()) : undefined;

export function librarySrc(id: string) {
  return `/library/${id}.jpg`;
}
export const libraryThumb = (id: string) => `/library/thumbs/${id}.jpg`;

/** True for an image path that points into the library. */
export const isLibraryImage = (src: string | undefined) => !!src && /^\/library\/[\w-]+\.jpg$/.test(src);
