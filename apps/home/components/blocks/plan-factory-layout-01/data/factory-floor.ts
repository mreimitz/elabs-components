// registry: plan-factory-layout-01 — copied 2026-09-20
/**
 * A synthetic plant floor, drawn in METRES: two production lines of machine
 * cells, a buffer, a packing bay and the aisles between them.
 *
 * Statuses are generated from a SEEDED sequence, never `Math.random`, so the
 * story looks the same on every run and a screenshot means something.
 */
import type { PlanStatus } from "@elabs-ai/components-maps";

/** The plant's extent. Hand this to `<MapCanvas plan>`. */
export const FACTORY_FLOOR_EXTENT = {
  width: 120,
  height: 60,
  unit: "m",
} as const;

export interface CellProperties {
  id: string;
  name: string;
  line: string;
  status: PlanStatus;
  /** Units per hour — the number the status is really about. */
  throughput: number;
  [key: string]: unknown;
}

interface CellSeed {
  id: string;
  name: string;
  line: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CELL_WIDTH = 14;
const CELL_HEIGHT = 12;

/**
 *  line A  ▢ ▢ ▢ ▢ ▢ ▢
 *  ─────── aisle ───────
 *  line B  ▢ ▢ ▢ ▢ ▢ ▢
 */
const CELLS: CellSeed[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `a${index + 1}`,
    name: `Cell A${index + 1}`,
    line: "Line A",
    x: 5 + index * (CELL_WIDTH + 3),
    y: 6,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `b${index + 1}`,
    name: `Cell B${index + 1}`,
    line: "Line B",
    x: 5 + index * (CELL_WIDTH + 3),
    y: 38,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
  })),
];

/** A small LCG — deterministic, seeded, and never `Math.random`. */
function seededSequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * The plant's state at one moment. `tick` walks the same deterministic sequence
 * forward, so a "live" story animates without ever becoming unreproducible.
 */
export function factoryFloorCells(
  tick = 0,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, CellProperties> {
  const next = seededSequence(20260920 + tick * 7919);

  return {
    type: "FeatureCollection",
    features: CELLS.map((cell) => {
      const roll = next();
      const status: PlanStatus =
        roll > 0.92 ? "down" : roll > 0.78 ? "warning" : roll > 0.45 ? "occupied" : "free";
      const throughput = status === "down" ? 0 : Math.round(40 + next() * 120);

      return {
        type: "Feature" as const,
        id: cell.id,
        properties: {
          id: cell.id,
          name: cell.name,
          line: cell.line,
          status,
          throughput,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [cell.x, cell.y],
              [cell.x + cell.width, cell.y],
              [cell.x + cell.width, cell.y + cell.height],
              [cell.x, cell.y + cell.height],
              [cell.x, cell.y],
            ],
          ],
        },
      };
    }),
  };
}

/** The central aisle and the two cross aisles — lines, so they have no fill to click. */
export const factoryFloorAisles: GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { id: string; name: string }
> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "main-aisle",
      properties: { id: "main-aisle", name: "Main aisle" },
      geometry: {
        type: "LineString",
        coordinates: [
          [2, 30],
          [118, 30],
        ],
      },
    },
    {
      type: "Feature",
      id: "west-aisle",
      properties: { id: "west-aisle", name: "West aisle" },
      geometry: {
        type: "LineString",
        coordinates: [
          [2, 4],
          [2, 56],
        ],
      },
    },
    {
      type: "Feature",
      id: "east-aisle",
      properties: { id: "east-aisle", name: "East aisle" },
      geometry: {
        type: "LineString",
        coordinates: [
          [118, 4],
          [118, 56],
        ],
      },
    },
  ],
};

/** The hall's outer wall. */
export const factoryFloorShell: GeoJSON.Feature<GeoJSON.Polygon, { id: string }> = {
  type: "Feature",
  id: "hall",
  properties: { id: "hall" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [1, 1],
        [119, 1],
        [119, 59],
        [1, 59],
        [1, 1],
      ],
    ],
  },
};
