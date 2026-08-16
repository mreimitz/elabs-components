import { getNodesBounds, type Edge, type Node } from "@xyflow/react";
import type { FlowGroupNodeData, FlowGroupTone } from "../flow-group-node";

/**
 * Pure, framework-agnostic grouping operations over `nodes`/`edges` arrays.
 *
 * Every function is a **pure transform** — it never mutates its inputs and
 * returns a fresh `{ nodes, edges }`. This is the testable core; `useFlowGroups`
 * is a thin hook that wires these to a live canvas via `useReactFlow()`.
 */

/** Node type used for the group container (matches `nodeTypes={{ group: FlowGroupNode }}`). */
export const FLOW_GROUP_NODE_TYPE = "group";

/** Padding (px) left around the child bounds when a group is created. */
const DEFAULT_GROUP_PADDING = 28;
/** Extra top space reserved for the group header so children don't sit under it. */
const GROUP_HEADER_OFFSET = 44;
/** Fixed size of the collapsed "overview chip". */
const OVERVIEW_WIDTH = 220;
const OVERVIEW_HEIGHT = 48;

export interface GroupNodesOptions {
  /** Id for the new group node. Required so the operation stays deterministic/testable. */
  groupId: string;
  /** Header title for the group. @default "Group" */
  title?: string;
  /** Accent tone for the group header. */
  tone?: FlowGroupTone;
  /** Padding (px) around the child bounds. @default 28 */
  padding?: number;
}

export interface FlowGroupOperationResult<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> {
  nodes: NodeType[];
  edges: EdgeType[];
}

/**
 * Snapshot stashed on a collapsed group's `data` so `expandGroup` can restore the
 * exact pre-collapse graph (an exact inverse). Holds original node/edge object
 * references — never mutated — so restoration is object-exact.
 */
interface FlowGroupCollapsedState {
  /** The group node exactly as it was before collapse (no collapsed state on it). */
  groupSnapshot: Node;
  /** Every descendant node exactly as it was before collapse. */
  descendantSnapshots: Node[];
  /** The boundary-crossing edges exactly as they were before rerouting. */
  reroutedEdges: Edge[];
}

const COLLAPSED_STATE_KEY = "__flowGroupCollapsedState";

/** Marker + metadata written onto a proxy edge's `data`. */
export interface FlowGroupProxyEdgeData extends Record<string, unknown> {
  __flowGroupProxy: true;
  /** Id of the collapsed group this proxy edge stands in for. */
  groupId: string;
}

/** True if `edge` is a proxy edge synthesized for a collapsed group. */
export function isFlowGroupProxyEdge(edge: Edge): boolean {
  return Boolean((edge.data as Partial<FlowGroupProxyEdgeData> | undefined)?.__flowGroupProxy);
}

function proxyEdgeId(groupId: string, originalEdgeId: string): string {
  return `flow-group-proxy__${groupId}__${originalEdgeId}`;
}

function readCollapsedState(node: Node): FlowGroupCollapsedState | undefined {
  return (node.data as Record<string, unknown> | undefined)?.[COLLAPSED_STATE_KEY] as
    | FlowGroupCollapsedState
    | undefined;
}

/** All node ids whose parent chain reaches `groupId` (children, grandchildren, …). */
function collectDescendantIds(nodes: Node[], groupId: string): Set<string> {
  const childrenByParent = new Map<string, Node[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = childrenByParent.get(n.parentId);
      if (arr) arr.push(n);
      else childrenByParent.set(n.parentId, [n]);
    }
  }

  const out = new Set<string>();
  const stack = [...(childrenByParent.get(groupId) ?? [])];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (out.has(n.id)) continue;
    out.add(n.id);
    const kids = childrenByParent.get(n.id);
    if (kids) stack.push(...kids);
  }
  return out;
}

