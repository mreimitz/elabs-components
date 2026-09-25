"use client";

import { useCallback } from "react";
import {
  NodeResizer,
  Position,
  useStore,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FLOW_HANDLE_ANCHOR_CLASS } from "../flow-handle/flow-handle-anchor";
import { FlowNodeCard } from "../flow-node-card";
import { FlowPort } from "../flow-port";
import { FlowToneIndicator, resolveFlowTone, type FlowToneInput } from "../flow-tone";
import type { FlowNodeBaseData } from "../flow-types";
import { useFlowMessage } from "../lib/flow-messages";
import { useFlowGroups } from "../use-flow-groups";

/**
 * Tone of a group container.
 *
 * @deprecated Use `FlowToneInput` (or `FlowTone`, the `StatusTone` values). Removed in 6.0.0.
 */
export type FlowGroupTone = FlowToneInput;

/**
 * `FlowGroupNode`'s data: the shared `FlowNodeBaseData` fields (`title`, `icon`, `tone`,
 * `emphasis`) plus the group's collapse state and child count.
 */
export interface FlowGroupNodeData extends FlowNodeBaseData {
  /**
   * Whether the group is collapsed to an overview chip. Managed by
   * `useFlowGroups().collapseGroup` / `expandGroup`; the header toggle flips it.
   */
  collapsed?: boolean;
  /**
   * Fallback count shown next to the title. When omitted, the node counts its
   * live direct children from the store, so the badge stays accurate as nodes
   * are added or removed.
   */
  childCount?: number;
}

export type BrandFlowGroupNode = Node<FlowGroupNodeData, "group">;

/** The group's handle dot: the standard `FlowPort`, retinted to the group tokens. */
const groupPortClassName = "!border-flow-group-border !bg-flow-group";

// The resizer's corner handles are not ports, but they take the same dot look. The
// anchor class goes last: nothing on a node may be mid-transition when React Flow
// measures it. See `flow-handle/flow-handle-anchor.ts`.
const resizerHandleClassName = `!size-2 !border-2 !border-flow-group-border !bg-flow-group ${FLOW_HANDLE_ANCHOR_CLASS}`;

/**
 * How many direct children the group `id` has in the store, as a primitive.
 *
 * React Flow keeps `parentLookup: Map<parentId, Map<childId, InternalNode>>` up to date
 * on every `setNodes` (hidden children included, so a collapsed group keeps its count).
 * Selecting a NUMBER means the group re-renders only when its own count changes — not on
 * every drag, measure or select anywhere on the canvas, which is what `useNodes()` did.
 */
function useDirectChildCount(id: string): number {
  const selector = useCallback(
    (state: ReactFlowState) => state.parentLookup.get(id)?.size ?? 0,
    [id],
  );
  return useStore(selector);
}

/**
 * Branded group container node. Register it as `nodeTypes={{ group: FlowGroupNode }}`
 * and create nodes with `type: "group"` + typed `data: FlowGroupNodeData`. Children
 * are re-parented onto it (`parentId`, `extent: "parent"`) — see `useFlowGroups`.
 *
 * The header carries the title, a live child-count badge and a collapse/expand
 * toggle (a real `<button>` with `aria-expanded`) that drives
 * `useFlowGroups().collapseGroup` / `expandGroup`. When selected (and expanded)
 * a `<NodeResizer>` lets the group be resized.
 *
 * The frame is a `FlowNodeCard`, so the group gets the same selection ring and the
 * same proxied keyboard focus indicator as `FlowNode`. The surface keeps the FL-01
 * tokens `--flow-group` (fill) + `--flow-group-border` (border) — under a theme whose
 * `--flow-group` is near-transparent, the drawn border does the work — so the tone
 * colours the header's icon (the fill rung) and count badge (the text rung) rather than
 * the border, and `FlowToneIndicator` repeats it as a glyph and a name.
 */
export function FlowGroupNode({ id, data, selected }: NodeProps<BrandFlowGroupNode>) {
  const msg = useFlowMessage();
  const { toggleCollapse } = useFlowGroups();
  const collapsed = data.collapsed ?? false;
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);

  // Live count of direct children; fall back to the stored count before the
  // store settles (or in a non-interactive preview).
  const liveChildCount = useDirectChildCount(id);
  const childCount = liveChildCount || data.childCount || 0;

  return (
    <FlowNodeCard
      data-slot="flow-group-node"
      tone={tone}
      emphasis={emphasis}
      selected={selected}
      // After the card's own classes, so the group's surface and border tokens win over
      // the card's and over the tone's border.
      className={cn(
        "flex h-full w-full flex-col bg-flow-group/60 text-foreground",
        "border-flow-group-border motion-reduce:transition-none",
        collapsed ? "shadow-sm" : "shadow-none",
      )}
    >
      {!collapsed && selected ? (
        <NodeResizer
          minWidth={160}
          minHeight={96}
          lineClassName="!border-flow-group-border"
          handleClassName={resizerHandleClassName}
        />
      ) : null}

      {/* Handles so proxy edges can attach to the group when collapsed. */}
      <FlowPort type="target" position={Position.Top} className={groupPortClassName} />
      <FlowPort type="source" position={Position.Bottom} className={groupPortClassName} />

      {/* header-band-exempt: a node's header on the canvas, not shell chrome; it sizes to its content and zooms with the canvas. */}
      <div
        data-slot="flow-group-node-header"
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          !collapsed && "border-b border-flow-group-border",
        )}
      >
        <button
          type="button"
          onClick={() => toggleCollapse(id)}
          aria-label={
            collapsed
              ? msg("flow.groupNode.expand", { title: data.title })
              : msg("flow.groupNode.collapse", { title: data.title })
          }
          aria-expanded={!collapsed}
          className={cn(
            "-ms-1 grid size-5 shrink-0 place-items-center rounded",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-ring",
          )}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </button>

        {data.icon ? (
          // A MARK: the tone paints it on the fill rung (`text-<tone>`, ≥3:1).
          <span data-flow-tone-part="mark" className="text-muted-foreground [&_svg]:size-4">
            {data.icon}
          </span>
        ) : null}

        <span className="min-w-0 flex-1 truncate text-body font-medium">{data.title}</span>

        <FlowToneIndicator tone={tone} emphasis={emphasis} />

        {/* Running text: the tone paints it on the ink rung (`text-<tone>-text`, ≥4.5:1).
            The digits are hidden from assistive technology; the `sr-only` phrase says
            what they count. */}
        <span
          data-slot="flow-group-node-count"
          data-flow-tone-part="ink"
          className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-meta font-medium tabular-nums text-muted-foreground"
        >
          <span aria-hidden="true">{childCount}</span>
          <span className="sr-only">{msg("flow.groupNode.childCount", { count: childCount })}</span>
        </span>
      </div>
    </FlowNodeCard>
  );
}
