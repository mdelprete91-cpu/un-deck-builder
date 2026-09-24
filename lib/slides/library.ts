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
}

export const LIBRARY: LibraryImage[] = [
  { id: "students-tablet", label: "Students sharing a tablet on the school steps" },
  { id: "laptop-smile", label: "A student at a laptop in class" },
  { id: "tablet-lesson", label: "Two students on a tablet" },
  { id: "mountain-walk", label: "Two children walking to school under the mountains" },
  { id: "health-centre", label: "A mother and child at a health centre" },
  { id: "kazakhstan-forum", label: "Giga Maps on stage, Kazakhstan" },
  { id: "connectivity-forum", label: "Giga Connectivity Forum, ITU" },
  { id: "panel-talk", label: "A panel at a Giga event" },
  { id: "roundtable", label: "A roundtable at ITU" },
  { id: "sri-lanka-workshop", label: "A workshop over the Sri Lanka maps" },
  { id: "learning-hub", label: "The Giga Learning Hub" },
  { id: "ca-lalier", label: "Giga Technology Centre, Barcelona" },
  { id: "campus-biotech", label: "Giga Connectivity Centre, Geneva" },
];

export const librarySrc = (id: string) => `/library/${id}.jpg`;
export const libraryThumb = (id: string) => `/library/thumbs/${id}.jpg`;

/** True for an image path that points into the library. */
export const isLibraryImage = (src: string | undefined) => !!src && /^\/library\/[\w-]+\.jpg$/.test(src);
