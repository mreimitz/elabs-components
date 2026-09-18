"use client";

/**
 * custom-shapes.tsx — `CustomShapes` (RM-115): scatter-only, data-space
 * furniture drawn BEHIND the marks — a horizontal/vertical reference line at
 * a constant value (`{ kind: "line", y }` / `{ kind: "line", x }`) or a
 * multi-point line/polygon (`{ kind: "path", points }`), the way
 * Datawrapper's scatter "custom lines & areas" work. Equations beyond a
 * constant (`y=50`, `x=2000`) are out of this item's scope — `points` is the
 * escape hatch for anything else (a fitted curve, a boundary a caller already
 * computed).
 *
 * Compose it as a child of `ScatterChart`, ahead of `Scatter` in JSX order —
 * SVG paints in document order, so an earlier sibling sits behind a later
 * one; `ScatterChart` does not reorder children by role.
 */

import { Fragment, useContext } from "react";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import { NumericXRulerContext } from "./x-scale-mode";

export interface ScatterShapeStyle {
  /** Dash instead of a solid stroke. Default: `false`. */
  dashed?: boolean;
  /** Stroke (and, for a closed path, fill) colour. Default: `--chart-foreground-muted`. */
  color?: string;
  strokeWidth?: number;
}

export type ScatterShapeSpec =
  | { kind: "line"; y: number; label?: string; style?: ScatterShapeStyle }
  | { kind: "line"; x: number | Date; label?: string; style?: ScatterShapeStyle }
  | {
      kind: "path";
      points: Array<[number | Date, number]>;
      /** Join the last point back to the first and fill — an area, not a line. Default: `false`. */
      closed?: boolean;
      label?: string;
      style?: ScatterShapeStyle;
    };

export interface CustomShapesProps {
  shapes: ScatterShapeSpec[];
  /** The y-axis these shapes' `y` values belong to when a chart has several. */
  yAxisId?: string | number;
}

const DASH = "4 3";

/** Raw x value (row-independent, unlike `xAccessor`) → the chart's shared x scale. */
function useXValueToPixel(): (value: number | Date) => number | undefined {
  const { xScale } = useChartStable();
  const numericXRuler = useContext(NumericXRulerContext);
  return (value) => {
    if (value instanceof Date) return xScale(value);
    if (numericXRuler) return xScale(numericXRuler.toPosition(value));
    return xScale(new Date(value));
  };
}

function ShapeLine({
  shape,
  toX,
  innerWidth,
  innerHeight,
  yScale,
}: {
  shape: Extract<ScatterShapeSpec, { kind: "line" }>;
  toX: (value: number | Date) => number | undefined;
  innerWidth: number;
  innerHeight: number;
  yScale: (value: number) => number | undefined;
}) {
  const style = shape.style;
  const stroke = style?.color ?? chartCssVars.foregroundMuted;
  const strokeWidth = style?.strokeWidth ?? 1.5;
  const strokeDasharray = style?.dashed ? DASH : undefined;

  if ("y" in shape) {
    const y = yScale(shape.y);
    if (y === undefined || !Number.isFinite(y)) return null;
    return (
      <line
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
        x1={0}
        x2={innerWidth}
        y1={y}
        y2={y}
      />
    );
  }

  const x = toX(shape.x);
  if (x === undefined || !Number.isFinite(x)) return null;
  return (
    <line
      stroke={stroke}
      strokeDasharray={strokeDasharray}
      strokeWidth={strokeWidth}
      x1={x}
      x2={x}
      y1={0}
      y2={innerHeight}
    />
  );
}

function ShapePath({
  shape,
  toX,
  yScale,
}: {
  shape: Extract<ScatterShapeSpec, { kind: "path" }>;
  toX: (value: number | Date) => number | undefined;
  yScale: (value: number) => number | undefined;
}) {
  const pixels = shape.points
    .map(([x, y]) => {
      const px = toX(x);
      const py = yScale(y);
      return px === undefined || py === undefined || !Number.isFinite(px) || !Number.isFinite(py)
        ? null
        : `${px},${py}`;
    })
    .filter((p): p is string => p !== null);
  if (pixels.length < 2) return null;

  const style = shape.style;
  const stroke = style?.color ?? chartCssVars.foregroundMuted;
  const strokeWidth = style?.strokeWidth ?? 1.5;
  const strokeDasharray = style?.dashed ? DASH : undefined;

  if (shape.closed) {
    return (
      <polygon
        fill={stroke}
        fillOpacity={0.12}
        points={pixels.join(" ")}
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
      />
    );
  }
  return (
    <polyline
      fill="none"
      points={pixels.join(" ")}
      stroke={stroke}
      strokeDasharray={strokeDasharray}
      strokeWidth={strokeWidth}
    />
  );
}

/**
 * Custom lines / areas in data space (RM-115). Pure furniture — `aria-hidden`
 * like every mark; a `label` is decorative-only today (Datawrapper prints it
 * beside the line). Renders nothing for a shape whose value falls outside the
 * current scale's usable range (mirrors `ReferenceLine`'s clip-rather-than-
 * stretch rule).
 */
export function CustomShapes({ shapes, yAxisId }: CustomShapesProps) {
  const { innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale(yAxisId);
  const toX = useXValueToPixel();

  return (
    <g aria-hidden="true" data-slot="scatter-custom-shapes">
      {shapes.map((shape, i) => (
        <Fragment key={i}>
          {shape.kind === "line" ? (
            <ShapeLine
              innerHeight={innerHeight}
              innerWidth={innerWidth}
              shape={shape}
              toX={toX}
              yScale={yScale}
            />
          ) : (
            <ShapePath shape={shape} toX={toX} yScale={yScale} />
          )}
        </Fragment>
      ))}
    </g>
  );
}
CustomShapes.displayName = "CustomShapes";

export default CustomShapes;
