import { type ReactNode } from "react";
import { Handle, NodeResizer, Position, useNodes, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { useFlowGroups } from "../use-flow-groups";

/** Visual accent for a group container. */
export type FlowGroupTone = "default" | "accent" | "success" | "warning" | "destructive";

export interface FlowGroupNodeData extends Record<string, unknown> {
  /** Header label for the group. */
  title: string;
  /** Optional leading glyph (a Lucide icon element, etc.). */
  icon?: ReactNode;
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
  /** Accent tone for the header rule + count badge. */
  tone?: FlowGroupTone;
}

export type BrandFlowGroupNode = Node<FlowGroupNodeData, "group">;

const toneAccent: Record<FlowGroupTone, string> = {
  default: "text-muted-foreground",
  // #399 — the group LABEL is text on the canvas, so it takes the on-surface
  // `-text` rung. (The status rows below stay on their fill rungs; those are a
  // separate, still-open question, not part of #399's enumerated call sites.)
  accent: "text-primary-text",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

const handleClassName = "!size-2 !border-2 !border-flow-group-border !bg-flow-group";

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
 * The surface uses the FL-01 tokens `--flow-group` (fill) + `--flow-group-border`
 * (border). Under the blueprint theme `--flow-group` is near-transparent, so the
 * drawn border does the work.
 */
export function FlowGroupNode({ id, data, selected }: NodeProps<BrandFlowGroupNode>) {
  const { toggleCollapse } = useFlowGroups();
  const nodes = useNodes();
  const collapsed = data.collapsed ?? false;
  const tone = data.tone ?? "default";

  // Live count of direct children; fall back to the stored count before the
  // store settles (or in a non-interactive preview).
  const liveChildCount = nodes.filter((n) => n.parentId === id).length;
  const childCount = liveChildCount || data.childCount || 0;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col rounded-lg border bg-flow-group/60 text-foreground",
        "border-flow-group-border transition-[box-shadow,border-color] duration-fast ease-standard motion-reduce:transition-none",
        collapsed ? "shadow-sm" : "shadow-none",
        selected && "ring-2 ring-ring",
      )}
    >
      {!collapsed && selected ? (
        <NodeResizer
          minWidth={160}
          minHeight={96}
          lineClassName="!border-flow-group-border"
          handleClassName={handleClassName}
        />
      ) : null}

      {/* Handles so proxy edges can attach to the group when collapsed. */}
      <Handle type="target" position={Position.Top} className={handleClassName} />
      <Handle type="source" position={Position.Bottom} className={handleClassName} />

      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          !collapsed && "border-b border-flow-group-border",
        )}
      >
        <button
          type="button"
          onClick={() => toggleCollapse(id)}
          aria-label={collapsed ? `Expand group ${data.title}` : `Collapse group ${data.title}`}
          aria-expanded={!collapsed}
          className={cn(
            "-ml-1 grid size-5 shrink-0 place-items-center rounded",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </button>

        {data.icon ? (
          <span className={cn("[&_svg]:size-4", toneAccent[tone])}>{data.icon}</span>
        ) : null}

        <span className="min-w-0 flex-1 truncate text-body font-medium">{data.title}</span>

        <span
          className={cn(
            "shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-meta font-medium tabular-nums",
            toneAccent[tone],
          )}
          aria-label={`${childCount} ${childCount === 1 ? "node" : "nodes"}`}
        >
          {childCount}
        </span>
      </div>
    </div>
  );
}
