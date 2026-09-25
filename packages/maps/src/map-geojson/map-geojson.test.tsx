import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ComponentsTokens from "@elabs-ai/components-tokens";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

// A deterministic stand-in for the real resolver (which reads getComputedStyle
// off the map container) — proves MapGeoJSON hands token references through
// resolution rather than passing the raw `var(...)`/`--foo` string to MapLibre.
vi.mock("@elabs-ai/components-tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof ComponentsTokens>();
  return {
    ...actual,
    resolveTokenColor: (name: string) => `resolved(${name})`,
  };
});

import { MockMap, MockSource, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { createPlanCrs } from "../lib/plan-crs";
import { resetMapWarnings } from "../lib/warn-once";
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

const PLAN = { width: 1000, height: 500 };

const rooms: GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "studio" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [200, 0],
            [200, 100],
            [0, 100],
            [0, 0],
          ],
        ],
      },
    },
  ],
};

function lastMap() {
  return MockMap.instances.at(-1)!;
}

function sourceFor(map: MockMap) {
  return [...map.sources.values()][0]!;
}

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
  resetMapWarnings();
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

describe("MapGeoJSON", () => {
  it("leaves geographic data untouched, object identity included", async () => {
    const geographic: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [13.4, 52.52] },
        },
      ],
    };

    render(
      <MapCanvas>
        <MapGeoJSON data={geographic} />
      </MapCanvas>,
    );

    await waitFor(() => expect(MockSource.instances.length).toBeGreaterThan(0));
    const source = sourceFor(lastMap());
    expect(source.spec.data).toBe(geographic);
  });

  it("does not make a geographic layer interactive", async () => {
    render(
      <MapCanvas>
        <MapGeoJSON id="regions" data={rooms} promoteId="id" />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("geojson-fill-regions")).toBeDefined();
      return instance;
    });
    expect([...map.handlers.keys()].some((key) => key.startsWith("click"))).toBe(false);
  });

  it("converts plan units into the plan's coordinate system", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON data={rooms} promoteId="id" />
      </MapCanvas>,
    );

    await waitFor(() => expect(MockSource.instances.length).toBeGreaterThan(0));
    const crs = createPlanCrs(PLAN);
    const source = sourceFor(lastMap());
    const converted = source.spec.data as GeoJSON.FeatureCollection<GeoJSON.Polygon>;

    expect(converted.features[0]!.geometry.coordinates[0]![0]).toEqual(
      crs.toLngLat({ x: 0, y: 0 }),
    );
    expect(converted.features[0]!.geometry.coordinates[0]![2]).toEqual(
      crs.toLngLat({ x: 200, y: 100 }),
    );
    // The caller's data is never mutated.
    expect(rooms.features[0]!.geometry.coordinates[0]![0]).toEqual([0, 0]);
  });

  it("binds interaction by default on a plan, and reports the plan point back", async () => {
    const onClick = vi.fn();
    render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON data={rooms} promoteId="id" onClick={onClick} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.handlers.has("click")).toBe(true);
      return instance;
    });

    const crs = createPlanCrs(PLAN);
    const [lng, lat] = crs.toLngLat({ x: 120, y: 60 });
    map.queryRenderedFeaturesResult = [{ id: "studio", properties: { id: "studio" } }];
    map.emit("click", undefined, {
      point: { x: 10, y: 10 },
      lngLat: { lng, lat },
      features: [],
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    const event = onClick.mock.calls[0]![0];
    expect(event.plan.x).toBeCloseTo(120, 6);
    expect(event.plan.y).toBeCloseTo(60, 6);
    expect(event.longitude).toBe(lng);
  });

  it("falls back to a padded box only when nothing is under the pointer", async () => {
    const onClick = vi.fn();
    render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON id="plan" data={rooms} promoteId="id" onClick={onClick} pickPadding={11} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.handlers.has("click")).toBe(true);
      return instance;
    });

    map.queryRenderedFeaturesResult = [];
    map.emit("click", undefined, {
      point: { x: 40, y: 40 },
      lngLat: { lng: 0, lat: 0 },
      features: [],
    });

    // Exact hit first, then the padded box: two queries, the second one a box.
    expect(map.queryRenderedFeaturesCalls).toHaveLength(2);
    expect(map.queryRenderedFeaturesCalls[1]).toEqual([
      [
        [29, 29],
        [51, 51],
      ],
      { layers: ["geojson-fill-plan"] },
    ]);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("adds an invisible wide hit layer when there is no fill to click", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON id="walls" data={rooms} promoteId="id" fillPaint={false} hitWidth={20} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("geojson-hit-walls")).toBeDefined();
      return instance;
    });

    const layer = map.getLayer("geojson-hit-walls");
    expect(layer.paint["line-opacity"]).toBe(0);
    expect(layer.paint["line-width"]).toBe(20);
    expect(map.getLayer("geojson-fill-walls")).toBeUndefined();
  });

  it("paints selection through feature-state, and clears what falls out of it", async () => {
    const { rerender } = render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON id="plan" data={rooms} promoteId="id" selectedId="studio" />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.featureStateCalls.length).toBeGreaterThan(0);
      return instance;
    });
    expect(map.featureStateCalls).toContainEqual([
      { source: "geojson-source-plan", id: "studio" },
      { selected: true },
    ]);

    rerender(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON id="plan" data={rooms} promoteId="id" selectedId={null} />
      </MapCanvas>,
    );

    await waitFor(() =>
      expect(map.featureStateCalls).toContainEqual([
        { source: "geojson-source-plan", id: "studio" },
        { selected: false },
      ]),
    );
  });

  it("merges selected paint outside hover, so a selected shape stays selected", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON
          id="plan"
          data={rooms}
          promoteId="id"
          fillPaint={{ "fill-opacity": 0.1 }}
          fillHoverPaint={{ "fill-opacity": 0.2 }}
          fillSelectedPaint={{ "fill-opacity": 0.4 }}
        />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("geojson-fill-plan")).toBeDefined();
      return instance;
    });

    expect(map.getLayer("geojson-fill-plan").paint["fill-opacity"]).toEqual([
      "case",
      ["boolean", ["feature-state", "selected"], false],
      0.4,
      ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.1],
    ]);
  });

  it("lets the consumer drive the highlight with hoveredId", async () => {
    const { rerender } = render(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON id="plan" data={rooms} promoteId="id" hoveredId={null} />
      </MapCanvas>,
    );

    const map = await waitFor(() => lastMap());

    rerender(
      <MapCanvas plan={PLAN}>
        <MapGeoJSON id="plan" data={rooms} promoteId="id" hoveredId="studio" />
      </MapCanvas>,
    );

    await waitFor(() =>
      expect(map.featureStateCalls).toContainEqual([
        { source: "geojson-source-plan", id: "studio" },
        { hover: true },
      ]),
    );
  });
});

