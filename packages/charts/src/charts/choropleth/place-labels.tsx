"use client";

/**
 * place-labels.tsx — region names on a choropleth (RM-124).
 *
 * One label per region at its centroid, at most 30, placed through RM-110's
 * `layoutLabels` (the one collision engine): the highest-priority label keeps
 * its spot, a colliding one is nudged a few px, and one that still collides is
 * dropped. At the `narrow` tier no label is painted — the regions are too
 * small to carry a name — and every dropped name is restated `sr-only` by the
 * chart, so a label the eye cannot see is still in the text.
 */

import { HaloText } from "../../marks/halo-text";
import type { ChartBreakpoint } from "../chart-breakpoint";
import { layoutLabels, type LabelBox } from "../labels/label-layout";
import { LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "../labels/use-chart-labels";
import { estimateTextWidth } from "../use-text-measurer";

/** The most place labels a map paints (Datawrapper's cap). */
export const MAX_PLACE_LABELS = 30;

/** `labels` on `ChoroplethChart`. */
export interface ChoroplethPlaceLabelsConfig {
  /** Feature property holding the label text. Default `"name"`. */
  key?: string;
  /** How many labels at most. Default and cap: 30. */
  max?: number;
  /** Numeric feature property ranking the labels (higher survives). Default: the colour-scale value. */
  priority?: string;
  /** Run the collision pass. `false` paints every label up to `max`, overlaps included. Default `true`. */
  collision?: boolean;
}

/** One candidate label: text at a projected point, with its rank. */
export interface PlaceLabelCandidate {
  id: string;
  text: string;
  x: number;
  y: number;
  priority: number;
}

export interface PlaceLabelPlacement {
  id: string;
  text: string;
  /** Centre of the painted text. */
  x: number;
  y: number;
}

export interface PlaceLabelLayout {
  painted: PlaceLabelPlacement[];
  /** Texts not painted (collision, the `max` cap, or the narrow tier). */
  dropped: string[];
}

/** Largest move the solver may make, px — a place label drifts only a little from its region. */
const PLACE_LABEL_MAX_NUDGE = 6;

/**
 * Lay out place labels inside a `width × height` plot. Pure and
 * deterministic: equal input gives equal output.
 */
export function layoutPlaceLabels(
  candidates: readonly PlaceLabelCandidate[],
  config: ChoroplethPlaceLabelsConfig,
  plot: { width: number; height: number; breakpoint: ChartBreakpoint },
): PlaceLabelLayout {
  const max = Math.max(0, Math.min(MAX_PLACE_LABELS, Math.floor(config.max ?? MAX_PLACE_LABELS)));
  const ranked = [...candidates]
    .filter((c) => c.text.trim() !== "" && Number.isFinite(c.x) && Number.isFinite(c.y))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const kept = ranked.slice(0, max);
  const capped = ranked.slice(max).map((c) => c.text);
  if (plot.breakpoint === "narrow" || plot.width <= 0 || plot.height <= 0) {
    return { painted: [], dropped: [...kept.map((c) => c.text), ...capped] };
  }
  const boxes: (LabelBox & { candidate: PlaceLabelCandidate })[] = kept.map((c, index) => {
    const width = estimateTextWidth(c.text, LABEL_FONT_SIZE);
    return {
      id: c.id,
      x: c.x - width / 2,
      y: c.y - LABEL_LINE_HEIGHT / 2,
      width,
      height: LABEL_LINE_HEIGHT,
      priority: kept.length - index,
      anchorSide: "left",
      candidate: c,
    };
  });
  if (config.collision === false) {
    return {
      painted: kept.map((c) => ({ id: c.id, text: c.text, x: c.x, y: c.y })),
      dropped: capped,
    };
  }
  const result = layoutLabels(boxes, {
    maxNudge: PLACE_LABEL_MAX_NUDGE,
    bounds: { x: 0, y: 0, width: plot.width, height: plot.height },
  });
  return {
    painted: result.placed.map((p) => ({
      id: p.id,
      text: p.label.candidate.text,
      x: p.x + p.label.width / 2,
      y: p.y + LABEL_LINE_HEIGHT / 2,
    })),
    dropped: [...result.dropped.map((label) => label.candidate.text), ...capped],
  };
}

/** The painted labels, inside the chart's `aria-hidden` `<svg>`. */
export function ChoroplethPlaceLabels({ labels }: { labels: readonly PlaceLabelPlacement[] }) {
  return (
    <g
      aria-hidden="true"
      data-painted-count={labels.length}
      data-slot="choropleth-place-labels"
      pointerEvents="none"
    >
      {labels.map((label) => (
        <HaloText
          data-slot="choropleth-place-label"
          dominantBaseline="middle"
          fontSize={LABEL_FONT_SIZE}
          fontWeight={600}
          key={label.id}
          textAnchor="middle"
          x={label.x}
          y={label.y}
        >
          {label.text}
        </HaloText>
      ))}
    </g>
  );
}

ChoroplethPlaceLabels.displayName = "ChoroplethPlaceLabels";
