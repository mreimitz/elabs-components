import type { PlanPoint } from "./plan-crs";

/** An axis-aligned rectangle in PLAN units. */
export interface PlanRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One interactive area of a plan — a room, a machine cell, a seat. The overlay
 * needs a box and a name, not the geometry: a room's shape is drawn by WebGL,
 * while the keyboard proxy, the label and the readout all work from its box.
 */
export interface MapPlanRegion {
  /** Stable id. Must match the feature id the shape layer promotes. */
  id: string;
  /** The visible label, and the start of the button's accessible name. */
  label: string;
  /** Shown instead of `label` when the box is too small for the full one. */
  shortLabel?: string;
  /** Appended to the accessible name — a status word, a seat count, an owner. */
  description?: string;
  /** The region's box, in plan units. */
  bounds: PlanRegionBounds;
  /** Group id, for plans with more regions than a keyboard can walk (a carriage, a wing). */
  group?: string;
  /** The group's own label, used by group mode. */
  groupLabel?: string;
}

/** The centre of a region's box, in plan units. */
export function planRegionCentre(bounds: PlanRegionBounds): PlanPoint {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function walkCoordinates(input: unknown, visit: (x: number, y: number) => void): void {
  if (!Array.isArray(input)) return;
  if (typeof input[0] === "number" && typeof input[1] === "number") {
    visit(input[0], input[1]);
    return;
  }
  for (const entry of input) walkCoordinates(entry, visit);
}

/** The bounding box of any geometry, in the units its coordinates are written in. */
export function planBoundsOfGeometry(geometry: GeoJSON.Geometry): PlanRegionBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const visit = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  if (geometry.type === "GeometryCollection") {
    for (const member of geometry.geometries) {
      walkCoordinates((member as { coordinates?: unknown }).coordinates, visit);
    }
  } else {
    walkCoordinates(geometry.coordinates, visit);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** A field read either from a feature property or computed from the properties. */
export type PlanRegionField<P, T> = string | ((properties: P, index: number) => T);

export interface PlanRegionFields<P extends GeoJSON.GeoJsonProperties> {
  /** Property name, or a function, giving each region's id. */
  id: PlanRegionField<P, string>;
  /** Property name, or a function, giving each region's visible label. */
  label: PlanRegionField<P, string>;
  /** Optional short label for a small box. */
  shortLabel?: PlanRegionField<P, string | undefined>;
  /** Optional extra words for the accessible name. */
  description?: PlanRegionField<P, string | undefined>;
  /** Optional group id. */
  group?: PlanRegionField<P, string | undefined>;
  /** Optional group label. */
  groupLabel?: PlanRegionField<P, string | undefined>;
}

function read<P extends GeoJSON.GeoJsonProperties, T>(
  field: PlanRegionField<P, T> | undefined,
  properties: P,
  index: number,
): T | undefined {
  if (field === undefined) return undefined;
  if (typeof field === "function") return field(properties, index);
  return (properties as Record<string, unknown> | null)?.[field] as T | undefined;
}

/**
 * Derive the overlay's regions from the same GeoJSON the shape layer draws, so
 * the keyboard proxy can never drift out of step with the picture.
 *
 * ```ts
 * const regions = planRegionsFromGeoJSON(rooms, { id: "id", label: "name" });
 * ```
 */
export function planRegionsFromGeoJSON<P extends GeoJSON.GeoJsonProperties>(
  data: GeoJSON.FeatureCollection<GeoJSON.Geometry, P>,
  fields: PlanRegionFields<P>,
): MapPlanRegion[] {
  const regions: MapPlanRegion[] = [];

  data.features.forEach((feature, index) => {
    const bounds = planBoundsOfGeometry(feature.geometry);
    if (!bounds) return;
    const properties = feature.properties;
    const id =
      read(fields.id, properties, index) ?? (feature.id != null ? String(feature.id) : null);
    if (id == null) return;

    const shortLabel = read(fields.shortLabel, properties, index);
    const description = read(fields.description, properties, index);
    const group = read(fields.group, properties, index);
    const groupLabel = read(fields.groupLabel, properties, index);

    regions.push({
      id: String(id),
      label: String(read(fields.label, properties, index) ?? id),
      ...(shortLabel !== undefined ? { shortLabel: String(shortLabel) } : {}),
      ...(description !== undefined ? { description: String(description) } : {}),
      ...(group !== undefined ? { group: String(group) } : {}),
      ...(groupLabel !== undefined ? { groupLabel: String(groupLabel) } : {}),
      bounds,
    });
  });

  return regions;
}

/** The id the overlay gives a group's own button, namespaced away from region ids. */
export function planGroupId(group: string): string {
  return `group:${group}`;
}

/** One group of regions, with the synthetic region that stands for the whole of it. */
export interface MapPlanGroup {
  /** The group's key, as it appeared on its regions. */
  key: string;
  /** A region covering every member's box — what group mode puts a button on. */
  region: MapPlanRegion;
  /** The group's regions, in reading order. */
  members: readonly MapPlanRegion[];
}

/** The smallest box containing all of them. `null` for an empty list. */
export function planBoundsUnion(boxes: readonly PlanRegionBounds[]): PlanRegionBounds | null {
  if (boxes.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const box of boxes) {
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.width > maxX) maxX = box.x + box.width;
    if (box.y + box.height > maxY) maxY = box.y + box.height;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Bundle regions by their `group`, in first-seen order.
 *
 * A region with no `group` becomes a group of one, keyed by its own id: group
 * mode then still shows everything, instead of quietly dropping whatever was
 * left ungrouped.
 */
export function planGroupsFromRegions(regions: readonly MapPlanRegion[]): MapPlanGroup[] {
  const byKey = new Map<string, MapPlanRegion[]>();

  for (const region of regions) {
    const key = region.group ?? region.id;
    const members = byKey.get(key);
    if (members) members.push(region);
    else byKey.set(key, [region]);
  }

  const groups: MapPlanGroup[] = [];
  for (const [key, members] of byKey) {
    const bounds = planBoundsUnion(members.map((member) => member.bounds));
    if (!bounds) continue;
    const first = members[0]!;
    groups.push({
      key,
      region: {
        id: planGroupId(key),
        label: first.groupLabel ?? key,
        bounds,
      },
      members,
    });
  }

  return groups;
}
