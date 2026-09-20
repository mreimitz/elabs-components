import type { PlanCrs, PlanPoint } from "./plan-crs";
import { warnMapOnce } from "./warn-once";

/** A geographic position — the only kind an ordinary basemap understands. */
export type MapGeoPosition = {
  /** Longitude coordinate. */
  longitude: number;
  /** Latitude coordinate. */
  latitude: number;
  x?: never;
  y?: never;
};

/**
 * A position in PLAN units, for a canvas that declares a `plan` extent: metres
 * along the hall, millimetres across the carriage, pixels into the drawing.
 */
export type MapPlanPosition = {
  /** Horizontal position in plan units. */
  x: number;
  /** Vertical position in plan units, from the plan's own origin. */
  y: number;
  longitude?: never;
  latitude?: never;
};

/**
 * Either a geographic position or a plan one — never a mix. The `never`-typed
 * twins make `{ longitude, x }` a type error rather than a silent winner.
 */
export type MapPosition = MapGeoPosition | MapPlanPosition;

/**
 * Reduce a position prop to the two scalars MapLibre wants, so every downstream
 * effect keeps primitive dependencies.
 */
export function resolveMapPosition(
  position: {
    longitude?: number;
    latitude?: number;
    x?: number;
    y?: number;
  },
  plan: PlanCrs | null,
  component: string,
): [number, number] {
  const { longitude, latitude, x, y } = position;

  if (x !== undefined && y !== undefined) {
    if (!plan) {
      warnMapOnce(
        `${component}-plan-position`,
        `<${component} x y> needs a plan coordinate system. Set \`plan\` on <MapCanvas>, or pass \`longitude\`/\`latitude\`.`,
      );
      return [0, 0];
    }
    return plan.toLngLat({ x, y });
  }

  if (longitude === undefined || latitude === undefined) {
    warnMapOnce(
      `${component}-missing-position`,
      `<${component}> needs a position: \`longitude\` and \`latitude\`, or \`x\` and \`y\` on a plan.`,
    );
    return [0, 0];
  }

  return [longitude, latitude];
}

/** The plan point for a lng/lat, or `null` on an ordinary geographic canvas. */
export function toPlanPoint(
  plan: PlanCrs | null,
  lngLat: { lng: number; lat: number },
): PlanPoint | null {
  return plan ? plan.toPlan([lngLat.lng, lngLat.lat]) : null;
}
