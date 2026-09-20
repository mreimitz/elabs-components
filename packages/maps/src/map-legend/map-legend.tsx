"use client";

import { forwardRef, useMemo, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  colorScaleFor,
  useLocale,
  type ColorScale,
  type ColorScaleSpec,
  type ColorScaleValue,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { type MapResponsive, useMapFrameSlot, useMapResponsive } from "../lib/use-map-breakpoint";
import { MAP_CORNER_CLASSES, type MapCorner } from "./map-corner";

/** The mark a key row shows: a point, an area or a line marker. */
export type MapLegendShape = "circle" | "square" | "line";

/** One row of a marker key. */
export interface MapLegendItem {
  /** Stable identity; defaults to `label`. */
  id?: string;
  label: string;
  /** Any CSS colour — use a token reference (`var(--chart-1)`), never a literal. */
  color: string;
  /** Default `"circle"`. */
  shape?: MapLegendShape;
}

/**
 * A colour scale to key: one `colorScaleFor` already built (share it with the
 * layer it colours), or the values + spec to build one here.
 */
export type MapLegendScale =
  | ColorScale
  | { values: readonly ColorScaleValue[]; spec: ColorScaleSpec };

/** Outside the map box (`above` / `below`) or over one of its corners. */
export type MapLegendPosition = "above" | "below" | MapCorner;

/** `list`: one row per item. `grid`: items flow into as many columns as fit. */
export type MapLegendLayout = "list" | "grid";

export interface MapLegendProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** A heading for the key. */
  title?: ReactNode;
  /** Marker key rows. */
  items?: readonly MapLegendItem[];
  /** A colour ramp (continuous / stepped) or category key, from `colorScaleFor`. */
  scale?: MapLegendScale;
  /** Default `"list"`. */
  layout?: MapLegendLayout;
  /**
   * Where the key sits, optionally per tier — for example
   * `{ base: "top-left", narrow: "below" }` so it stops covering a phone-width
   * map. Default `"above"`.
   */
  position?: MapResponsive<MapLegendPosition>;
  /** Formats a ramp's tick values (default: the locale's number format). */
  formatValue?: (value: number) => string;
}

const SHAPE_CLASSES: Record<MapLegendShape, string> = {
  circle: "size-2.5 rounded-full",
  square: "size-2.5 rounded-xs",
  line: "h-0.5 w-3.5 rounded-full",
};

const LAYOUT_CLASSES: Record<MapLegendLayout, string> = {
  list: "flex flex-col gap-1",
  // `auto-fit`, never `auto-fill` (c-5): `auto-fill` keeps the tracks a wide
  // strip could hold even when nothing occupies them, so four keys on an
  // 868 px strip got 113.7 px each and "Greater Toronto Area" truncated with
  // three empty tracks beside it. `auto-fit` collapses the empty tracks and
  // the real keys share the full width; a key with more items than fit wraps
  // exactly as before.
  grid: "grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-x-3 gap-y-1",
};

function isColorScale(scale: MapLegendScale): scale is ColorScale {
  return "colorOf" in scale;
}

function Swatch({ color, shape = "circle" }: { color: string; shape?: MapLegendShape }) {
  return (
    <span
      aria-hidden="true"
      data-slot="map-legend-swatch"
      data-shape={shape}
      className={cn("inline-block shrink-0", SHAPE_CLASSES[shape])}
      style={{ background: color }}
    />
  );
}

interface Tick {
  key: string;
  at: number;
  label: string;
}

