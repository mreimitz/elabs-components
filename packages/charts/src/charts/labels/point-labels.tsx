"use client";

import { useMemo } from "react";
import { HaloText } from "../../marks/halo-text";
import { useChartStable } from "../chart-context";
import { useTextMeasurerOf } from "../use-text-measurer";
import { type LabelBox, layoutLabels } from "./label-layout";
import { useReportUnpaintedLabels } from "./unpainted-labels";
import { LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "./use-chart-labels";

/**
 * Scatter point labels (RM-110). `key` names the row field holding the label
 * text. `mode`: `"auto"` — every point is a candidate, but a plot keeps at
 * most one label per {@link AUTO_LABEL_AREA_PX} px² (width-driven culling:
 * fewer labels at 380 px than at 900 px), highest priority first; `"all"` —
 * every point is a candidate, only label collisions drop one; a predicate
 * picks the candidates.
 * `priority` decides who survives a collision (default: the y value — higher
 * wins). Every dropped label is restated `sr-only`.
 */
export interface ScatterLabels {
  key: string;
  mode?: "auto" | "all" | ((d: Record<string, unknown>) => boolean);
  priority?: (d: Record<string, unknown>) => number;
}

/** One point as the scatter mark positions it (plot px). */
export interface PointLabelDatum {
  index: number;
  d: Record<string, unknown>;
  cx: number;
  cy: number;
  value: number | string;
}

/** Gap between a marker's edge and its label, px. */
const POINT_LABEL_GAP = 3;
/** Plot area per label `"auto"` allows, px² (≈ a 110 × 55 px cell). */
export const AUTO_LABEL_AREA_PX = 6000;
/** Largest vertical move of a point label, px. */
const POINT_LABEL_MAX_NUDGE = 10;

interface PointLabelBox extends LabelBox {
  text: string;
}

export interface PointLabelsProps {
  points: readonly PointLabelDatum[];
  labels: ScatterLabels;
  /** Marker radius, px. */
  radius: number;
  /** Identity of the reporting series (its `dataKey`). */
  seriesKey: string;
}

/** Paints the placed labels; reports the dropped ones for the `sr-only` restatement. */
export function PointLabels({ points, labels, radius, seriesKey }: PointLabelsProps) {
  const { containerRef, innerWidth, innerHeight } = useChartStable();
  const { measure } = useTextMeasurerOf(containerRef);
  const { key, mode = "auto", priority } = labels;

  const layout = useMemo(() => {
    const candidates = points.filter((p) => {
      const text = p.d[key];
      if (text == null || text === "") return false;
      return typeof mode === "function" ? mode(p.d) : true;
    });
    const boxes: PointLabelBox[] = candidates.map((p, order) => {
      const text = String(p.d[key]);
      const width = measure(text);
      const right = p.cx + radius + POINT_LABEL_GAP;
      const fitsRight = right + width <= innerWidth;
      const numeric = typeof p.value === "number" ? p.value : 0;
      return {
        id: `${seriesKey}:${p.index}`,
        text,
        x: fitsRight ? right : p.cx - radius - POINT_LABEL_GAP - width,
        y: p.cy - LABEL_LINE_HEIGHT / 2,
        width,
        height: LABEL_LINE_HEIGHT,
        // Higher first; the input order breaks ties inside the solver.
        priority: priority ? priority(p.d) : numeric - order * 1e-9,
        anchorSide: fitsRight ? "left" : "right",
      };
    });
    // "auto": width-driven budget — keep the top-priority candidates only.
    const budget =
      mode === "auto"
        ? Math.max(1, Math.floor((innerWidth * innerHeight) / AUTO_LABEL_AREA_PX))
        : Number.POSITIVE_INFINITY;
    const ranked = boxes
      .map((box, order) => ({ box, order }))
      .sort((a, b) => (b.box.priority ?? 0) - (a.box.priority ?? 0) || a.order - b.order);
    const overBudget = new Set(ranked.slice(budget).map((r) => r.box.id));
    const solved = layoutLabels(
      boxes.filter((b) => !overBudget.has(b.id)),
      {
        maxNudge: POINT_LABEL_MAX_NUDGE,
        padding: 1,
        bounds: {
          x: 0,
          y: -LABEL_LINE_HEIGHT,
          width: innerWidth,
          height: innerHeight + LABEL_LINE_HEIGHT,
        },
      },
    );
    return {
      placed: solved.placed,
      dropped: boxes.filter((b) => overBudget.has(b.id) || solved.dropped.includes(b)),
    };
  }, [points, key, mode, priority, measure, radius, innerWidth, innerHeight, seriesKey]);

  useReportUnpaintedLabels(
    `points:${seriesKey}`,
    layout.dropped.map((d) => d.text),
  );

  if (layout.placed.length === 0) return null;
  return (
    <g aria-hidden="true" data-slot="scatter-point-labels">
      {layout.placed.map((p) => (
        <HaloText
          data-slot="scatter-point-label"
          dominantBaseline="central"
          fontSize={LABEL_FONT_SIZE}
          key={p.id}
          x={p.x}
          y={p.y + LABEL_LINE_HEIGHT / 2}
        >
          {p.label.text}
        </HaloText>
      ))}
    </g>
  );
}
