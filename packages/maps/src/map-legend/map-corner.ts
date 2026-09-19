/**
 * The four corners map furniture (legend, scale bar, north arrow, inset) can
 * sit in, inside the map box. Chrome, not geography: the corners are LOGICAL
 * (`start` / `end`), so "top-left" is the reading-start corner and mirrors in
 * RTL like the rest of the page.
 */
export type MapCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Every corner, clockwise from top-left (for stories and validation). */
export const MAP_CORNERS: readonly MapCorner[] = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
];

/** The inset classes for each corner. */
export const MAP_CORNER_CLASSES: Record<MapCorner, string> = {
  "top-left": "top-2 start-2",
  "top-right": "top-2 end-2",
  "bottom-left": "bottom-2 start-2",
  "bottom-right": "bottom-2 end-2",
};
