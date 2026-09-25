import { forwardRef } from "react";
import { Handle, type HandleProps } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FLOW_HANDLE_ANCHOR_CLASS } from "../flow-handle/flow-handle-anchor";

/** Which way a port faces: `"in"` for a target handle, `"out"` for a source handle. */
export type FlowPortDirection = "in" | "out";

/**
 * The handle id for a named port: `in:<port>` on a target, `out:<port>` on a source.
 *
 * One convention for every node type, so an edge can name its end by port
 * (`sourceHandle: "out:score"`) without knowing how the node draws it, and a node can
 * offer an input and an output with the same port name without the two ids colliding.
 */
export function flowPortId(type: HandleProps["type"], port: string): string {
  const direction: FlowPortDirection = type === "target" ? "in" : "out";
  return `${direction}:${port}`;
}

export interface FlowPortProps extends Omit<HandleProps, "id"> {
  /**
   * The port's name. The handle id becomes `in:<port>` (target) or `out:<port>`
   * (source) — see `flowPortId`.
   */
  port?: string;
  /**
   * An explicit handle id, used verbatim instead of the `port` convention. For a node
   * whose edges already address handles by another id (`FlowNode`'s side names).
   */
  id?: string;
}

/**
 * A connector dot — React Flow's `Handle` with the house look and the two rules a
 * handle must follow:
 *
 * - **The standard dot**: `size-2`, a 2px `--flow-edge` ring on the `--flow-node` fill.
 *   Pass `className` to retint it (a group's handles use the group tokens).
 * - **It is a measurement anchor**, so `FLOW_HANDLE_ANCHOR_CLASS` is applied LAST,
 *   after `className`: a dot must never be mid-transition when React Flow measures it.
 *   See `flow-handle/flow-handle-anchor.ts`.
 *
 * Name the port with `port` to get the `in:<port>`/`out:<port>` id convention. Render
 * it inside a `FlowNodeCard` so the dot sits on the card's border.
 */
export const FlowPort = forwardRef<HTMLDivElement, FlowPortProps>(function FlowPort(
  { port, id, type, className, ...props },
  ref,
) {
  return (
    <Handle
      ref={ref}
      id={id ?? (port === undefined ? undefined : flowPortId(type, port))}
      type={type}
      data-slot="flow-port"
      className={cn(
        "!size-2 !border-2 !border-flow-edge !bg-flow-node",
        className,
        FLOW_HANDLE_ANCHOR_CLASS,
      )}
      {...props}
    />
  );
});
