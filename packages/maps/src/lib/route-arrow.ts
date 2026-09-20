/**
 * The direction chevron for `<MapRoute direction>`, drawn on a canvas and
 * registered with `map.addImage`.
 *
 * An icon rather than a text glyph on purpose: a blank MapLibre style ships no
 * glyph endpoint, so a `symbol` layer's `text-field` renders nothing at all —
 * while `icon-image` needs no network and no sprite.
 */

/** Tile edge, in px. Drawn at `pixelRatio: 2`, so it reads ~12 px on screen. */
export const ROUTE_ARROW_SIZE = 24;

/** Image id for one route's chevron. Per route, because the ink is per route. */
export function routeArrowImageId(routeId: string): string {
  return `route-arrow-${routeId}`;
}

/** A raw RGBA image MapLibre accepts, without depending on the DOM's `ImageData`. */
export interface RouteArrowImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * A chevron pointing along +x. MapLibre aligns a line-placed symbol's x axis
 * with the line's direction, so +x is "forward"; `icon-rotate: 180` is backward.
 *
 * Returns `null` where there is no 2D context (jsdom) — the caller then leaves
 * the arrow layer out rather than pointing it at a missing image, which
 * MapLibre would draw as nothing while warning on every frame.
 */
export function createRouteArrowImage(ink: string): RouteArrowImage | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = ROUTE_ARROW_SIZE;
  canvas.height = ROUTE_ARROW_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const size = ROUTE_ARROW_SIZE;
  const inset = size * 0.22;
  const mid = size / 2;

  context.clearRect(0, 0, size, size);
  context.strokeStyle = ink;
  context.lineWidth = size * 0.16;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(inset, inset);
  context.lineTo(size - inset, mid);
  context.lineTo(inset, size - inset);
  context.stroke();

  const image = context.getImageData(0, 0, size, size);
  return { width: size, height: size, data: image.data };
}
