import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, MockSource, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { createPlanCrs } from "../lib/plan-crs";
import { resetMapWarnings } from "../lib/warn-once";
import { MapGeoJSON } from "./map-geojson";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
  resetMapWarnings();
});

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
