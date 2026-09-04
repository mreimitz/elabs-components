import { EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { FlowEdgePath } from "../flow-edge-path";

export interface FlowButtonEdgeData extends Record<string, unknown> {
  /** aria-label for the insert button. @default "Insert node on edge" */
  label?: string;
  /** Called when the edge's "+" button is activated (click, Enter, or Space). */
  onInsert?: () => void;
}

export type BrandFlowButtonEdge = Edge<FlowButtonEdgeData, "button">;

/**
 * Branded bezier edge (matching `FlowEdge`'s `--flow-edge` token) with a
 * centered "+" button rendered via `EdgeLabelRenderer` at the edge midpoint.
 * Register it in `edgeTypes={{ button: FlowButtonEdge }}` and create edges
 * with `type: "button"` and `data: FlowButtonEdgeData`.
 *
 * The button is a real `<button>` with an `aria-label`, keyboard-activatable
 * via native Enter/Space. Fires `data.onInsert?.()` on activation — the
 * typical handler splits the edge: insert a new node between source and
 * target and rewire the two edges (see the "Insert between" story).
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
  data,
}: EdgeProps<BrandFlowButtonEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const label = data?.label ?? "Insert node on edge";

  return (
    <>
      <FlowEdgePath
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        data-slot="flow-button-edge"
        stroke="var(--flow-edge)"
        strokeWidth={1.5}
        style={style}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="nodrag nopan pointer-events-auto"
        >
          <button
            type="button"
            aria-label={label}
            onClick={() => data?.onInsert?.()}
            className="flex size-5 items-center justify-center rounded-full border border-flow-group-border bg-flow-node text-flow-node-foreground shadow-sm transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3" aria-hidden="true" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
