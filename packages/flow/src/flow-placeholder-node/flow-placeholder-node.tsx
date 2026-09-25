"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FlowPort } from "../flow-port";
import { useFlowMessage } from "../lib/flow-messages";
import { warnFlowOnce } from "../lib/warn-once";

export interface FlowPlaceholderNodeData extends Record<string, unknown> {
  /**
   * Text inside the placeholder, and its accessible name — the same field every other
   * node kind calls `title`. @default "Add node" (`flow.placeholderNode.title`)
   */
  title?: string;
  /**
   * @deprecated Use `title`. Removed in 6.0.0. Still rendered (with a one-time
   * warning) when `title` is unset.
   */
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
 * Renders a real `<button>` (keyboard-activatable via native Enter/Space) named by
 * `data.title`, and a single **target** `FlowPort` (top) so an existing edge can
 * point at it. Fires `data.onActivate?.()` on activation — the typical handler
 * converts the placeholder into a real `FlowNode` and grows a fresh placeholder
 * beneath it (see the "Placeholder tail" story).
 */
export function FlowPlaceholderNode({ data }: NodeProps<BrandFlowPlaceholderNode>) {
  const msg = useFlowMessage();
  if (data.label !== undefined) {
    warnFlowOnce(
      "placeholder:label",
      "`FlowPlaceholderNodeData.label` is deprecated and is removed in 6.0.0. Use `title`, " +
        "the field every node kind shares.",
    );
  }
  const title = data.title ?? data.label ?? msg("flow.placeholderNode.title");
  return (
    <div
      data-slot="flow-placeholder-node"
      // React Flow makes the node wrapper a tab stop of its own; without this proxied
      // indicator that stop would show nothing (the button inside has its own ring).
      className="relative rounded-lg [[data-id]:focus-visible_&]:focus-ring-static"
    >
      <FlowPort type="target" position={Position.Top} />
      <button
        type="button"
        aria-label={title}
        onClick={() => data.onActivate?.()}
        className={cn(
          "flex min-w-44 items-center justify-center gap-1.5 rounded-lg border border-dashed border-flow-group-border bg-flow-group px-3 py-2 text-muted-foreground",
          "transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground",
          "focus-ring",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
        <span className="text-body">{title}</span>
      </button>
    </div>
  );
}
