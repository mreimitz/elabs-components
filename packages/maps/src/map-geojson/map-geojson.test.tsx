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

describe("MapGeoJSON — the values answer the keyboard (c-2)", () => {
  type RegionProps = { name: string; value: number };

  const REGIONS: GeoJSON.FeatureCollection<GeoJSON.Polygon, RegionProps> = {
    type: "FeatureCollection",
    features: [
      { name: "North", value: 0.7, x: 0 },
      { name: "South", value: 0.29, x: 4 },
    ].map(({ name, value, x }) => ({
      type: "Feature" as const,
      id: name,
      properties: { name, value },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [x, 10],
            [x + 2, 10],
            [x + 2, 14],
            [x, 10],
          ],
        ],
      },
    })),
  };

  it("gives every region a tab stop whose name is its value, and fires the same onHover", async () => {
    const onHover = vi.fn();
    const { container } = render(
      <MapCanvas blank>
        <MapGeoJSON<RegionProps>
          data={REGIONS}
          featureLabel={(feature) => `${feature.properties.name}: ${feature.properties.value}`}
          interactive
          id="regions"
          onHover={onHover}
          promoteId="name"
        />
      </MapCanvas>,
    );
    // The fill layer (and with it the hover handle the keyboard list drives)
    // only exists once the map reports loaded.
    await waitFor(() =>
      expect(MockMap.instances[0]!.getLayer("geojson-fill-regions")).toBeDefined(),
    );
    // WCAG 2.1.1 / 1.3.1: the fill layer lives in WebGL, so before this the
    // choropleth rendered NO dom — the values were reachable by mouse only.
    const list = await waitFor(() => {
      const element = container.querySelector('[data-slot="map-geojson-keyboard-list"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    const buttons = [...list.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName("North: 0.7");
    expect(buttons[1]).toHaveAccessibleName("South: 0.29");

    buttons[1]?.focus();
    expect(document.activeElement).toBe(buttons[1]);
    expect(onHover).toHaveBeenCalledTimes(1);
    const reached = onHover.mock.lastCall?.[0];
    expect(reached.feature.properties.name).toBe("South");
    // The bounding-box centre of the South polygon, where a pointer hover
    // would have landed. `originalEvent` is null: no mouse was involved.
    expect(reached.longitude).toBeCloseTo(5, 5);
    expect(reached.latitude).toBeCloseTo(12, 5);
    expect(reached.originalEvent).toBeNull();
    // The same feature-state the pointer sets, so the region lights up too.
    expect([...MockMap.instances[0]!.featureStates.entries()]).toEqual([
      ["South", { hover: true }],
    ]);

    buttons[1]?.blur();
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("renders no list for a non-interactive map or a URL source", async () => {
    const { container, rerender } = render(
      <MapCanvas blank>
        <MapGeoJSON data={REGIONS} />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(1));
    expect(container.querySelector('[data-slot="map-geojson-keyboard-list"]')).toBeNull();

    rerender(
      <MapCanvas blank>
        <MapGeoJSON data="https://example.test/regions.geojson" interactive />
      </MapCanvas>,
    );
    expect(container.querySelector('[data-slot="map-geojson-keyboard-list"]')).toBeNull();
  });
});
