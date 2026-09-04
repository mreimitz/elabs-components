/**
 * weight-scale — pure, framework-free "edge weight → stroke width" scale.
 *
 * `FlowWeightedEdge` calls this with every edge in the flow (via `useEdges()`,
 * memoized) so a group of edges can be min-maxed against ONE shared domain
 * instead of each edge picking its own arbitrary width. No React, no DOM: a
 * sibling (e.g. RM-045's continuous `Legend`) can call it directly to render
 * the same ramp the edges use, and it is trivially unit-testable.
 */

/** Minimal edge shape the scale needs — a subset of `Edge<FlowWeightedEdgeData>`. */
export interface WeightedEdgeLike {
  id: string;
  data?: {
    weight?: number;
    scaleGroup?: string;
  };
}

export interface EdgeWeightScaleOptions {
  /** Output stroke-width range, in px. @default [1.5, 8] */
  widthRange?: [number, number];
  /**
   * Restrict the domain calculation (and the returned map) to edges whose
   * `data.scaleGroup` equals this value — edges in a different group are
   * skipped entirely. Omit to compute one scale per distinct `scaleGroup`
   * present in `edges` (edges with no `scaleGroup` share one implicit
   * default group, so a flow that never sets it still gets one shared
   * domain — "all edges in the same `<ReactFlow>`").
   */
  scaleGroup?: string;
}

/** Matches today's fixed 1.5px `FlowEdge` stroke, so an unweighted edge is unchanged. */
export const DEFAULT_EDGE_WIDTH_RANGE: [number, number] = [1.5, 8];

const DEFAULT_SCALE_GROUP = "__default__";

/**
 * Resolve every edge's `data.weight` into a stroke-width, linearly min-maxed
 * into `widthRange` per `scaleGroup`. An edge with no `data.weight` gets the
 * range floor — the existing fixed 1.5px `FlowEdge` already draws, so a plain
 * edge renders unchanged. An edge that is the only member of its group (or
 * whose group has zero weight variance) gets the midpoint of the range —
 * there is no domain to compare it against.
 */
export function computeEdgeWeightScale(
  edges: WeightedEdgeLike[],
  opts: EdgeWeightScaleOptions = {},
): Map<string, number> {
  const [minWidth, maxWidth] = opts.widthRange ?? DEFAULT_EDGE_WIDTH_RANGE;
  const result = new Map<string, number>();
  const groups = new Map<string, { id: string; weight: number }[]>();

  for (const edge of edges) {
    const weight = edge.data?.weight;
    if (weight === undefined) {
      result.set(edge.id, minWidth);
      continue;
    }
    const group = edge.data?.scaleGroup ?? DEFAULT_SCALE_GROUP;
    if (opts.scaleGroup !== undefined && group !== opts.scaleGroup) continue;
    const list = groups.get(group);
    if (list) list.push({ id: edge.id, weight });
    else groups.set(group, [{ id: edge.id, weight }]);
  }

  for (const list of groups.values()) {
    let min = Infinity;
    let max = -Infinity;
    for (const { weight } of list) {
      if (weight < min) min = weight;
      if (weight > max) max = weight;
    }
    const span = max - min;
    for (const { id, weight } of list) {
      const width =
        span === 0
          ? (minWidth + maxWidth) / 2
          : minWidth + ((weight - min) / span) * (maxWidth - minWidth);
      result.set(id, width);
    }
  }

  return result;
}
