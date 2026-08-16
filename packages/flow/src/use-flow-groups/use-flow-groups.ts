import { useCallback } from "react";
import { useReactFlow, type Edge, type Node } from "@xyflow/react";
import {
  collapseGroup as collapseGroupOp,
  expandGroup as expandGroupOp,
  groupNodes as groupNodesOp,
  toggleGroupCollapsed as toggleGroupCollapsedOp,
  ungroup as ungroupOp,
  type GroupNodesOptions,
} from "./group-operations";

/** Options for `groupNodes`/`groupSelection` with an optional generated id. */
export type GroupOptions = Partial<Pick<GroupNodesOptions, "groupId">> &
  Omit<GroupNodesOptions, "groupId">;

export interface UseFlowGroupsResult {
  /**
   * Wrap the given (top-level) node ids in a new `FlowGroupNode`. Returns the new
   * group id, or `undefined` if nothing was grouped. Pass `options.groupId` for a
   * deterministic id; otherwise one is generated.
   */
  groupNodes: (nodeIds: string[], options?: GroupOptions) => string | undefined;
  /** Group the currently-selected nodes. Returns the new group id (or `undefined`). */
  groupSelection: (options?: GroupOptions) => string | undefined;
  /** Dissolve a group, restoring its children to absolute positions. */
  ungroup: (groupId: string) => void;
  /** Collapse a group to an overview chip (hides subtree, reroutes boundary edges). */
  collapseGroup: (groupId: string) => void;
  /** Expand a collapsed group (exact inverse of collapse). */
  expandGroup: (groupId: string) => void;
  /** Collapse if expanded, expand if collapsed. */
  toggleCollapse: (groupId: string) => void;
}

function generateGroupId(): string {
  return `flow-group-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Thin hook over the pure grouping operations in `group-operations.ts`. Reads and
 * writes the live graph via `useReactFlow()`; all the logic lives in the pure,
 * unit-tested core. Must be called inside a React Flow context (e.g. from a
 * `<Panel>` child of `<CanvasShell>` or from within a custom node).
 */
export function useFlowGroups<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): UseFlowGroupsResult {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow<NodeType, EdgeType>();

  const apply = useCallback(
    (result: { nodes: NodeType[]; edges: EdgeType[] }) => {
      setNodes(result.nodes);
      setEdges(result.edges);
    },
    [setNodes, setEdges],
  );

  const groupNodes = useCallback(
    (nodeIds: string[], options?: GroupOptions): string | undefined => {
      if (nodeIds.length === 0) return undefined;
      const groupId = options?.groupId ?? generateGroupId();
      const result = groupNodesOp<NodeType, EdgeType>(getNodes(), getEdges(), nodeIds, {
        ...options,
        groupId,
      });
      apply(result);
      return groupId;
    },
    [getNodes, getEdges, apply],
  );

  const groupSelection = useCallback(
    (options?: GroupOptions): string | undefined => {
      const selectedIds = getNodes()
        .filter((n) => n.selected && !n.parentId)
        .map((n) => n.id);
      return groupNodes(selectedIds, options);
    },
    [getNodes, groupNodes],
  );

  const ungroup = useCallback(
    (groupId: string) => apply(ungroupOp<NodeType, EdgeType>(getNodes(), getEdges(), groupId)),
    [getNodes, getEdges, apply],
  );

  const collapseGroup = useCallback(
    (groupId: string) =>
      apply(collapseGroupOp<NodeType, EdgeType>(getNodes(), getEdges(), groupId)),
    [getNodes, getEdges, apply],
  );

  const expandGroup = useCallback(
    (groupId: string) => apply(expandGroupOp<NodeType, EdgeType>(getNodes(), getEdges(), groupId)),
    [getNodes, getEdges, apply],
  );

  const toggleCollapse = useCallback(
    (groupId: string) =>
      apply(toggleGroupCollapsedOp<NodeType, EdgeType>(getNodes(), getEdges(), groupId)),
    [getNodes, getEdges, apply],
  );

  return {
    groupNodes,
    groupSelection,
    ungroup,
    collapseGroup,
    expandGroup,
    toggleCollapse,
  };
}
