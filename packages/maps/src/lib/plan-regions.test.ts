import { describe, expect, it } from "vitest";

import {
  planBoundsOfGeometry,
  planBoundsUnion,
  planGroupId,
  planGroupsFromRegions,
  planRegionCentre,
  planRegionsFromGeoJSON,
  type MapPlanRegion,
} from "./plan-regions";

const rooms: GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { id: string; name: string; status: string }
> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "studio", name: "Studio", status: "free" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [10, 20],
            [210, 20],
            [210, 120],
            [10, 120],
            [10, 20],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { id: "aisle", name: "Aisle", status: "free" },
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 400],
          [1000, 420],
        ],
      },
    },
  ],
};

describe("planBoundsOfGeometry", () => {
  it("boxes a polygon, a line and a nested multi-polygon alike", () => {
    expect(planBoundsOfGeometry(rooms.features[0]!.geometry)).toEqual({
      x: 10,
      y: 20,
      width: 200,
      height: 100,
    });
    expect(planBoundsOfGeometry(rooms.features[1]!.geometry)).toEqual({
      x: 0,
      y: 400,
      width: 1000,
      height: 20,
    });
    expect(
      planBoundsOfGeometry({
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 0],
            ],
          ],
          [
            [
              [90, 90],
              [100, 90],
              [100, 100],
              [90, 90],
            ],
          ],
        ],
      }),
    ).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("boxes a geometry collection across its members", () => {
    expect(
      planBoundsOfGeometry({
        type: "GeometryCollection",
        geometries: [
          { type: "Point", coordinates: [5, 5] },
          { type: "Point", coordinates: [45, 25] },
        ],
      }),
    ).toEqual({ x: 5, y: 5, width: 40, height: 20 });
  });
});

describe("planRegionsFromGeoJSON", () => {
  it("derives one region per feature, from property names", () => {
    const regions = planRegionsFromGeoJSON(rooms, { id: "id", label: "name" });

    expect(regions.map((region) => region.id)).toEqual(["studio", "aisle"]);
    expect(regions[0]!.label).toBe("Studio");
    expect(regions[0]!.bounds).toEqual({ x: 10, y: 20, width: 200, height: 100 });
    expect(regions[0]!.description).toBeUndefined();
  });

  it("takes a function for anything computed", () => {
    const regions = planRegionsFromGeoJSON(rooms, {
      id: "id",
      label: "name",
      description: (properties) => `${properties.status} now`,
      group: () => "level-3",
    });

    expect(regions[0]!.description).toBe("free now");
    expect(regions[1]!.group).toBe("level-3");
  });
});

describe("planRegionCentre", () => {
  it("returns the middle of a box, in plan units", () => {
    expect(planRegionCentre({ x: 10, y: 20, width: 200, height: 100 })).toEqual({
      x: 110,
      y: 70,
    });
  });
});

const SEATS: MapPlanRegion[] = [
  {
    id: "a-1",
    label: "1",
    group: "coach-a",
    groupLabel: "Coach A",
    bounds: { x: 0, y: 0, width: 50, height: 40 },
  },
  {
    id: "a-2",
    label: "2",
    group: "coach-a",
    groupLabel: "Coach A",
    bounds: { x: 60, y: 10, width: 50, height: 40 },
  },
  { id: "toilet", label: "Toilet", bounds: { x: 200, y: 0, width: 30, height: 60 } },
];

describe("planBoundsUnion", () => {
  it("is the smallest box holding all of them", () => {
    expect(planBoundsUnion(SEATS.map((seat) => seat.bounds))).toEqual({
      x: 0,
      y: 0,
      width: 230,
      height: 60,
    });
  });

  it("is null for nothing at all", () => {
    expect(planBoundsUnion([])).toBeNull();
  });
});

describe("planGroupsFromRegions", () => {
  it("bundles regions by their group, in first-seen order", () => {
    const groups = planGroupsFromRegions(SEATS);

    expect(groups.map((group) => group.key)).toEqual(["coach-a", "toilet"]);
    expect(groups[0]!.members.map((member) => member.id)).toEqual(["a-1", "a-2"]);
    expect(groups[0]!.region.label).toBe("Coach A");
    expect(groups[0]!.region.id).toBe(planGroupId("coach-a"));
    // The group's own box spans its members, so its button covers all of them.
    expect(groups[0]!.region.bounds).toEqual({ x: 0, y: 0, width: 110, height: 50 });
  });

  it("makes an ungrouped region a group of one, so nothing disappears", () => {
    const groups = planGroupsFromRegions(SEATS);

    const loner = groups.find((group) => group.key === "toilet")!;
    expect(loner.members).toHaveLength(1);
    expect(loner.region.label).toBe("toilet");
    expect(loner.region.bounds).toEqual(SEATS[2]!.bounds);
  });
});
