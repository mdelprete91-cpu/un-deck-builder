/**
 * The pixel size of the image slot for a layout on the 1920x1080 stage.
 * Geometry comes from the renderers in lib/slides/layouts (framedImage
 * calls); a generated map is rendered at exactly this size so it is neither
 * cropped by object-fit:cover nor letterboxed.
 */
export type MapSlot = { width: number; height: number };

const LANDSCAPE_BAND: MapSlot = { width: 1720, height: 572 }; // photo, map
const FULL_BLEED: MapSlot = { width: 1920, height: 1080 }; // photo-full, fallback
const SIDE_PANEL: MapSlot = { width: 840, height: 1080 }; // section-image-*, callout, example-image-*

export function mapSlotFor(layoutId: string | undefined, imagePath?: string | null): MapSlot {
  // A two-pager block addresses its photo by path; those slots are cover-fit
  // panels of varying ratio, so a wide landscape render fits them best.
  if (imagePath && imagePath !== "image") return FULL_BLEED;
  switch (layoutId) {
    case "photo":
    case "map":
      return LANDSCAPE_BAND;
    case "photo-full":
      return FULL_BLEED;
    case "callout":
    case "example-image-left":
    case "example-image-right":
    case "section-image-deep":
    case "section-image-light":
    case "section-image-dark":
      return SIDE_PANEL;
    default:
      return FULL_BLEED;
  }
}
