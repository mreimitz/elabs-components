/**
 * A coordinate system for a CUSTOM, non-geographic plan — a floor plan, a
 * factory layout, a train carriage, a rack elevation. Kept engine-free so it can
 * be unit-tested (same convention as `arc-math.ts`).
 *
 * MapLibre GL JS renders Web Mercator and nothing else: it has no custom CRS and
 * none is planned, so a plan coordinate system has to be SYNTHESIZED on top of
 * Mercator. The same convention as Leaflet's `CRS.Simple` (origin top-left, one
 * map unit = one pixel) and Qlik Sense's image background layer (corner
 * coordinates in the image's own pixels, projection "undefined").
 *
 * The plan is mapped LINEARLY INTO NORMALIZED MERCATOR, not linearly into
 * degrees. Normalized Mercator is what the screen shows, so one scale factor for
 * both axes keeps the plan's aspect ratio exact at every zoom and every plan
 * size. Mapping linearly into degrees — the naive reading of "undefined degrees"
 * — stretches the plan vertically by Mercator's cos(lat) factor: a 1600 x 900
 * plan comes out at aspect 1.996 instead of 1.778, 12% too wide.
 *
 * What this is NOT: a georeference. Mercator's y is non-linear in latitude, so
 * lengths measured on the Earth are meaningless here. Distances belong to the
 * plan (`distance()` returns plan units); never put a scale bar on a plan map,
 * and never combine a plan with the globe projection.
 */

/**
 * How much of normalized Mercator the plan's LONG side spans. Normalizing on the
 * long side caps the footprint whatever the aspect ratio: the tallest possible
 * plan reaches +-66.5 deg latitude, comfortably inside Mercator's +-85.05 limit.
 */
export const PLAN_MERCATOR_SPAN = 0.5;

/** MapLibre's world is this many CSS pixels across at zoom 0. */
const MERCATOR_TILE_SIZE = 512;

/** A point in plan units. */
export interface PlanPoint {
  x: number;
  y: number;
}

/** The plan's own extent and units — everything the coordinate system needs. */
export interface PlanExtent {
  /** Plan width in plan units (image pixels, millimetres, metres — your choice). */
  width: number;
  /** Plan height in plan units. */
  height: number;
  /**
   * Where plan (0, 0) sits. `"top-left"` (the default) matches an image and
   * Leaflet's `CRS.Simple`; `"bottom-left"` matches y-up CAD/DXF exports.
   */
  origin?: "top-left" | "bottom-left";
  /** Unit name, for labels and readouts only — the maths never reads it. */
  unit?: string;
}

/** The four image-source corners MapLibre wants: top-left, top-right, bottom-right, bottom-left. */
export type PlanImageCoordinates = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

/** A two-way transform between plan units and lng/lat, plus everything derived from it. */
export interface PlanCrs {
  /** The extent this was built from, with defaults applied. */
  readonly extent: Required<PlanExtent>;
  /** Normalized Mercator units per plan unit. */
  readonly scale: number;
  /** Plan point -> `[lng, lat]`. */
  toLngLat(point: PlanPoint | [number, number]): [number, number];
  /** `[lng, lat]` -> plan point. */
  toPlan(lngLat: [number, number] | { lng: number; lat: number }): PlanPoint;
  /** Deep-convert GeoJSON authored in plan units into lng/lat GeoJSON. */
  toGeoJSON<T>(data: T): T;
  /** The plan's bounds as `[[west, south], [east, north]]`. */
  readonly bounds: [[number, number], [number, number]];
  /** Bounds grown by `padFraction` of the long side — a pan limit that still shows the edges. */
  maxBounds(padFraction?: number): [[number, number], [number, number]];
  /** The plan's four corners, ready for a MapLibre `image` or `canvas` source. */
  readonly imageCoordinates: PlanImageCoordinates;
  /** The zoom at which the plan's long side covers `px` CSS pixels. */
  zoomForLongSidePixels(px: number): number;
  /** Zoom at which the plan's long side is 128 px — small but still findable. */
  readonly minZoom: number;
  /** Zoom at which the plan's long side is 32768 px — a desk, a machine, a seat. */
  readonly maxZoom: number;
  /** Straight-line distance between two plan points, in plan units. */
  distance(a: PlanPoint, b: PlanPoint): number;
}

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;

/**
 * `[lng, lat]` -> normalized Mercator `[x, y]`, both in `[0, 1]`, with `y = 0` at
 * the NORTH-WEST corner. The Web Mercator spec formulas, implemented here so the
 * module stays engine-free; a parity test pins them to MapLibre's own
 * `MercatorCoordinate`.
 */
export function mercatorFromLngLat(lng: number, lat: number): [number, number] {
  const x = (180 + lng) / 360;
  const y = (180 - DEG_PER_RAD * Math.log(Math.tan(Math.PI / 4 + (lat * RAD_PER_DEG) / 2))) / 360;
  return [x, y];
}

/** Normalized Mercator `[x, y]` -> `[lng, lat]`. The inverse of `mercatorFromLngLat`. */
export function lngLatFromMercator(x: number, y: number): [number, number] {
  const lng = x * 360 - 180;
  const y2 = 180 - y * 360;
  const lat = (360 / Math.PI) * (Math.atan(Math.exp(y2 * RAD_PER_DEG)) - Math.PI / 4);
  return [lng, lat];
}

function asPlanPoint(point: PlanPoint | [number, number]): PlanPoint {
  return Array.isArray(point) ? { x: point[0], y: point[1] } : point;
}

