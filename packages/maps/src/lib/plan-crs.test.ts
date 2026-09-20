import { describe, expect, it } from "vitest";

import { createPlanCrs, mercatorFromLngLat, PLAN_MERCATOR_SPAN } from "./plan-crs";

/** Deterministic pseudo-random points — never `Math.random` in a test fixture. */
function seededPoints(count: number, width: number, height: number) {
  let seed = 1337;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({ x: next() * width, y: next() * height }));
}

const EXTENTS = [
  { width: 1000, height: 1000 },
  { width: 1600, height: 900 },
  { width: 26400, height: 2900 },
  { width: 300, height: 4000 },
  { width: 1, height: 1 },
];

describe("createPlanCrs", () => {
  it("puts the plan centre on lng/lat [0, 0] and its corners where they belong", () => {
    const crs = createPlanCrs({ width: 1600, height: 900 });

    // Longitudes are exact; latitudes come through `atan`/`exp`, so they are
    // pinned to 9 decimal places rather than to the last bit.
    expect(crs.toLngLat({ x: 800, y: 450 })).toEqual([0, 0]);

    const corners = [
      { point: { x: 0, y: 0 }, lng: -90, lat: 45.089035564831 },
      { point: { x: 1600, y: 0 }, lng: 90, lat: 45.089035564831 },
      { point: { x: 1600, y: 900 }, lng: 90, lat: -45.089035564831 },
      { point: { x: 0, y: 900 }, lng: -90, lat: -45.089035564831 },
    ];
    for (const { point, lng, lat } of corners) {
      const [actualLng, actualLat] = crs.toLngLat(point);
      expect(actualLng).toBe(lng);
      expect(actualLat).toBeCloseTo(lat, 9);
    }
  });

  it("reads plan y downward, like an image and like Leaflet's CRS.Simple", () => {
    const crs = createPlanCrs({ width: 1000, height: 1000 });
    const top = crs.toLngLat({ x: 500, y: 100 });
    const bottom = crs.toLngLat({ x: 500, y: 900 });

    expect(top[1]).toBeGreaterThan(bottom[1]);
  });

  it("round-trips every point back to the plan, at every aspect ratio", () => {
    for (const extent of EXTENTS) {
      const crs = createPlanCrs(extent);
      for (const point of seededPoints(100, extent.width, extent.height)) {
        const back = crs.toPlan(crs.toLngLat(point));
        expect(back.x).toBeCloseTo(point.x, 9);
        expect(back.y).toBeCloseTo(point.y, 9);
      }
    }
  });

  it("accepts a tuple as well as a point, and a LngLat object coming back", () => {
    const crs = createPlanCrs({ width: 1600, height: 900 });

    expect(crs.toLngLat([400, 300])).toEqual(crs.toLngLat({ x: 400, y: 300 }));

    const [lng, lat] = crs.toLngLat({ x: 400, y: 300 });
    expect(crs.toPlan({ lng, lat }).x).toBeCloseTo(400, 9);
  });

  it("preserves the plan's aspect ratio exactly, in Mercator space", () => {
    for (const { width, height } of EXTENTS) {
      const crs = createPlanCrs({ width, height });
      const [x0, y0] = mercatorFromLngLat(...crs.toLngLat({ x: 0, y: 0 }));
      const [x1, y1] = mercatorFromLngLat(...crs.toLngLat({ x: width, y: height }));

      expect(Math.abs(x1 - x0) / Math.abs(y1 - y0)).toBeCloseTo(width / height, 9);
    }
  });

  it("would NOT preserve it if the plan were mapped linearly into degrees", () => {
    // The regression test for the design decision: this is what Qlik Sense's
    // "undefined degrees" projection does, and why this module does not.
    const crs = createPlanCrs({ width: 1600, height: 900 });
    const [, north] = crs.toLngLat({ x: 0, y: 0 });
    const [, south] = crs.toLngLat({ x: 0, y: 900 });
    const [west] = crs.toLngLat({ x: 0, y: 0 });
    const [east] = crs.toLngLat({ x: 1600, y: 0 });

    const degreeAspect = (east - west) / (north - south);
    expect(degreeAspect).not.toBeCloseTo(1600 / 900, 2);
    expect(degreeAspect).toBeCloseTo(1.9960506777882618, 9);
  });

  it("spans exactly PLAN_MERCATOR_SPAN on the long side, whatever the aspect", () => {
    for (const { width, height } of EXTENTS) {
      const crs = createPlanCrs({ width, height });
      const [x0, y0] = mercatorFromLngLat(...crs.toLngLat({ x: 0, y: 0 }));
      const [x1, y1] = mercatorFromLngLat(...crs.toLngLat({ x: width, y: height }));

      expect(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))).toBeCloseTo(PLAN_MERCATOR_SPAN, 9);
      // ...and stays centred on the Mercator origin.
      expect((x0 + x1) / 2).toBeCloseTo(0.5, 9);
      expect((y0 + y1) / 2).toBeCloseTo(0.5, 9);
    }
  });

  it("stays well inside Mercator's usable latitude range, even for a square plan", () => {
    const crs = createPlanCrs({ width: 1000, height: 1000 });
    const [, north] = crs.toLngLat({ x: 0, y: 0 });

    expect(north).toBeLessThan(85.051);
    expect(north).toBeCloseTo(66.51326044311186, 6);
  });

  it("reports bounds as [[west, south], [east, north]]", () => {
    const crs = createPlanCrs({ width: 1600, height: 900 });
    const [[west, south], [east, north]] = crs.bounds;

    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect([west, north]).toEqual(crs.toLngLat({ x: 0, y: 0 }));
    expect([east, south]).toEqual(crs.toLngLat({ x: 1600, y: 900 }));
  });

  it("lists image corners clockwise from the top left", () => {
    const crs = createPlanCrs({ width: 1600, height: 900 });

    expect(crs.imageCoordinates).toEqual([
      crs.toLngLat({ x: 0, y: 0 }),
      crs.toLngLat({ x: 1600, y: 0 }),
      crs.toLngLat({ x: 1600, y: 900 }),
      crs.toLngLat({ x: 0, y: 900 }),
    ]);
  });

  it("grows maxBounds strictly outside the plan on all four sides", () => {
    const crs = createPlanCrs({ width: 1600, height: 900 });
    const [[west, south], [east, north]] = crs.bounds;
    const [[padWest, padSouth], [padEast, padNorth]] = crs.maxBounds();

    expect(padWest).toBeLessThan(west);
    expect(padSouth).toBeLessThan(south);
    expect(padEast).toBeGreaterThan(east);
    expect(padNorth).toBeGreaterThan(north);
  });

  it("derives zoom limits from the coordinate system, not from the plan's size", () => {
    const small = createPlanCrs({ width: 16, height: 9 });
    const large = createPlanCrs({ width: 26400, height: 2900 });

    expect(small.zoomForLongSidePixels(256)).toBe(0);
    expect(small.zoomForLongSidePixels(512)).toBe(1);
    expect(small.minZoom).toBe(-1);
    expect(small.maxZoom).toBe(7);
    expect(large.minZoom).toBe(small.minZoom);
    expect(large.maxZoom).toBe(small.maxZoom);
  });

  it("supports a y-up plan origin for CAD exports", () => {
    const crs = createPlanCrs({ width: 1000, height: 500, origin: "bottom-left" });
    const [, atOrigin] = crs.toLngLat({ x: 0, y: 0 });
    const [, atTop] = crs.toLngLat({ x: 0, y: 500 });

    expect(atOrigin).toBeLessThan(atTop);
    expect(crs.toPlan(crs.toLngLat({ x: 250, y: 125 })).y).toBeCloseTo(125, 9);
  });

  it("measures distance in plan units", () => {
    const crs = createPlanCrs({ width: 1000, height: 1000, unit: "mm" });

    expect(crs.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(crs.extent.unit).toBe("mm");
  });

  it("rejects an extent that cannot describe a plan", () => {
    expect(() => createPlanCrs({ width: 0, height: 100 })).toThrow(/finite positive/);
    expect(() => createPlanCrs({ width: -1, height: 100 })).toThrow(/finite positive/);
    expect(() => createPlanCrs({ width: Number.NaN, height: 100 })).toThrow(/finite positive/);
  });
});