/**
 * Wrap `nodeIds` (assumed top-level) in a new `FlowGroupNode` parent.
 *
 * - Computes the child bounds with `getNodesBounds`.
 * - Inserts the group node **before** its children in the array (React Flow
 *   requires a parent to precede its children).
 * - Re-parents each child (`parentId`, `extent: "parent"`) and rewrites its
 *   position to be **relative to the group origin**.
 */
export function groupNodes<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  nodeIds: string[],
  options: GroupNodesOptions,
): FlowGroupOperationResult<NodeType, EdgeType> {
  const idSet = new Set(nodeIds);
  const children = nodes.filter((n) => idSet.has(n.id));
  if (children.length === 0) return { nodes, edges };

  const bounds = getNodesBounds(children);
  const padding = options.padding ?? DEFAULT_GROUP_PADDING;
  const originX = bounds.x - padding;
  const originY = bounds.y - padding - GROUP_HEADER_OFFSET;

  const data: FlowGroupNodeData = {
    title: options.title ?? "Group",
    childCount: children.length,
    ...(options.tone ? { tone: options.tone } : {}),
  };

  const groupNode = {
    id: options.groupId,
    type: FLOW_GROUP_NODE_TYPE,
    position: { x: originX, y: originY },
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2 + GROUP_HEADER_OFFSET,
    data,
  } as unknown as NodeType;

  const reparented = new Map<string, NodeType>();
  for (const child of children) {
    reparented.set(child.id, {
      ...child,
      parentId: options.groupId,
      extent: "parent",
      position: { x: child.position.x - originX, y: child.position.y - originY },
    } as NodeType);
  }

  let earliest = nodes.length;
  for (let i = 0; i < nodes.length; i++) {
    if (idSet.has(nodes[i]!.id)) {
      earliest = i;
      break;
    }
  }

  const mapped = nodes.map((n) => reparented.get(n.id) ?? n);
  const resultNodes = [...mapped.slice(0, earliest), groupNode, ...mapped.slice(earliest)];
  return { nodes: resultNodes, edges };
}

/**
 * Dissolve a group: remove the group node and restore its **direct** children to
 * absolute positions (dropping `parentId`/`extent`). If the group is currently
 * collapsed it is expanded first, so ungrouping a collapsed group is safe.
 */
export function ungroup<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  groupId: string,
): FlowGroupOperationResult<NodeType, EdgeType> {
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return { nodes, edges };

  const base = (group.data as FlowGroupNodeData | undefined)?.collapsed
    ? expandGroup(nodes, edges, groupId)
    : { nodes, edges };

  const liveGroup = base.nodes.find((n) => n.id === groupId)!;
  const gx = liveGroup.position.x;
  const gy = liveGroup.position.y;

  const resultNodes = base.nodes
    .filter((n) => n.id !== groupId)
    .map((n) => {
      if (n.parentId === groupId) {
        const {
          parentId: _parentId,
          extent: _extent,
          ...rest
        } = n as NodeType & {
          parentId?: string;
          extent?: unknown;
        };
        return {
          ...rest,
          position: { x: n.position.x + gx, y: n.position.y + gy },
        } as NodeType;
      }
      return n;
    });

  return { nodes: resultNodes, edges: base.edges };
}

/**
 * Collapse a group to an overview chip.
 *
 * - Hides every descendant (including nested groups and their subtrees).
 * - Shrinks the group to a fixed overview size and marks `data.collapsed`.
 * - Re-routes every edge that **crosses the collapse boundary** (exactly one
 *   endpoint inside the collapsed subtree) to a **proxy edge** targeting the
 *   group node; the original edge is hidden and stashed for restoration.
 * - Edges fully inside or fully outside the subtree are left untouched.
 *
 * The full pre-collapse graph is stashed on the group's `data` so `expandGroup`
 * is an exact inverse. Nested collapse is handled by snapshotting each
 * descendant's exact prior state (a subgroup that was already collapsed stays
 * collapsed on expand — no double-unhide).
 */
