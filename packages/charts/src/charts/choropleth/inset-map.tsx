"use client";

/**
 * inset-map.tsx — the locator mini map in a choropleth corner (RM-124).
 *
 * A small, `aria-hidden` map that shows WHERE the main map's visible extent
 * sits: `kind: "main"` draws the whole collection flat (Mercator, fitted to
 * the inset), `kind: "globe"` draws it on an orthographic globe turned to face
 * the extent. The extent is the main plot's corners run back through the
 * projection (and the zoom transform), so it follows `fitToData`, pan and zoom.
 *
 * Decorative by construction: the chart's own description says where the map
 * is, so the inset carries no text alternative of its own.
 */

import { geoMercator, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, LineString } from "geojson";
import { useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";
import type { ChoroplethFeatureProperties } from "./choropleth-context";

export type ChoroplethCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** `inset` on `ChoroplethChart`. */
export interface ChoroplethInsetConfig {
  /** `"main"`: the whole map, flat. `"globe"`: an orthographic globe. */
  kind: "globe" | "main";
  /** Corner of the plot. Default `"bottom-right"`. */
  position?: ChoroplethCorner;
  /** Edge length in px. Default 96; never more than 35% of the plot's shorter side. */
  size?: number;
}

/** The inset's edge for a plot of `width × height` (never negative). */
export function resolveInsetSize(size: number | undefined, width: number, height: number): number {
  const cap = Math.max(0, Math.min(width, height) * 0.35);
  return Math.max(0, Math.min(size ?? 96, cap));
}

const CORNER_CLASS: Record<ChoroplethCorner, string> = {
  "top-left": "start-2 top-2",
  "top-right": "end-2 top-2",
  "bottom-left": "bottom-2 start-2",
  "bottom-right": "bottom-2 end-2",
};

/** Points per plot edge when the extent is traced back onto the sphere. */
const EDGE_SAMPLES = 8;

/**
 * The visible extent of the main plot as a closed geographic line: the plot
 * edge, sampled, un-zoomed (`zoom` is the SVG transform) and inverted
 * through `projection`. Points the projection cannot invert are skipped.
 */
export function visibleExtentLine(
  projection: Pick<GeoProjection, "invert">,
  width: number,
  height: number,
  zoom: { scaleX: number; scaleY: number; translateX: number; translateY: number } | null,
): LineString | null {
  if (!projection.invert || width <= 0 || height <= 0) return null;
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const coordinates: [number, number][] = [];
  for (let c = 0; c < corners.length; c++) {
    const [x0, y0] = corners[c] as [number, number];
    const [x1, y1] = corners[(c + 1) % corners.length] as [number, number];
    for (let s = 0; s < EDGE_SAMPLES; s++) {
      const t = s / EDGE_SAMPLES;
      let x = x0 + (x1 - x0) * t;
      let y = y0 + (y1 - y0) * t;
      if (zoom && zoom.scaleX !== 0 && zoom.scaleY !== 0) {
        x = (x - zoom.translateX) / zoom.scaleX;
        y = (y - zoom.translateY) / zoom.scaleY;
      }
      const geo = projection.invert([x, y]);
      if (geo && Number.isFinite(geo[0]) && Number.isFinite(geo[1])) {
        coordinates.push([
          Math.max(-180, Math.min(180, geo[0])),
          Math.max(-85, Math.min(85, geo[1])),
        ]);
      }
    }
  }
  if (coordinates.length < 2) return null;
  coordinates.push(coordinates[0] as [number, number]);
  return { type: "LineString", coordinates };
}

export interface ChoroplethInsetMapProps extends ChoroplethInsetConfig {
  /** Every feature of the chart's collection (with or without data). */
  features: readonly Feature<Geometry, ChoroplethFeatureProperties>[];
  /** The main plot's visible extent (see {@link visibleExtentLine}). */
  extent: LineString | null;
  /** The main plot's size — the inset clamps inside it. */
  plotWidth: number;
  plotHeight: number;
  className?: string;
}

export function ChoroplethInsetMap({
  kind,
  position = "bottom-right",
  size,
  features,
  extent,
  plotWidth,
  plotHeight,
  className,
}: ChoroplethInsetMapProps) {
  const edge = resolveInsetSize(size, plotWidth, plotHeight);

  const drawing = useMemo(() => {
    if (edge < 16) return null;
    const collection: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
      type: "FeatureCollection",
      features: [...features],
    };
    const pad = 3;
    let projection: GeoProjection;
    if (kind === "globe") {
      const centre = extent ? centreOf(extent) : [0, 20];
      projection = geoOrthographic()
        .rotate([-(centre[0] ?? 0), -(centre[1] ?? 0)])
        .fitExtent(
          [
            [pad, pad],
            [edge - pad, edge - pad],
          ],
          { type: "Sphere" },
        );
    } else {
      projection = geoMercator().fitExtent(
        [
          [pad, pad],
          [edge - pad, edge - pad],
        ],
        collection,
      );
    }
    const path = geoPath(projection);
    return {
      sphere: kind === "globe" ? path({ type: "Sphere" }) : null,
      land: collection.features
        .map((feature, index) => ({
          key: String(feature.properties?.id ?? feature.id ?? index),
          d: path(feature),
        }))
        .filter((entry): entry is { key: string; d: string } => Boolean(entry.d)),
      extent: extent ? path(extent) : null,
    };
  }, [edge, extent, features, kind]);

  if (!drawing) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-md border border-border bg-background shadow-xs",
        CORNER_CLASS[position],
        className,
      )}
      data-inset-kind={kind}
      data-slot="choropleth-inset"
      style={{ width: edge, height: edge }}
    >
      <svg height={edge} width={edge}>
        {drawing.sphere ? (
          <path
            d={drawing.sphere}
            fill="var(--chart-background)"
            stroke="var(--chart-grid)"
            // chart-hairline-exempt: the globe's outline is the inset's own edge, drawn at the furniture weight.
            strokeWidth={1}
          />
        ) : null}
        <g fill="var(--muted-foreground)" opacity={0.35}>
          {drawing.land.map((entry) => (
            <path d={entry.d} key={entry.key} />
          ))}
        </g>
        {drawing.extent ? (
          <path
            d={drawing.extent}
            data-slot="choropleth-inset-extent"
            fill="none"
            stroke="var(--chart-foreground)"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        ) : null}
      </svg>
    </div>
  );
}

ChoroplethInsetMap.displayName = "ChoroplethInsetMap";

/** Mean of a line's vertices — close enough to aim a locator globe. */
function centreOf(line: LineString): [number, number] {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of line.coordinates as [number, number][]) {
    x += lon;
    y += lat;
  }
  const n = Math.max(1, line.coordinates.length);
  return [x / n, y / n];
}
