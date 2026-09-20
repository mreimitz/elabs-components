/**
 * A three-coach train, drawn in CENTIMETRES: 64 seats per coach, 192 in all —
 * the case `<MapPlanOverlay mode="groups">` exists for, since a `Tab`-and-arrow
 * walk across 192 buttons is not a way anyone reaches seat 12A.
 *
 * One rectangle is one seat. Statuses come from a SEEDED sequence, never
 * `Math.random`, so the seat map looks the same on every run.
 */
import type { PlanStatus } from "../../lib/plan-status";

/** Seats are laid out in a grid of 16 rows × 4 across, per coach. */
const ROWS = 16;
const SEAT_WIDTH = 100;
const SEAT_HEIGHT = 60;
const ROW_PITCH = 150;
const FIRST_ROW_X = 170;
const COACH_HEIGHT = 400;
const COACH_GAP = 40;
const MARGIN = 40;
/** Local y of each seat letter inside a coach; the aisle runs between B and C. */
const SEAT_ROW_Y = { A: 40, B: 110, C: 230, D: 300 } as const;
const AISLE_Y = 200;

export type SeatLetter = keyof typeof SEAT_ROW_Y;
const SEAT_LETTERS = Object.keys(SEAT_ROW_Y) as SeatLetter[];

/** The whole train's extent. Hand this to `<MapCanvas plan>`. */
export const TRAIN_CARRIAGE_EXTENT = {
  width: FIRST_ROW_X * 2 + (ROWS - 1) * ROW_PITCH + SEAT_WIDTH,
  height: MARGIN * 2 + 3 * COACH_HEIGHT + 2 * COACH_GAP,
  unit: "cm",
} as const;

/** One rectangle is one seat — say so wherever the plan is shown. */
export const TRAIN_SEAT_UNIT = "one rectangle = one seat";

const COACHES = [
  { key: "coach-a", label: "Coach A" },
  { key: "coach-b", label: "Coach B" },
  { key: "coach-c", label: "Coach C" },
] as const;

export interface SeatProperties {
  id: string;
  /** The seat as a passenger says it: "12A". */
  seat: string;
  coach: string;
  coachLabel: string;
  row: number;
  /** Which side of the aisle the seat is on — the thing people actually ask for. */
  position: "window" | "aisle";
  status: PlanStatus;
  [key: string]: unknown;
}

/** A small LCG — deterministic, seeded, and never `Math.random`. */
function seededSequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function coachTop(index: number) {
  return MARGIN + index * (COACH_HEIGHT + COACH_GAP);
}

/**
 * The train's seats at one moment. `tick` walks the same deterministic sequence
 * forward, so a live seat map animates without becoming unreproducible.
 */
export function trainCarriageSeats(
  tick = 0,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, SeatProperties> {
  const next = seededSequence(20260920 + tick * 7919);
  const features: GeoJSON.Feature<GeoJSON.Polygon, SeatProperties>[] = [];

  COACHES.forEach((coach, coachIndex) => {
    const top = coachTop(coachIndex);

    for (let row = 1; row <= ROWS; row += 1) {
      for (const letter of SEAT_LETTERS) {
        const roll = next();
        const status: PlanStatus =
          roll > 0.96 ? "down" : roll > 0.86 ? "warning" : roll > 0.5 ? "occupied" : "free";
        const x = FIRST_ROW_X + (row - 1) * ROW_PITCH;
        const y = top + SEAT_ROW_Y[letter];
        const seat = `${row}${letter}`;

        features.push({
          type: "Feature",
          id: `${coach.key}-${seat}`,
          properties: {
            id: `${coach.key}-${seat}`,
            seat,
            coach: coach.key,
            coachLabel: coach.label,
            row,
            position: letter === "A" || letter === "D" ? "window" : "aisle",
            status,
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [x, y],
                [x + SEAT_WIDTH, y],
                [x + SEAT_WIDTH, y + SEAT_HEIGHT],
                [x, y + SEAT_HEIGHT],
                [x, y],
              ],
            ],
          },
        });
      }
    }
  });

  return { type: "FeatureCollection", features };
}

/** The three coach bodies — outlines, so they read as containers, not as seats. */
export const trainCarriageShells: GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { id: string; name: string }
> = {
  type: "FeatureCollection",
  features: COACHES.map((coach, index) => {
    const top = coachTop(index);
    const left = MARGIN;
    const right = TRAIN_CARRIAGE_EXTENT.width - MARGIN;

    return {
      type: "Feature",
      id: coach.key,
      properties: { id: coach.key, name: coach.label },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [left, top],
            [right, top],
            [right, top + COACH_HEIGHT],
            [left, top + COACH_HEIGHT],
            [left, top],
          ],
        ],
      },
    };
  }),
};

/** The aisle of each coach, running the way the train travels. */
export const trainCarriageAisles: GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { id: string; name: string }
> = {
  type: "FeatureCollection",
  features: COACHES.map((coach, index) => ({
    type: "Feature",
    id: `${coach.key}-aisle`,
    properties: { id: `${coach.key}-aisle`, name: `${coach.label} aisle` },
    geometry: {
      type: "LineString",
      coordinates: [
        [MARGIN + 40, coachTop(index) + AISLE_Y],
        [TRAIN_CARRIAGE_EXTENT.width - MARGIN - 40, coachTop(index) + AISLE_Y],
      ],
    },
  })),
};

/**
 * Where a passenger walks from the door of coach A to a seat in coach C — down
 * one aisle, through the vestibule, back up the next. It snakes, so the
 * direction chevrons along it read as one continuous walk.
 */
export const trainCarriageWalk: [number, number][] = COACHES.flatMap((_coach, index) => {
  const y = coachTop(index) + AISLE_Y;
  const west = MARGIN + 80;
  const east = TRAIN_CARRIAGE_EXTENT.width - MARGIN - 80;
  return (
    index % 2 === 0
      ? [
          [west, y],
          [east, y],
        ]
      : [
          [east, y],
          [west, y],
        ]
  ) as [number, number][];
});
