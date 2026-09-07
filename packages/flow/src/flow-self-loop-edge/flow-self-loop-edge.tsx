import { useMemo } from "react";
import { useEdges, useInternalNode, type Edge, type EdgeProps } from "@xyflow/react";
import { FlowEdgePath } from "../flow-edge-path";
import {
  computeEdgeWeightScale,
  DEFAULT_EDGE_WIDTH_RANGE,
  EdgeLabelPill,
  type EdgeLabelPillProps,
  type WeightedEdgeLike,
} from "../flow-weighted-edge";
import { DEFAULT_LOOP_RADIUS, selfLoopHandleArc, selfLoopPath } from "./self-loop-geometry";

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
  /**
   * Passed straight through to the rendered `EdgeLabelPill`'s `className`/`...props`
   * (see `EdgeLabelPillProps`) — the seam a composing package (e.g.
   * `@elabs-ai/components-process`'s `ProcessTransitionEdge`) uses to reach the pill's
   * own root button from outside this component, without a new semantic prop here.
   */
  labelProps?: Omit<EdgeLabelPillProps, "label" | "secondaryLabel" | "x" | "y" | "selected">;
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
 * the arc itself, from the node's own live geometry (`useInternalNode`).
 *
 * ## It terminates ON the handle dots, like every other brand edge
 *
 * The two handle points of a self-loop sit on OPPOSITE sides of one node, so they
 * describe no useful straight line — which is why this edge used to ignore them and
 * arc over the node's top edge instead, with its feet on bare border a loop-radius
 * away from the nearest dot. Measured on the process map, that read as a detached
 * arc floating above the card: 24 px clear of any dot in a top-to-bottom layout, and
 * 69 px in a left-to-right one, where the loop stayed stubbornly on TOP while the
 * flow (and the handles) had moved to the sides. Both are the "an edge terminates on
 * a handle dot" rule being broken, just by a component that had declared itself
 * exempt.
 *
 * `selfLoopHandleArc` keeps the loop a SHAPE — it just bulges clear of the node on
 * the side a quarter turn from the source handle's own normal, so it lassos down the
 * right in a top-to-bottom layout and arcs over the top in a left-to-right one,
 * without this component knowing which direction is in force. Before the node is
 * measured there is nothing to clear, so it falls back to the node-box arc
 * (`selfLoopPath`) rather than to `NaN`.
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
 *
 * The arc is drawn through `FlowEdgePath`, so it inherits the shared keyboard
 * focus indicator (#286) rather than having to opt into it.
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
  const measuredHeight = node?.measured?.height;
  const loopRadius = data?.loopRadius ?? DEFAULT_LOOP_RADIUS;

  const { path, labelX, labelY } = useMemo(() => {
    if (node && measuredWidth && measuredHeight) {
      return selfLoopHandleArc(
        {
          sourceX,
          sourceY,
          targetX,
          targetY,
          centerX: node.internals.positionAbsolute.x + measuredWidth / 2,
          centerY: node.internals.positionAbsolute.y + measuredHeight / 2,
          width: measuredWidth,
          height: measuredHeight,
        },
        loopRadius,
      );
    }
    // Before measurement lands there is no box to clear, and the two handle points
    // still bracket the node — draw the plain arc above them.
    return selfLoopPath(
      { centerX: (sourceX + targetX) / 2, topY: Math.min(sourceY, targetY) },
      loopRadius,
    );
  }, [node, measuredWidth, measuredHeight, sourceX, sourceY, targetX, targetY, loopRadius]);

  const scaledWidth = widthByEdgeId.get(id) ?? DEFAULT_EDGE_WIDTH_RANGE[0];
  const stroke = selected ? "var(--ring)" : "var(--flow-edge)";
  const strokeWidth = selected ? scaledWidth + 1.5 : scaledWidth;

  const accessibleName =
    data?.loopLabel ?? `Self-loop on ${nodeName(node?.data, source)} — this step repeats`;

  return (
    <>
      <g role="img" aria-label={accessibleName}>
        <FlowEdgePath
          id={id}
          path={path}
          markerEnd={markerEnd}
          data-slot="flow-self-loop-edge"
          stroke={stroke}
          strokeWidth={strokeWidth}
          style={{ fill: "none", ...style }}
        />
      </g>
      <EdgeLabelPill
        label={data?.label}
        secondaryLabel={data?.secondaryLabel}
        x={labelX}
        y={labelY}
        selected={selected}
        {...data?.labelProps}
      />
    </>
  );
}