describe("createPlanCrs().toGeoJSON", () => {
  const crs = createPlanCrs({ width: 1000, height: 1000 });
  const expected = crs.toLngLat({ x: 100, y: 200 });

  it("converts every geometry type, nested to any depth", () => {
    const converted = crs.toGeoJSON({
      type: "GeometryCollection",
      geometries: [
        { type: "Point", coordinates: [100, 200] },
        { type: "MultiPoint", coordinates: [[100, 200]] },
        { type: "LineString", coordinates: [[100, 200]] },
        { type: "MultiLineString", coordinates: [[[100, 200]]] },
        { type: "Polygon", coordinates: [[[100, 200]]] },
        { type: "MultiPolygon", coordinates: [[[[100, 200]]]] },
      ],
    } as never) as {
      geometries: { coordinates: unknown }[];
    };

    expect(converted.geometries.map((geometry) => geometry.coordinates)).toEqual([
      expected,
      [expected],
      [expected],
      [[expected]],
      [[expected]],
      [[[expected]]],
    ]);
  });

  it("keeps feature ids and properties, and drops a plan-unit bbox", () => {
    const converted = crs.toGeoJSON({
      type: "FeatureCollection",
      bbox: [0, 0, 1000, 1000],
      features: [
        {
          type: "Feature",
          id: "room-1",
          bbox: [0, 0, 100, 100],
          properties: { name: "Studio", seats: 8 },
          geometry: { type: "Point", coordinates: [100, 200] },
        },
      ],
    } as never) as {
      bbox?: unknown;
      features: { id: string; bbox?: unknown; properties: unknown; geometry: unknown }[];
    };

    expect(converted.bbox).toBeUndefined();
    expect(converted.features).toEqual([
      {
        type: "Feature",
        id: "room-1",
        properties: { name: "Studio", seats: 8 },
        geometry: { type: "Point", coordinates: expected },
      },
    ]);
  });

  it("leaves the caller's data untouched", () => {
    const input = { type: "Point", coordinates: [100, 200] };
    crs.toGeoJSON(input as never);

    expect(input.coordinates).toEqual([100, 200]);
  });
});
