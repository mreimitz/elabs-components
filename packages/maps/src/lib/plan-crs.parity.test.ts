// @vitest-environment node
//
// Pins the local Web Mercator formulas to MapLibre's own `MercatorCoordinate`.
// The engine is imported for real — no mock — which is why this runs in the node
// environment: `maplibre-gl`'s module body calls `window.URL.createObjectURL` to
// set up its worker, which jsdom does not implement.
import MapLibreGL from "maplibre-gl";
import { describe, expect, it } from "vitest";

import { createPlanCrs, lngLatFromMercator, mercatorFromLngLat } from "./plan-crs";

describe("Mercator parity with MapLibre", () => {
  it("agrees with MercatorCoordinate over a lng/lat grid", () => {
    for (let lng = -180; lng <= 180; lng += 30) {
      for (let lat = -80; lat <= 80; lat += 20) {
        const engine = MapLibreGL.MercatorCoordinate.fromLngLat({ lng, lat });
        const [x, y] = mercatorFromLngLat(lng, lat);

        expect(x).toBeCloseTo(engine.x, 12);
        expect(y).toBeCloseTo(engine.y, 12);

        const back = lngLatFromMercator(engine.x, engine.y);
        expect(back[0]).toBeCloseTo(lng, 12);
        expect(back[1]).toBeCloseTo(lat, 12);
      }
    }
  });

  it("agrees on the plan corners a plan map actually uses", () => {
    const crs = createPlanCrs({ width: 1600, height: 900 });

    for (const corner of crs.imageCoordinates) {
      const engine = MapLibreGL.MercatorCoordinate.fromLngLat({ lng: corner[0], lat: corner[1] });

      expect(engine.toLngLat().lng).toBeCloseTo(corner[0], 10);
      expect(engine.toLngLat().lat).toBeCloseTo(corner[1], 10);
    }
  });
});
