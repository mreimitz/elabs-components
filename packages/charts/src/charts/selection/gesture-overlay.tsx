"use client";

/**
 * gesture-overlay.tsx — the in-progress selection gesture, drawn (RM-142).
 *
 * A `--chart-foreground` hairline over a wider `--chart-background` halo, the
 * same two inks the selected-mark outline uses (`chart-selection.ts`): the
 * pair is ≥10:1 apart in every theme, so against ANY series fill one of the two
 * reads. A faint `--chart-foreground` wash fills the enclosed area so the
 * region, not just its edge, is legible. `pointer-events: none` (the plot
 * underneath keeps receiving the drag) and `aria-hidden` (a gesture in flight
 * is not content — the committed intent is what a host announces).
 */

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { chartCssVars } from "../chart-context";
import { pathToSvgD } from "./geometry";
import type { GestureOverlayGeometry } from "./use-chart-gesture";

/** Stroke of the gesture outline (the hairline family, doubled for a moving target). */
export const GESTURE_OUTLINE_WIDTH = CHART_HAIRLINE_WIDTH * 2;
/** The background halo under the outline. */
export const GESTURE_HALO_WIDTH = GESTURE_OUTLINE_WIDTH + 2;
/** Opacity of the enclosed-area wash. */
export const GESTURE_FILL_OPACITY = 0.08;

export interface GestureOverlayProps {
  geometry: GestureOverlayGeometry | null;
  /** Plot size — a band spans the full cross axis. */
  width: number;
  height: number;
  /** Overrides the group's `data-slot` (a persisted range band, the keyboard rectangle). */
  slot?: string;
}

function Shape({
  geometry,
  width,
  height,
  stroke,
  strokeWidth,
  fill,
  fillOpacity,
}: {
  geometry: GestureOverlayGeometry;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
}) {
  const common = {
    fill,
    fillOpacity,
    stroke,
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
  };
  switch (geometry.kind) {
    case "rect":
      return (
        <rect {...common} height={geometry.h} width={geometry.w} x={geometry.x} y={geometry.y} />
      );
    case "band": {
      const lo = Math.min(geometry.from, geometry.to);
      const size = Math.abs(geometry.to - geometry.from);
      return geometry.axis === "x" ? (
        <rect {...common} height={height} width={size} x={lo} y={0} />
      ) : (
        <rect {...common} height={size} width={width} x={0} y={lo} />
      );
    }
    case "lasso":
      return (
        <path
          {...common}
          d={pathToSvgD(geometry.path, geometry.closed)}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case "radial":
      return <circle {...common} cx={geometry.cx} cy={geometry.cy} r={geometry.r} />;
  }
}

/** Draws the gesture in flight; renders nothing when `geometry` is `null`. */
export function GestureOverlay({ geometry, width, height, slot }: GestureOverlayProps) {
  if (!geometry) return null;
  return (
    <g
      aria-hidden="true"
      data-gesture-kind={geometry.kind}
      data-slot={slot ?? "chart-selection-gesture-overlay"}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <Shape
        fill="none"
        fillOpacity={1}
        geometry={geometry}
        height={height}
        stroke={chartCssVars.background}
        strokeWidth={GESTURE_HALO_WIDTH}
        width={width}
      />
      <Shape
        fill={chartCssVars.foreground}
        fillOpacity={GESTURE_FILL_OPACITY}
        geometry={geometry}
        height={height}
        stroke={chartCssVars.foreground}
        strokeWidth={GESTURE_OUTLINE_WIDTH}
        width={width}
      />
    </g>
  );
}
