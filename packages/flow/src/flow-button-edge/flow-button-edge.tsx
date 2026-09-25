"use client";

import { getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { FlowEdgeLabel, FlowEdgePath } from "../flow-edge-path";
import type { FLOW_EDGE_TYPE } from "../flow-types";
import { useFlowMessage } from "../lib/flow-messages";

export interface FlowButtonEdgeData extends Record<string, unknown> {
  /**
   * aria-label for the insert button. Defaults to the `flow.buttonEdge.insert` message
   * ("Insert node on edge"), which a `LocaleProvider` can translate.
   */
  label?: string;
  /** Called when the edge's "+" button is activated (click, Enter, or Space). */
  onInsert?: () => void;
}

export type BrandFlowButtonEdge = Edge<FlowButtonEdgeData, typeof FLOW_EDGE_TYPE.button>;

/**
 * Branded bezier edge (matching `FlowEdge`'s `--flow-edge` token) with a
 * centered "+" button anchored at the edge midpoint by `FlowEdgeLabel`.
 * Register it in `edgeTypes={{ button: FlowButtonEdge }}` and create edges
 * with `type: "button"` and `data: FlowButtonEdgeData`.
 *
 * The button is a real `<button>` with an `aria-label`, keyboard-activatable
 * via native Enter/Space. Fires `data.onInsert?.()` on activation — the
 * typical handler splits the edge: insert a new node between source and
 * target and rewire the two edges (see the "Insert between" story).
 *
 * Selection is drawn by `FlowEdgePath` (`--ring`, wider), like every built-in edge.
 */
export function FlowButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps<BrandFlowButtonEdge>) {
  const msg = useFlowMessage();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const label = data?.label ?? msg("flow.buttonEdge.insert");

  return (
    <>
      <FlowEdgePath
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        data-slot="flow-button-edge"
        selected={selected}
        style={style}
      />
      <FlowEdgeLabel x={labelX} y={labelY}>
        <button
          type="button"
          aria-label={label}
          onClick={() => data?.onInsert?.()}
          className="pointer-events-auto flex size-5 items-center justify-center rounded-full border border-flow-group-border bg-flow-node text-flow-node-foreground shadow-sm transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground focus-ring"
        >
          <Plus className="size-3" aria-hidden="true" />
        </button>
      </FlowEdgeLabel>
    </>
  );
}
