import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { createPlanCrs } from "../lib/plan-crs";
import { MapRoute } from "./map-route";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
  vi.restoreAllMocks();
});

const PLAN = { width: 1000, height: 500 };

function lastMap() {
  return MockMap.instances.at(-1)!;
}

function sourceData(map: MockMap) {
  const source = [...map.sources.values()][0]!;
  return source.setDataCalls.at(-1) as GeoJSON.Feature<GeoJSON.LineString> | undefined;
}

/** A 2D context stub, so the generated chevron exists in jsdom too. */
function stubCanvasContext() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (kind: string) {
    if (kind !== "2d") return null;
    return {
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "butt",
      lineJoin: "miter",
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
    } as unknown as CanvasRenderingContext2D;
  });
}

describe("MapRoute", () => {
  it("passes geographic coordinates through as they were given", async () => {
    const coordinates: [number, number][] = [
      [13.4, 52.5],
      [2.35, 48.86],
    ];
    render(
      <MapCanvas>
        <MapRoute coordinates={coordinates} />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(sourceData(lastMap())).toBeDefined();
    });
    expect(sourceData(lastMap())!.geometry.coordinates).toBe(coordinates);
  });

  it("converts plan coordinates into the plan's own lng/lat", async () => {
    const coordinates: [number, number][] = [
      [0, 0],
      [1000, 500],
    ];
    render(
      <MapCanvas plan={PLAN}>
        <MapRoute coordinates={coordinates} />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(sourceData(lastMap())).toBeDefined();
    });

    const crs = createPlanCrs(PLAN);
    expect(sourceData(lastMap())!.geometry.coordinates).toEqual([
      crs.toLngLat({ x: 0, y: 0 }),
      crs.toLngLat({ x: 1000, y: 500 }),
    ]);
    // The caller's array is never mutated.
    expect(coordinates[1]).toEqual([1000, 500]);
  });

  it("draws no arrows by default", async () => {
    render(
      <MapCanvas>
        <MapRoute
          coordinates={[
            [0, 0],
            [10, 10],
          ]}
        />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(lastMap().layers.size).toBeGreaterThan(0);
    });
    expect([...lastMap().layers.keys()].some((id) => id.startsWith("route-arrows-"))).toBe(false);
    expect(lastMap().addImageCalls).toHaveLength(0);
  });

  it("registers the chevron and places it along the line when asked", async () => {
    stubCanvasContext();
    render(
      <MapCanvas>
        <MapRoute
          id="aisle"
          coordinates={[
            [0, 0],
            [10, 10],
          ]}
          direction="forward"
        />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(lastMap().getLayer("route-arrows-aisle")).toBeDefined();
    });

    const [id, , options] = lastMap().addImageCalls.at(-1)!;
    expect(id).toBe("route-arrow-aisle");
    expect(options).toEqual({ pixelRatio: 2 });

    const layer = lastMap().getLayer("route-arrows-aisle");
    expect(layer.type).toBe("symbol");
    expect(layer.layout).toMatchObject({
      "symbol-placement": "line",
      "icon-image": "route-arrow-aisle",
      "icon-rotate": 0,
      "icon-rotation-alignment": "map",
    });
    // An icon, never a `text-field`: a blank style has no glyph endpoint, so
    // text on a symbol layer would silently render nothing.
    expect(layer.layout["text-field"]).toBeUndefined();
  });

  it("turns the chevron around for a backward route", async () => {
    stubCanvasContext();
    render(
      <MapCanvas>
        <MapRoute
          id="belt"
          coordinates={[
            [0, 0],
            [10, 10],
          ]}
          direction="backward"
        />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(lastMap().getLayer("route-arrows-belt")).toBeDefined();
    });
    expect(lastMap().getLayer("route-arrows-belt").layout["icon-rotate"]).toBe(180);
  });

  it("leaves the arrow layer out when there is no canvas to draw it on", async () => {
    // Unstubbed jsdom: no 2D context, so no image — and a layer pointing at a
    // missing image would warn on every frame.
    render(
      <MapCanvas>
        <MapRoute
          id="aisle"
          coordinates={[
            [0, 0],
            [10, 10],
          ]}
          direction="forward"
        />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(lastMap().layers.size).toBeGreaterThan(0);
    });
    expect(lastMap().getLayer("route-arrows-aisle")).toBeUndefined();
  });

  it("takes its arrow layer and image away again on unmount", async () => {
    stubCanvasContext();
    const { unmount } = render(
      <MapCanvas>
        <MapRoute
          id="aisle"
          coordinates={[
            [0, 0],
            [10, 10],
          ]}
          direction="forward"
        />
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(lastMap().getLayer("route-arrows-aisle")).toBeDefined();
    });
    const map = lastMap();
    unmount();

    expect(map.getLayer("route-arrows-aisle")).toBeUndefined();
    expect(map.hasImage("route-arrow-aisle")).toBe(false);
  });
});