/**
 * Build a plan coordinate system from the plan's extent.
 *
 * ```tsx
 * const plan = createPlanCrs({ width: 2400, height: 1600, unit: "cm" });
 * <MapCanvas blank plan={plan}>
 *   <MapPlanImage src={floorPlanPng} />
 *   <MapGeoJSON data={roomsInPlanUnits} promoteId="id" />
 * </MapCanvas>
 * ```
 *
 * Throws when the extent is not a pair of finite, positive numbers — a NaN
 * coordinate system is unfixable three layers downstream.
 */
export function createPlanCrs(extent: PlanExtent): PlanCrs {
  const { width, height, origin = "top-left", unit = "px" } = extent;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(
      `createPlanCrs: width and height must be finite positive numbers (received ${String(width)} x ${String(height)})`,
    );
  }

  const resolved: Required<PlanExtent> = { width, height, origin, unit };
  const scale = PLAN_MERCATOR_SPAN / Math.max(width, height);
  // Centre the plan on normalized Mercator (0.5, 0.5), i.e. on lng/lat [0, 0].
  const x0 = 0.5 - (width * scale) / 2;
  const y0 = 0.5 - (height * scale) / 2;

  // Mercator y already increases southward, so a top-left plan origin needs no
  // flip. Only a y-up plan does.
  const planYToMercatorY = (y: number) => y0 + (origin === "top-left" ? y : height - y) * scale;
  const mercatorYToPlanY = (my: number) => {
    const y = (my - y0) / scale;
    return origin === "top-left" ? y : height - y;
  };

  const toLngLat = (point: PlanPoint | [number, number]): [number, number] => {
    const { x, y } = asPlanPoint(point);
    return lngLatFromMercator(x0 + x * scale, planYToMercatorY(y));
  };

  const toPlan = (lngLat: [number, number] | { lng: number; lat: number }): PlanPoint => {
    const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    const [mx, my] = mercatorFromLngLat(lng, lat);
    return { x: (mx - x0) / scale, y: mercatorYToPlanY(my) };
  };

  const topLeft = toLngLat({ x: 0, y: 0 });
  const bottomRight = toLngLat({ x: width, y: height });
  // Plan y grows downward, so the plan's y=0 edge is the NORTHERN one.
  const west = topLeft[0];
  const east = bottomRight[0];
  const north = Math.max(topLeft[1], bottomRight[1]);
  const south = Math.min(topLeft[1], bottomRight[1]);

  const bounds: [[number, number], [number, number]] = [
    [west, south],
    [east, north],
  ];

  const imageCoordinates: PlanImageCoordinates = [
    toLngLat({ x: 0, y: 0 }),
    toLngLat({ x: width, y: 0 }),
    toLngLat({ x: width, y: height }),
    toLngLat({ x: 0, y: height }),
  ];

  const zoomForLongSidePixels = (px: number) =>
    Math.log2(px / (PLAN_MERCATOR_SPAN * MERCATOR_TILE_SIZE));

  return Object.freeze({
    extent: resolved,
    scale,
    toLngLat,
    toPlan,
    toGeoJSON: <T>(data: T): T => convertGeoJSON(data, toLngLat),
    bounds,
    maxBounds(padFraction = 0.1): [[number, number], [number, number]] {
      const pad = Math.max(width, height) * padFraction;
      const outerTopLeft = toLngLat({ x: -pad, y: -pad });
      const outerBottomRight = toLngLat({ x: width + pad, y: height + pad });
      return [
        [outerTopLeft[0], Math.min(outerTopLeft[1], outerBottomRight[1])],
        [outerBottomRight[0], Math.max(outerTopLeft[1], outerBottomRight[1])],
      ];
    },
    imageCoordinates,
    zoomForLongSidePixels,
    minZoom: zoomForLongSidePixels(128),
    maxZoom: zoomForLongSidePixels(32768),
    distance: (a: PlanPoint, b: PlanPoint) => Math.hypot(b.x - a.x, b.y - a.y),
  });
}

type Convert = (point: PlanPoint | [number, number]) => [number, number];

function convertPositions(coordinates: unknown, convert: Convert): unknown {
  if (!Array.isArray(coordinates)) return coordinates;
  // A position is a flat [x, y(, z)] — convert it and drop any third element,
  // which would be a plan-unit altitude MapLibre cannot interpret.
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    return convert([coordinates[0], coordinates[1]]);
  }
  return coordinates.map((entry) => convertPositions(entry, convert));
}

/**
 * Deep-convert every position in a GeoJSON value from plan units to lng/lat.
 * `bbox` is STRIPPED rather than converted: MapLibre trusts a declared bbox, and
 * a plan-unit one would put the geometry in the wrong place.
 */
function convertGeoJSON<T>(data: T, convert: Convert): T {
  if (!data || typeof data !== "object") return data;

  const input = data as Record<string, unknown>;
  const { bbox: _bbox, ...rest } = input;
  const output: Record<string, unknown> = { ...rest };

  if (Array.isArray(input.features)) {
    output.features = input.features.map((feature) => convertGeoJSON(feature, convert));
  }
  if (Array.isArray(input.geometries)) {
    output.geometries = input.geometries.map((geometry) => convertGeoJSON(geometry, convert));
  }
  if (input.geometry && typeof input.geometry === "object") {
    output.geometry = convertGeoJSON(input.geometry, convert);
  }
  if (input.coordinates !== undefined) {
    output.coordinates = convertPositions(input.coordinates, convert);
  }

  return output as T;
}
