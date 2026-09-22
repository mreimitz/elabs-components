"use client";

/**
 * canvas-selection.tsx — selection gestures over `CanvasLayer` marks (RM-144).
 *
 * A canvas has no DOM per mark, so the marks are REGISTERED in the selection
 * engine's geometry registry from the caller's `selectionMark` accessor — the
 * same registry the SVG families publish into — and a rectangle, lasso or
 * radial resolves to the same `ChartSelectionIntent` an SVG scatter of the same
 * points would emit. The gesture overlay is drawn in a `pointer-events: none`
 * `<svg>` above the pixels; the pointer listeners bind on the layer's root, so
 * the canvas keeps its own hover and click.
 *
 * Axis ranges need gutters a bare canvas does not have: only the in-plot
 * gestures (rect / lasso / radial and the keyboard rectangle) apply here.
 */

import { useMemo } from "react";
import {
  ChartSelectionGestureHost,
  ChartSelectionGesturePlotLayer,
  useChartSelectionGestureScope,
} from "../selection/chart-gesture-layer";
import type { GestureAxis } from "../selection/geometry";
import type { ChartMarkGeometry } from "../selection/hit-test";
import type { ChartSelectionValue } from "../selection/types";

/** Where one canvas datum sits (CSS px inside the layer) and what it selects. */
export interface CanvasSelectionMark {
  x: number;
  y: number;
  category: ChartSelectionValue;
  value?: number;
  seriesKey?: string;
}

export interface CanvasSelectionLayerProps<T> {
  points: readonly T[];
  selectionMark: (datum: T, index: number) => CanvasSelectionMark | null;
  axes?: { x?: GestureAxis; y?: GestureAxis };
  width: number;
  height: number;
}

/** The canvas points as registered marks (visible = inside the layer box). */
export function canvasSelectionMarks<T>(
  points: readonly T[],
  selectionMark: (datum: T, index: number) => CanvasSelectionMark | null,
  width: number,
  height: number,
): ChartMarkGeometry[] {
  const out: ChartMarkGeometry[] = [];
  points.forEach((datum, index) => {
    const mark = selectionMark(datum, index);
    if (!mark || !Number.isFinite(mark.x) || !Number.isFinite(mark.y)) return;
    out.push({
      id: `canvas:${index}`,
      category: mark.category,
      seriesKey: mark.seriesKey,
      datum: datum as Record<string, unknown>,
      index,
      value: mark.value,
      shape: { kind: "point", x: mark.x, y: mark.y },
      visible: mark.x >= 0 && mark.x <= width && mark.y >= 0 && mark.y <= height,
    });
  });
  return out;
}

/** The overlay `<svg>` + the controls host. `null` outside an enabled scope. */
export function CanvasSelectionLayer<T>({
  points,
  selectionMark,
  axes,
  width,
  height,
}: CanvasSelectionLayerProps<T>) {
  const scope = useChartSelectionGestureScope();
  const marks = useMemo(
    () => canvasSelectionMarks(points, selectionMark, width, height),
    [height, points, selectionMark, width],
  );
  if (!scope || width <= 0 || height <= 0) return null;
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        data-slot="canvas-layer-selection"
      >
        <g>
          <ChartSelectionGesturePlotLayer
            field={scope.selectionField ?? "category"}
            // The layer's root (the canvas's own box): pointer events land on the canvas.
            getEventTarget={(layer) => layer.ownerSVGElement?.parentElement ?? null}
            innerHeight={height}
            innerWidth={width}
            margin={{ top: 0, left: 0, bottom: 0 }}
            marks={marks}
            rangeAxes={{ x: false, y: false }}
            xAxis={axes?.x}
            yAxis={axes?.y}
          />
        </g>
      </svg>
      <ChartSelectionGestureHost />
    </>
  );
}
