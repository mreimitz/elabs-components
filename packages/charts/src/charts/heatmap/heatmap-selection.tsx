"use client";

/**
 * heatmap-selection.tsx — selection gestures on `HeatmapChart` (RM-143 / RM-144).
 *
 * - **Column / row ranges** (`"range"`): the column-label gutter (below the
 *   plot) arms `range-x` over the columns, the row-label gutter `range-y` over
 *   the rows. A column range reports the columns under the `x` field; a row
 *   range the rows under the `y` field (`ChartSelectionIntent.field`).
 * - **Rect / lasso / radial**: cells hit by the `selectionHitRule` (overlap
 *   default); `values` are the hit cells' columns.
 * - Only the cells drawn are registered: a column scrolled out of the category
 *   window is never hit.
 *
 * Renders nothing unless an enabled `ChartSelectionGestureScope` is above.
 */

import { createContext, type ReactNode, use, useMemo } from "react";
import {
  ChartSelectionGestureHitArea,
  ChartSelectionGesturePlotLayer,
  ChartSelectionGestureScope,
  useChartSelectionGestureScope,
} from "../selection/chart-gesture-layer";
import type { BandScaleLike, GestureAxis } from "../selection/geometry";
import type { ChartMarkGeometry } from "../selection/hit-test";
import type { ChartSelectionGestureProps } from "../selection/types";
import type { HeatmapCellDatum } from "./heatmap-context";

const HeatmapFieldsContext = createContext<{ x: string; y: string } | null>(null);

export interface HeatmapSelectionScopeProps extends ChartSelectionGestureProps {
  /** The heatmap's column key (`x`) and row key (`y`). */
  x: string;
  y: string;
  children?: ReactNode;
}

/** The gesture scope + the heatmap's two field names. A pass-through when gestures are off. */
export function HeatmapSelectionScope({ x, y, children, ...gesture }: HeatmapSelectionScopeProps) {
  const fields = useMemo(() => ({ x, y }), [x, y]);
  return (
    <ChartSelectionGestureScope {...gesture}>
      <HeatmapFieldsContext value={fields}>{children}</HeatmapFieldsContext>
    </ChartSelectionGestureScope>
  );
}

/** A band scale over grid indices → a band scale over the labels it draws. */
export function heatmapLabelBand(
  scale: { (index: number): number | undefined; domain(): number[]; bandwidth(): number },
  labels: readonly string[],
): BandScaleLike {
  const indices = scale.domain();
  const drawn = indices.map((index) => labels[index] ?? String(index));
  const byLabel = new Map(drawn.map((label, i) => [label, indices[i] as number]));
  return Object.assign(
    (label: string) => {
      const index = byLabel.get(label);
      return index === undefined ? undefined : scale(index);
    },
    { domain: () => drawn, bandwidth: () => scale.bandwidth() },
  );
}

/** One rect mark per data-backed cell drawn. */
export function heatmapCellMarks(cells: readonly HeatmapCellDatum[]): ChartMarkGeometry[] {
  return cells
    .filter((cell) => cell.index >= 0)
    .map((cell) => ({
      id: `cell:${cell.id}`,
      category: cell.x,
      crossCategory: cell.y,
      datum: cell.datum,
      index: cell.index,
      value: cell.value ?? undefined,
      shape: { kind: "rect" as const, x: cell.x0, y: cell.y0, w: cell.width, h: cell.height },
      visible: true,
    }));
}

type IndexBand = { (index: number): number | undefined; domain(): number[]; bandwidth(): number };

export interface HeatmapSelectionLayerProps {
  cells: readonly HeatmapCellDatum[];
  xScale: IndexBand;
  yScale: IndexBand;
  columnLabels: readonly string[];
  rowLabels: readonly string[];
  innerWidth: number;
  innerHeight: number;
  margin: { top: number; left: number; bottom: number };
}

export { ChartSelectionGestureHitArea as HeatmapSelectionHitArea };

export function HeatmapSelectionLayer(props: HeatmapSelectionLayerProps) {
  const scope = useChartSelectionGestureScope();
  const fields = use(HeatmapFieldsContext);
  if (!scope || !fields) return null;
  return (
    <HeatmapSelectionLayerInner
      {...props}
      field={scope.selectionField ?? fields.x}
      yField={fields.y}
    />
  );
}

function HeatmapSelectionLayerInner({
  cells,
  xScale,
  yScale,
  columnLabels,
  rowLabels,
  innerWidth,
  innerHeight,
  margin,
  field,
  yField,
}: HeatmapSelectionLayerProps & { field: string; yField: string }) {
  const marks = useMemo(() => heatmapCellMarks(cells), [cells]);
  const xAxis = useMemo<GestureAxis>(
    () => ({ kind: "band", scale: heatmapLabelBand(xScale, columnLabels) }),
    [columnLabels, xScale],
  );
  const yAxis = useMemo<GestureAxis>(
    () => ({ kind: "band", scale: heatmapLabelBand(yScale, rowLabels) }),
    [rowLabels, yScale],
  );
  return (
    <ChartSelectionGesturePlotLayer
      axisLabels={{ x: field, y: yField }}
      field={field}
      innerHeight={innerHeight}
      innerWidth={innerWidth}
      margin={margin}
      marks={marks}
      xAxis={xAxis}
      yAxis={yAxis}
      yField={yField}
    />
  );
}