export function collapseGroup<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  groupId: string,
): FlowGroupOperationResult<NodeType, EdgeType> {
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return { nodes, edges };
  if ((group.data as FlowGroupNodeData | undefined)?.collapsed) return { nodes, edges };

  const descendantIds = collectDescendantIds(nodes, groupId);

  const descendantSnapshots = nodes.filter((n) => descendantIds.has(n.id));
  const directChildCount = nodes.filter((n) => n.parentId === groupId).length;

  const isInside = (id: string) => descendantIds.has(id);
  const reroutedEdges: EdgeType[] = [];
  const proxyEdges: EdgeType[] = [];
  for (const edge of edges) {
    const sourceInside = isInside(edge.source);
    const targetInside = isInside(edge.target);
    if (sourceInside === targetInside) continue; // fully inside or fully outside

    reroutedEdges.push(edge);
    const proxyData: FlowGroupProxyEdgeData = {
      ...(edge.data ?? {}),
      __flowGroupProxy: true,
      groupId,
    };
    proxyEdges.push({
      ...edge,
      id: proxyEdgeId(groupId, edge.id),
      source: sourceInside ? groupId : edge.source,
      target: targetInside ? groupId : edge.target,
      sourceHandle: undefined,
      targetHandle: undefined,
      data: proxyData,
    } as EdgeType);
  }

  const collapsedState: FlowGroupCollapsedState = {
    groupSnapshot: group,
    descendantSnapshots,
    reroutedEdges,
  };

  const resultNodes = nodes.map((n) => {
    if (n.id === groupId) {
      return {
        ...n,
        width: OVERVIEW_WIDTH,
        height: OVERVIEW_HEIGHT,
        data: {
          ...(n.data as Record<string, unknown>),
          collapsed: true,
          childCount: directChildCount,
          [COLLAPSED_STATE_KEY]: collapsedState,
        },
      } as NodeType;
    }
    if (descendantIds.has(n.id)) {
      return { ...n, hidden: true } as NodeType;
    }
    return n;
  });

  const reroutedIds = new Set(reroutedEdges.map((e) => e.id));
  const resultEdges = edges.map((e) =>
    reroutedIds.has(e.id) ? ({ ...e, hidden: true } as EdgeType) : e,
  );
  resultEdges.push(...proxyEdges);

  return { nodes: resultNodes, edges: resultEdges };
}

/**
 * Expand a collapsed group — the exact inverse of `collapseGroup`. Restores the
 * group node, un-hides the descendant subtree (to each node's exact prior
 * state), removes this group's proxy edges and restores the original edges.
 * No-op if the group isn't collapsed.
 */
export function expandGroup<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  groupId: string,
): FlowGroupOperationResult<NodeType, EdgeType> {
  const group = nodes.find((n) => n.id === groupId);
  const state = group ? readCollapsedState(group) : undefined;
  if (!group || !state) return { nodes, edges };

  const snapshotById = new Map(state.descendantSnapshots.map((n) => [n.id, n]));
  const reroutedById = new Map(state.reroutedEdges.map((e) => [e.id, e]));

  const resultNodes = nodes.map((n) => {
    if (n.id === groupId) return state.groupSnapshot as NodeType;
    const snap = snapshotById.get(n.id);
    return snap ? (snap as NodeType) : n;
  });

  const resultEdges = edges
    .filter(
      (e) =>
        !(
          isFlowGroupProxyEdge(e) &&
          (e.data as Partial<FlowGroupProxyEdgeData> | undefined)?.groupId === groupId
        ),
    )
    .map((e) => {
      const original = reroutedById.get(e.id);
      return original ? (original as EdgeType) : e;
    });

  return { nodes: resultNodes, edges: resultEdges };
}

/** Collapse if expanded, expand if collapsed. */
export function toggleGroupCollapsed<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  groupId: string,
): FlowGroupOperationResult<NodeType, EdgeType> {
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return { nodes, edges };
  return (group.data as FlowGroupNodeData | undefined)?.collapsed
    ? expandGroup(nodes, edges, groupId)
    : collapseGroup(nodes, edges, groupId);
}
