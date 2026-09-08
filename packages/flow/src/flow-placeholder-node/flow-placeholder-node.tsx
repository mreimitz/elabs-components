import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { FLOW_HANDLE_ANCHOR_CLASS } from "../flow-handle/flow-handle-anchor";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface FlowPlaceholderNodeData extends Record<string, unknown> {
  /** Label rendered inside the placeholder. @default "Add node" */
  label?: string;
  /** Called when the placeholder is activated (click, Enter, or Space). */
  onActivate?: () => void;
}

export type BrandFlowPlaceholderNode = Node<FlowPlaceholderNodeData, "placeholder">;

/**
 * Dashed, muted "add here" node — a clickable affordance that grows the
 * graph. Register it in `nodeTypes={{ placeholder: FlowPlaceholderNode }}`
 * and create nodes with `type: "placeholder"` and `data: FlowPlaceholderNodeData`.
 *
 * Renders a real `<button>` (keyboard-activatable via native Enter/Space) with
 * an `aria-label`, and a single **target** `<Handle>` (top) so an existing
 * edge can point at it. Fires `data.onActivate?.()` on activation — the
 * typical handler converts the placeholder into a real `FlowNode` and grows a
 * fresh placeholder beneath it (see the "Placeholder tail" story).
 */
export function FlowPlaceholderNode({ data }: NodeProps<BrandFlowPlaceholderNode>) {
  const label = data.label ?? "Add node";
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        // `FLOW_HANDLE_ANCHOR_CLASS`: a connector dot must never be in flight when
        // React Flow measures it. See `flow-handle/flow-handle-anchor.ts`.
        className={`!size-2 !border-2 !border-flow-edge !bg-flow-node ${FLOW_HANDLE_ANCHOR_CLASS}`}
      />
      <button
        type="button"
        aria-label={label}
        onClick={() => data.onActivate?.()}
        className={cn(
          "flex min-w-44 items-center justify-center gap-1.5 rounded-lg border border-dashed border-flow-group-border bg-flow-group px-3 py-2 text-muted-foreground",
          "transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground",
          "focus-ring",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
        <span className="text-body">{label}</span>
      </button>
    </div>
  );
}
