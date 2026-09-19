import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapGeoJSON } from "./map-geojson";

const AREA: GeoJSON.Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
};

// jsdom has no 2D canvas: stand in a minimal one for the stripe tile.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    const width = this.width;
    const height = this.height;
    return {
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      getImageData: () => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    } as unknown as CanvasRenderingContext2D;
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  resetMaplibreMock();
});

describe("MapGeoJSON locator paints", () => {
  it("adds a stripe pattern layer over a tinted fill", async () => {
    render(
      <MapCanvas>
        <MapGeoJSON id="lake" data={AREA} pattern={{ kind: "stripes", width: 2, gap: 4 }} />
      </MapCanvas>,
    );
    const map = MockMap.instances[0]!;
    await waitFor(() => expect(map.getLayer("geojson-pattern-lake")).toBeDefined());
    expect(map.getLayer("geojson-pattern-lake").paint).toEqual({
      "fill-pattern": "geojson-pattern-image-lake",
    });
    expect(map.hasImage("geojson-pattern-image-lake")).toBe(true);
    // The base fill drops to a tint so the stripes read.
    expect(map.getLayer("geojson-fill-lake").paint["fill-opacity"]).toBe(0.25);
  });

  it("adds a blurred vignette line and honours fillOpacity", async () => {
    render(
      <MapCanvas>
        <MapGeoJSON id="gta" data={AREA} fillOpacity={0.6} vignette={{ width: 10, opacity: 0.5 }} />
      </MapCanvas>,
    );
    const map = MockMap.instances[0]!;
    await waitFor(() => expect(map.getLayer("geojson-vignette-gta")).toBeDefined());
    const paint = map.getLayer("geojson-vignette-gta").paint;
    expect(paint["line-width"]).toBe(20);
    expect(paint["line-blur"]).toBe(10);
    expect(paint["line-opacity"]).toBe(0.5);
    expect(map.getLayer("geojson-fill-gta").paint["fill-opacity"]).toBe(0.6);
    expect(map.getLayer("geojson-pattern-gta")).toBeUndefined();
  });

  it("removes the extra layers and the tile image on unmount", async () => {
    const { unmount } = render(
      <MapCanvas>
        <MapGeoJSON id="x" data={AREA} pattern={{ kind: "stripes" }} vignette={{}} />
      </MapCanvas>,
    );
    const map = MockMap.instances[0]!;
    await waitFor(() => expect(map.getLayer("geojson-pattern-x")).toBeDefined());
    unmount();
    expect(map.getLayer("geojson-pattern-x")).toBeUndefined();
    expect(map.getLayer("geojson-vignette-x")).toBeUndefined();
    expect(map.hasImage("geojson-pattern-image-x")).toBe(false);
  });
});
