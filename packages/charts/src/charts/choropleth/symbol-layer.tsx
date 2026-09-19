"use client";

/**
 * symbol-layer.tsx — proportional symbols on a choropleth (RM-124).
 *
 * One symbol per feature centroid (or per `points` row, by lon / lat), sized
 * by `sizeKey` through `areaRadius` — the AREA encodes the value, so a 4×
 * value draws a 2× radius (RM-039 honesty) — in one of the eight marker
 * shapes or as a spike, whose HEIGHT is the value (a length mark, zero-based).
 * On a plot narrower than 700 px every symbol shrinks by `sqrt(width / 700)`
 * (Datawrapper's "reduce symbol size on narrow"), so the map does not drown.
 *
 * Clustering is out of scope here: for thousands of points on a slippy map,
 * `MapClusterLayer` in `@elabs-ai/components-maps` is the tool.
 */

import { colorScaleFor } from "@elabs-ai/components-ui";
import { geoCentroid } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { areaRadius } from "../../marks/area-radius";
import type { SeriesMarkerShape } from "../series-pattern";
import { StaticSeriesPointMarker } from "../series-point-marker";
import type { ChoroplethFeatureProperties } from "./choropleth-context";
import { featureValueAt } from "./fit-to-data";

/** A symbol placed by coordinates instead of at a feature centroid. */
export interface ChoroplethSymbolPoint {
  lon: number;
  lat: number;
  /** Shown in the symbol's accessible restatement. */
  name?: string;
  [key: string]: unknown;
}

/** `symbols` on `ChoroplethChart`. */
export interface ChoroplethSymbolsConfig {
  /** The value field the symbols encode. Default `"value"`. */
  key?: string;
  /** The field that sizes the symbols. Default: `key`. */
  sizeKey?: string;
  /** Marker shape, or `"spike"` (height encodes the value). Default `"circle"`. */
  shape?: SeriesMarkerShape | "spike";
  /** A numeric field that colours the symbols along the sequential ramp. Default: one ink. */
  colorBy?: string;
  /** Radius (spike: half the height) of the largest value, in px, before the narrow shrink. Default 20. */
  maxSize?: number;
  /** Place symbols at these lon / lat rows instead of the feature centroids. */
  points?: readonly ChoroplethSymbolPoint[];
}

/** One symbol, projected and sized. */
export interface ChoroplethSymbol {
  id: string;
  name: string;
  x: number;
  y: number;
  value: number;
  /** Radius (circle and shapes) or half the spike height, px. */
  radius: number;
  color: string;
}

/** Default radius of the largest symbol, px. */
export const DEFAULT_SYMBOL_MAX_SIZE = 20;

/** Datawrapper's narrow shrink: `sqrt(width / 700)`, never above 1. */
export function symbolShrink(width: number): number {
  if (!(width > 0)) return 0;
  return Math.min(1, Math.sqrt(width / 700));
}

type SymbolSource = {
  id: string;
  name: string;
  coords: [number, number];
  props: Record<string, unknown>;
};

function numberAt(props: Record<string, unknown>, key: string): number | undefined {
  return featureValueAt({ type: "Feature", geometry: null, properties: props }, key);
}

/**
 * Size and colour every symbol for a plot `width` px wide. `project` maps
 * `[lon, lat]` to plot pixels. Largest first, so smaller symbols paint on top.
 */
export function layoutSymbols(
  config: ChoroplethSymbolsConfig,
  features: readonly Feature<Geometry, ChoroplethFeatureProperties>[],
  project: (coords: [number, number]) => [number, number] | null,
  width: number,
): ChoroplethSymbol[] {
  const key = config.key ?? "value";
  const sizeKey = config.sizeKey ?? key;
  const sources: SymbolSource[] = config.points
    ? config.points.map((point, index) => ({
        id: `point-${point.name ?? index}-${point.lon}-${point.lat}`,
        name: point.name ?? `${point.lat}, ${point.lon}`,
        coords: [point.lon, point.lat],
        props: point,
      }))
    : features.flatMap((feature, index) => {
        let centroid: [number, number];
        try {
          centroid = geoCentroid(feature) as [number, number];
        } catch {
          return [];
        }
        if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) return [];
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const name = typeof props.name === "string" ? props.name : String(props.id ?? index + 1);
        return [{ id: String(props.id ?? feature.id ?? index), name, coords: centroid, props }];
      });

  const sized = sources
    .map((source) => ({ source, value: numberAt(source.props, sizeKey) }))
    .filter((entry): entry is { source: SymbolSource; value: number } => entry.value !== undefined);
  const max = sized.reduce((m, entry) => Math.max(m, entry.value), 0);
  const rMax = Math.max(0, (config.maxSize ?? DEFAULT_SYMBOL_MAX_SIZE) * symbolShrink(width));

  const colorScale = config.colorBy
    ? colorScaleFor(
        sized.map((entry) => numberAt(entry.source.props, config.colorBy as string)),
        { type: "continuous" },
      )
    : null;

  const out: ChoroplethSymbol[] = [];
  for (const { source, value } of sized) {
    const projected = project(source.coords);
    if (!projected) continue;
    const radius =
      config.shape === "spike"
        ? rMax > 0 && max > 0
          ? (Math.max(0, value) / max) * rMax
          : 0
        : areaRadius(value, max, rMax);
    if (!(radius > 0)) continue;
    const color =
      (colorScale && colorScale.colorOf(numberAt(source.props, config.colorBy as string))) ??
      (colorScale ? "var(--muted)" : "var(--chart-1)");
    out.push({
      id: source.id,
      name: source.name,
      x: projected[0],
      y: projected[1],
      value,
      radius,
      color,
    });
  }
  return out.sort((a, b) => b.radius - a.radius || a.id.localeCompare(b.id));
}

/** The symbols, inside the chart's `aria-hidden` `<svg>`. */
export function ChoroplethSymbolLayer({
  symbols,
  shape = "circle",
}: {
  symbols: readonly ChoroplethSymbol[];
  shape?: ChoroplethSymbolsConfig["shape"];
}) {
  return (
    <g aria-hidden="true" data-slot="choropleth-symbols" pointerEvents="none">
      {symbols.map((symbol) => (
        <g
          data-radius={Math.round(symbol.radius * 100) / 100}
          data-slot="choropleth-symbol"
          data-value={symbol.value}
          key={symbol.id}
        >
          {shape === "spike" ? (
            <path
              d={`M${symbol.x - Math.max(2, symbol.radius / 4)},${symbol.y}L${symbol.x},${symbol.y - symbol.radius * 2}L${symbol.x + Math.max(2, symbol.radius / 4)},${symbol.y}Z`}
              fill={symbol.color}
              fillOpacity={0.85}
              stroke={symbol.color}
              strokeLinejoin="round"
              strokeWidth={1}
            />
          ) : shape === "circle" ? (
            <circle
              cx={symbol.x}
              cy={symbol.y}
              fill={symbol.color}
              fillOpacity={0.8}
              r={symbol.radius}
              stroke="var(--background)"
              strokeWidth={1}
            />
          ) : (
            <StaticSeriesPointMarker
              cx={symbol.x}
              cy={symbol.y}
              fill={symbol.color}
              radius={symbol.radius}
              ringGap={0}
              shape={shape}
              strokeWidth={0}
            />
          )}
        </g>
      ))}
    </g>
  );
}

ChoroplethSymbolLayer.displayName = "ChoroplethSymbolLayer";