/** A ramp: stepped swatches or a continuous gradient, with value ticks under it. */
function Ramp({ scale, format }: { scale: ColorScale; format: (value: number) => string }) {
  const ticks: Tick[] = [];
  let strip: ReactNode = null;

  if (scale.type === "stepped" && scale.steps.length > 0) {
    const n = scale.steps.length;
    strip = (
      <div className="flex h-2.5 w-full overflow-hidden rounded-xs">
        {scale.steps.map((step) => (
          <span
            key={`${step.from}-${step.to}`}
            data-slot="map-legend-step"
            className="min-w-0 flex-1"
            style={{ background: step.color }}
          />
        ))}
      </div>
    );
    const first = scale.steps[0];
    if (first) ticks.push({ key: "start", at: 0, label: format(first.from) });
    scale.steps.forEach((step, index) => {
      ticks.push({ key: `to-${step.to}`, at: (index + 1) / n, label: format(step.to) });
    });
  } else if (scale.stops.length > 0) {
    const last = Math.max(1, scale.stops.length - 1);
    const gradient = scale.stops
      .map((stop, index) => `${stop.color} ${(index / last) * 100}%`)
      .join(", ");
    strip = (
      <div
        data-slot="map-legend-gradient"
        className="h-2.5 w-full rounded-xs"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
      />
    );
    const marks = [scale.domain?.[0], scale.center ?? undefined, scale.domain?.[1]];
    for (const value of marks) {
      if (value === undefined) continue;
      const at = scale.positionOf(value);
      if (at === null) continue;
      ticks.push({ key: `v-${value}`, at, label: format(value) });
    }
  }

  if (!strip) return null;
  return (
    // A ramp reads low → high left to right in every writing direction.
    <div dir="ltr" data-slot="map-legend-ramp" className="flex w-48 max-w-full flex-col gap-1">
      {strip}
      <div className="relative h-4">
        {ticks.map((tick) => (
          <span
            key={tick.key}
            data-slot="map-legend-tick"
            className={cn(
              "absolute top-0 text-meta whitespace-nowrap text-muted-foreground tabular-nums",
              tick.at <= 0 ? "" : tick.at >= 1 ? "-translate-x-full" : "-translate-x-1/2",
            )}
            style={{ left: `${Math.min(1, Math.max(0, tick.at)) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * MapLegend — the map's key: marker rows (`items`) and / or a colour ramp
 * (`scale`, built with `colorScaleFor` from `@elabs-ai/components-ui`, so its
 * colours are token references in every theme). It sits above or below the
 * map box, or over a corner, per tier; the house legend look (`text-meta`,
 * dot markers) matches `charts`' `ChartLegend`. Render inside `<MapCanvas>`.
 */
export const MapLegend = forwardRef<HTMLDivElement, MapLegendProps>(function MapLegend(
  {
    title,
    items,
    scale: scaleInput,
    layout = "list",
    position: positionProp = "above",
    formatValue,
    className,
    ...props
  },
  ref,
) {
  const { formatNumber } = useLocale();
  const position = useMapResponsive(positionProp);
  const outside = position === "above" || position === "below" ? position : null;
  const slot = useMapFrameSlot(outside);

  const scale = useMemo<ColorScale | null>(() => {
    if (!scaleInput) return null;
    return isColorScale(scaleInput)
      ? scaleInput
      : colorScaleFor(scaleInput.values, scaleInput.spec);
  }, [scaleInput]);
  const format = formatValue ?? ((value: number) => formatNumber(value));

  const rows: MapLegendItem[] = [
    ...(items ?? []),
    ...(scale?.palette === "categorical"
      ? scale.categories.map((category) => ({
          id: `category-${category.value}`,
          label: String(category.value),
          color: category.color,
          shape: "square" as const,
        }))
      : []),
  ];
  const showRamp = scale !== null && scale.palette !== "categorical";

  const body = (
    <div
      ref={ref}
      data-slot="map-legend"
      data-position={position}
      data-layout={layout}
      className={cn(
        "flex flex-col gap-1.5 text-meta text-foreground",
        outside
          ? "w-full"
          : cn(
              "absolute z-10 max-w-[calc(100%-1rem)] rounded-md bg-background/90 px-2 py-1.5 shadow-ring-sm",
              MAP_CORNER_CLASSES[position as MapCorner],
            ),
        className,
      )}
      {...props}
    >
      {title && (
        <div data-slot="map-legend-title" className="font-medium">
          {title}
        </div>
      )}
      {rows.length > 0 && (
        <ul
          data-slot="map-legend-items"
          className={cn("m-0 list-none p-0", LAYOUT_CLASSES[layout])}
        >
          {rows.map((item) => (
            <li
              key={item.id ?? item.label}
              data-slot="map-legend-item"
              className="flex min-w-0 items-center gap-1.5"
            >
              <Swatch color={item.color} shape={item.shape} />
              <span className="min-w-0 truncate">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      {showRamp && scale && <Ramp scale={scale} format={format} />}
    </div>
  );

  if (outside) return slot ? createPortal(body, slot) : null;
  return body;
});
