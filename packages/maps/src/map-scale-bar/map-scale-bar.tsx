"use client";

import { forwardRef, useEffect, useState, type HTMLAttributes } from "react";
import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { useMap } from "../map-canvas/map-context";
import { useMapBreakpoint } from "../lib/use-map-breakpoint";
import { MAP_CORNER_CLASSES, type MapCorner } from "../map-legend/map-corner";

/** Metric (`km`, falling back to metres) or imperial (`mi`, falling back to feet). */
export type MapScaleUnit = "km" | "mi";

/** The Earth's equatorial circumference in metres (WGS 84), as MapLibre uses it. */
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** MapLibre's world size at zoom 0, in CSS px. */
const TILE_SIZE = 512;
const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;

/** The longest the bar may draw, per tier (CSS px). */
const MAX_BAR_PX = { wide: 112, medium: 96, narrow: 80 } as const;

/** Metres one CSS px covers at `latitude` and `zoom` (Web Mercator). */
export function metresPerPixel(latitude: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
}

/** The largest 1 / 2 / 5 × 10ⁿ that is ≤ `max`. */
export function niceDistance(max: number): number {
  if (!(max > 0) || !Number.isFinite(max)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [5, 2, 1]) {
    if (step * magnitude <= max) return step * magnitude;
  }
  return magnitude;
}

export interface MapScale {
  /** The bar's length in CSS px. */
  px: number;
  /** The distance the bar stands for, in `unit`. */
  value: number;
  /** An `Intl.NumberFormat` unit identifier. */
  unit: "kilometer" | "meter" | "mile" | "foot";
}

/**
 * A round distance that fits in `maxPx` at this latitude and zoom, in `unit`
 * — kilometres (metres below 1 km) or miles (feet below 1 mi).
 */
export function computeMapScale(
  latitude: number,
  zoom: number,
  unit: MapScaleUnit,
  maxPx: number,
): MapScale {
  const perPx = metresPerPixel(latitude, zoom);
  const maxMetres = perPx * maxPx;
  const [big, small, bigM, smallM] =
    unit === "mi"
      ? (["mile", "foot", METRES_PER_MILE, METRES_PER_FOOT] as const)
      : (["kilometer", "meter", 1000, 1] as const);
  const useBig = maxMetres >= bigM;
  const perUnit = useBig ? bigM : smallM;
  const value = niceDistance(maxMetres / perUnit);
  const px = perPx > 0 ? (value * perUnit) / perPx : 0;
  return { px: Math.max(0, px), value, unit: useBig ? big : small };
}

export interface MapScaleBarProps extends HTMLAttributes<HTMLDivElement> {
  /** `km` (default) or `mi`. */
  unit?: MapScaleUnit;
  /** Corner of the map (default `"bottom-left"`). */
  position?: MapCorner;
}

/**
 * A scale bar for the map's centre latitude — a round distance ("50 km") and
 * a bar of that length, re-measured as the map moves or resizes. The bar gets
 * shorter at `narrow`. Render inside `<MapCanvas>`.
 */
export const MapScaleBar = forwardRef<HTMLDivElement, MapScaleBarProps>(function MapScaleBar(
  { unit = "km", position = "bottom-left", className, ...props },
  ref,
) {
  const { map } = useMap();
  const { formatNumber } = useLocale();
  const maxPx = MAX_BAR_PX[useMapBreakpoint()];
  const [scale, setScale] = useState<MapScale | null>(null);

  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      const next = computeMapScale(map.getCenter().lat, map.getZoom(), unit, maxPx);
      setScale((prev) =>
        prev &&
        prev.value === next.value &&
        prev.unit === next.unit &&
        Math.abs(prev.px - next.px) < 0.5
          ? prev
          : next,
      );
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map, unit, maxPx]);

  if (!scale || scale.value <= 0) return null;
  const label = formatNumber(scale.value, {
    style: "unit",
    unit: scale.unit,
    unitDisplay: "short",
  });

  return (
    <div
      ref={ref}
      data-slot="map-scale-bar"
      data-unit={scale.unit}
      data-distance={scale.value}
      className={cn(
        "pointer-events-none absolute z-10 flex flex-col items-start gap-0.5 rounded-sm bg-background/80 px-1.5 py-1",
        MAP_CORNER_CLASSES[position],
        className,
      )}
      {...props}
    >
      <span data-slot="map-scale-bar-label" className="text-meta text-foreground tabular-nums">
        {label}
      </span>
      <span
        aria-hidden="true"
        data-slot="map-scale-bar-bar"
        className="block h-1.5 border-x-2 border-b-2 border-foreground"
        style={{ width: Math.round(scale.px) }}
      />
    </div>
  );
});
