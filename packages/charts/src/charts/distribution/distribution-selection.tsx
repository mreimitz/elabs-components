"use client";

/**
 * distribution-selection.tsx — selection gestures on `DistributionChart`
 * (RM-143 / RM-144).
 *
 * - **Value range** (`"range"`): the value axis's gutter arms a range; it
 *   resolves to every RECORD whose value lies in `[lo, hi]` — whatever `kind`
 *   draws them (a box summarises the same records a strip shows). `values` are
 *   the records' `selectionField` values (default: the value itself).
 * - **Rect / lasso / radial** (`"rect"` …): strips only — the one kind whose
 *   marks ARE the records; the dots are registered at the exact seeded-jitter
 *   positions `DistributionStrip` draws them at.
 *
 * Renders `null` unless an enabled `ChartSelectionGestureScope` is above.
 */

import { useMemo } from "react";
import { seededRnd } from "../../marks";
import type { BandScaleLike, GestureAxis, LinearScaleLike } from "../selection/geometry";
import type { ChartMarkGeometry } from "../selection/hit-test";
import {
  ChartSelectionGesturePlotLayer,
  useChartSelectionGestureScope,
} from "../selection/chart-gesture-layer";
import type { ChartSelectionValue } from "../selection/types";
import type { DistributionGeometry } from "./distribution-geometry";
import type { DistributionGroup } from "./distribution-groups";
import type { DistributionKind } from "./distribution-kind";
import { JITTER_K, STRIP_JITTER } from "./kinds/strip";

function isSelectionValue(value: unknown): value is ChartSelectionValue {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (value instanceof Date && Number.isFinite(value.getTime()))
  );
}

/** One mark per record, at the position the kind draws it (strip jitter, else the band centre). */
export function distributionRecordMarks(
  geometry: DistributionGeometry,
  groups: readonly DistributionGroup[],
  kind: DistributionKind,
  field: string,
  valueKey: string,
): ChartMarkGeometry[] {
  const out: ChartMarkGeometry[] = [];
  for (const group of groups) {
    group.values.forEach((value, i) => {
      const jitter =
        kind === "strip" ? (seededRnd(i, group.index * 13 + JITTER_K) - 0.5) * 2 * STRIP_JITTER : 0;
      const point = geometry.point(value, group.index, jitter);
      const row = group.rows[i] ?? {};
      const own = row[field];
      out.push({
        id: `record:${group.index}:${i}`,
        category: isSelectionValue(own) ? own : value,
        crossCategory: group.label,
        seriesKey: valueKey,
        datum: row,
        index: group.rowIndices[i] ?? i,
        value,
        shape: { kind: "point", x: point.x, y: point.y },
        visible: true,
      });
    });
  }
  return out;
}

/** The value axis and the group band axis, as the engine's gesture axes. */
export function distributionGestureAxes(
  geometry: DistributionGeometry,
  groups: readonly DistributionGroup[],
): { value: GestureAxis; cross: GestureAxis } {
  const valueScale = Object.assign((value: number) => geometry.valuePos(value), {
    invert: (px: number) => geometry.valueAt(px),
    ticks: (count?: number) => geometry.valueTicks(count),
  }) satisfies LinearScaleLike;
  const labels = groups.map((group) => group.label);
  const crossScale = Object.assign(
    (label: string) => {
      const index = labels.indexOf(label);
      return index < 0 ? undefined : index * geometry.bandSize;
    },
    { domain: () => labels, bandwidth: () => geometry.bandSize },
  ) satisfies BandScaleLike;
  return {
    value: { kind: "linear", scale: valueScale },
    cross: { kind: "band", scale: crossScale },
  };
}

export interface DistributionSelectionLayerProps {
  geometry: DistributionGeometry;
  groups: readonly DistributionGroup[];
  kind: DistributionKind;
  valueKey: string;
  formatValue: (value: number) => string;
}

export function DistributionSelectionLayer(props: DistributionSelectionLayerProps) {
  const scope = useChartSelectionGestureScope();
  if (!scope) return null;
  return (
    <DistributionSelectionLayerInner {...props} field={scope.selectionField ?? props.valueKey} />
  );
}

function DistributionSelectionLayerInner({
  geometry,
  groups,
  kind,
  valueKey,
  formatValue,
  field,
}: DistributionSelectionLayerProps & { field: string }) {
  const marks = useMemo(
    () => distributionRecordMarks(geometry, groups, kind, field, valueKey),
    [field, geometry, groups, kind, valueKey],
  );
  const axes = useMemo(() => distributionGestureAxes(geometry, groups), [geometry, groups]);
  const horizontal = geometry.orientation === "horizontal";
  const formatters = useMemo(
    () => (horizontal ? { x: formatValue } : { y: formatValue }),
    [formatValue, horizontal],
  );
  return (
    <ChartSelectionGesturePlotLayer
      areaEnabled={kind === "strip"}
      axisLabels={horizontal ? { x: valueKey } : { y: valueKey }}
      field={field}
      formatValue={formatters}
      innerHeight={geometry.plotHeight}
      innerWidth={geometry.plotWidth}
      margin={geometry.margin}
      marks={marks}
      rangeAxes={{ x: horizontal, y: !horizontal }}
      xAxis={horizontal ? axes.value : axes.cross}
      yAxis={horizontal ? axes.cross : axes.value}
    />
  );
}
