import { MiniMap, type MiniMapProps, type Node } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export type FlowMiniMapProps<NodeType extends Node = Node> = MiniMapProps<NodeType>;

/**
 * Branded preset over React Flow's `<MiniMap>` — sources node/mask colors from
 * the `--flow-minimap-*` tokens so the overview stays theme-aware (the raw
 * `MiniMap` re-export defaults to library colors and renders theme-blind,
 * especially under a low-chroma theme). Every prop can still be overridden; render
 * inside a `<CanvasShell>` (it needs the React Flow context via `useStore`).
 */
export function FlowMiniMap<NodeType extends Node = Node>({
  className,
  nodeColor = "var(--flow-minimap-node)",
  nodeStrokeColor = "var(--flow-minimap-node)",
  maskColor = "var(--flow-minimap-mask)",
  ...props
}: FlowMiniMapProps<NodeType>) {
  return (
    <MiniMap
      className={cn("!rounded-lg !bg-surface-elevated !shadow-ring-sm", className)}
      nodeColor={nodeColor}
      nodeStrokeColor={nodeStrokeColor}
      maskColor={maskColor}
      {...props}
    />
  );
}