describe("MapGeoJSON — token colours in fillPaint/linePaint", () => {
  it("resolves a var(--token) or bare --token colour instead of handing WebGL the raw reference", async () => {
    render(
      <MapCanvas>
        <MapGeoJSON
          id="territories"
          data={AREA}
          fillPaint={{ "fill-color": "var(--chart-1)" }}
          linePaint={{ "line-color": "--chart-2" }}
        />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("geojson-fill-territories")).toBeDefined();
      expect(instance.getLayer("geojson-line-territories")).toBeDefined();
      return instance;
    });

    const fillColor = map.getLayer("geojson-fill-territories").paint["fill-color"];
    const lineColor = map.getLayer("geojson-line-territories").paint["line-color"];

    expect(fillColor).toBe("resolved(--chart-1)");
    expect(lineColor).toBe("resolved(--chart-2)");
    expect(fillColor).not.toMatch(/^var\(/);
    expect(lineColor).not.toMatch(/^var\(/);
  });

  it("resolves a token colour nested inside a hover/selected case expression", async () => {
    render(
      <MapCanvas>
        <MapGeoJSON
          id="hovered"
          data={AREA}
          promoteId="id"
          fillPaint={{ "fill-color": "#111111" }}
          fillHoverPaint={{ "fill-color": "var(--chart-3)" }}
        />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("geojson-fill-hovered")).toBeDefined();
      return instance;
    });

    expect(map.getLayer("geojson-fill-hovered").paint["fill-color"]).toEqual([
      "case",
      ["boolean", ["feature-state", "hover"], false],
      "resolved(--chart-3)",
      "#111111",
    ]);
  });

  it("leaves a plain CSS colour (no token reference) untouched", async () => {
    render(
      <MapCanvas>
        <MapGeoJSON id="plain" data={AREA} linePaint={{ "line-color": "#336699" }} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("geojson-line-plain")).toBeDefined();
      return instance;
    });

    expect(map.getLayer("geojson-line-plain").paint["line-color"]).toBe("#336699");
  });
});
