import { useMemo } from "react";
import { BaseEdge, useEdges, useInternalNode, type Edge, type EdgeProps } from "@xyflow/react";
import {
  computeEdgeWeightScale,
  DEFAULT_EDGE_WIDTH_RANGE,
  EdgeLabelPill,
  type WeightedEdgeLike,
} from "../flow-weighted-edge";
import { DEFAULT_LOOP_RADIUS, selfLoopPath } from "./self-loop-geometry";

export interface FlowSelfLoopEdgeData extends Record<string, unknown> {
  /**
   * Frequency/volume this loop carries. Scaled into stroke width by the SAME
   * `computeEdgeWeightScale` domain as `FlowWeightedEdge`, so a loop's weight
   * is directly comparable with the forward edges around it.
   */
  weight?: number;
  /** Edges sharing a `scaleGroup` share one min-max width domain. @default all edges in the flow */
  scaleGroup?: string;
  /** Primary edge-label-pill text, e.g. a repeat count. */
  label?: string;
  /** Secondary edge-label-pill text, e.g. an average duration. */
  secondaryLabel?: string;
  /** Radius of the arc, in px. @default 28 */
  loopRadius?: number;
  /**
   * Overrides the accessible name given to the loop's graphic. Defaults to
   * "Self-loop on <node> — this step repeats".
   */
  loopLabel?: string;
}

export type BrandFlowSelfLoopEdge = Edge<FlowSelfLoopEdgeData, "self-loop">;

/** Node `data` shapes a title can be read from — `FlowNode`'s is `{ title }`. */
function nodeName(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "title" in data) {
    const title = (data as { title?: unknown }).title;
    if (typeof title === "string" && title.length > 0) return title;
  }
  return fallback;
}

/**
 * Branded self-loop edge: an edge whose `source === target` — the "this step
 * repeated" signal of a process map. Register it in
 * `edgeTypes={{ "self-loop": FlowSelfLoopEdge }}` and create edges with
 * `type: "self-loop"` and `data: FlowSelfLoopEdgeData`.
 *
 * dagre cannot lay a self-loop out, so `layoutFlow` withholds them from the
 * graph entirely and reports their ids in `selfLoops` — this component draws
 * one from the node's own live geometry instead of from handle coordinates,
 * which for a self-loop point at opposite sides of a single node and describe
 * no useful curve. It anchors to the node's top edge (via `useInternalNode`),
 * falling back to the handle midpoint before the node is measured, so the arc
 * is never `NaN`.
 *
 * The loop is distinguished from a forward edge by its SHAPE, not by colour —
 * a closed arc above the node, legible in greyscale and in every theme — and
 * publishes that meaning as a real accessible name, because a `data-slot` is
 * invisible to assistive technology. Its label is an `EdgeLabelPill` at the
 * arc's apex, a genuine keyboard tab stop with a visible focus ring.
 *
 * Stroke width comes from the same `computeEdgeWeightScale` domain
 * `FlowWeightedEdge` uses, so a loop weighted 8 reads as thick as a forward
 * edge weighted 8. Nothing animates, so there is no motion to reduce.
 */
export function FlowSelfLoopEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps<BrandFlowSelfLoopEdge>) {
  const edges = useEdges();
  const widthByEdgeId = useMemo(
    () => computeEdgeWeightScale(edges as unknown as WeightedEdgeLike[]),
    [edges],
  );
  const node = useInternalNode(source);

  const measuredWidth = node?.measured?.width;
  const anchor = useMemo(() => {
    if (node && measuredWidth) {
      return {
        centerX: node.internals.positionAbsolute.x + measuredWidth / 2,
        topY: node.internals.positionAbsolute.y,
      };
    }
    // Before measurement lands, the two handle points still bracket the node.
    return { centerX: (sourceX + targetX) / 2, topY: Math.min(sourceY, targetY) };
  }, [node, measuredWidth, sourceX, targetX, sourceY, targetY]);

  const loopRadius = data?.loopRadius ?? DEFAULT_LOOP_RADIUS;
  const { path, labelX, labelY } = useMemo(
    () => selfLoopPath(anchor, loopRadius),
    [anchor, loopRadius],
  );

  const scaledWidth = widthByEdgeId.get(id) ?? DEFAULT_EDGE_WIDTH_RANGE[0];
  const stroke = selected ? "var(--ring)" : "var(--flow-edge)";
  const strokeWidth = selected ? scaledWidth + 1.5 : scaledWidth;

  const accessibleName =
    data?.loopLabel ?? `Self-loop on ${nodeName(node?.data, source)} — this step repeats`;

  return (
    <>
      <g role="img" aria-label={accessibleName}>
        <BaseEdge
          id={id}
          path={path}
          markerEnd={markerEnd}
          data-slot="flow-self-loop-edge"
          className="transition-[stroke,stroke-width] duration-fast ease-standard"
          style={{ stroke, strokeWidth, fill: "none", ...style }}
        />
      </g>
      <EdgeLabelPill
        label={data?.label}
        secondaryLabel={data?.secondaryLabel}
        x={labelX}
        y={labelY}
        selected={selected}
      />
    </>
  );
}
