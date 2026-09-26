/**
 * DG-12 — the pure half of edit → canvas: what counts as a structural change, how a data-only
 * change is patched into the laid-out graph, and how a text offset maps to a diagram
 * element. React-free; `diagram-store.ts` and the panes call it.
 */
import type { Edge, Node } from "@elabs-ai/components-flow";
import { parseArchYaml, type SourceRange } from "../spec/dialect";
import { locate } from "../spec/dialect/source-map";
import type { ReactFlowGraph } from "../spec/flow-spec";
import type { CompiledDiagram } from "./compile-text";

/**
 * Everything that moves a box: ids, types, parents, edge ends and handles, direction,
 * engine, per-zone direction, a node's `variant` (icon and card differ in size), the text's
 * collapsed zones, note anchors, and — in manual layout — positions. Equal keys → patch
 * `data` in place; different keys → lay out again. `""` when there is no graph.
 */
export function structureKey(compiled: CompiledDiagram): string {
  const { spec, view, graph } = compiled;
  if (!spec || !view || !graph) return "";
  const manual = spec.layout.engine === "none";
  return JSON.stringify([
    spec.layout,
    graph.nodes.map((n) => [
      n.id,
      n.type,
      n.parentId ?? null,
      n.data.variant ?? null,
      n.data.direction ?? null,
      manual ? n.position : null,
    ]),
    graph.edges.map((e) => [e.id, e.source, e.target, e.sourceHandle, e.targetHandle]),
    view.collapsed,
    view.noteAnchors,
  ]);
}

/**
 * Keys flow's `collapseGroup` writes into a zone's `data` (group-operations.ts L279–284:
 * `collapsed`, `childCount`, `__flowGroupCollapsedState`). The compiler never writes them.
 */
function withoutRuntime(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "collapsed" || key === "childCount" || key.startsWith("__flowGroup")) continue;
    out[key] = value;
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * An edge's `data` without the layout-owned `route` (wave-2 review M2): the compiler never
 * writes it, so it is not part of "did the words change".
 */
function withoutRoute(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data || !("route" in data)) return data ?? {};
  const { route: _layout, ...rest } = data;
  return rest;
}

/**
 * Same structure, new words: copy the compiled `data` (plus the `ariaLabel` and an edge's
 * markers, which DG-10's `decorate` derives from it) onto the laid-out nodes and edges by
 * id. Positions, sizes, handles, selection and collapse state stay, and so does an edge's
 * layout-owned `data.route` (merged, not replaced — a label whose words changed keeps the
 * route and label box of the last layout; its new box may be a little wider or narrower
 * until the next structural change lays it out again). Unchanged items keep their object
 * identity, so React Flow re-renders only what changed.
 *
 * Returns the input arrays when nothing changed. Returns `null` when a patch cannot be
 * exact: the change is inside a zone collapsed on the canvas, or on the collapsed zone
 * itself. `collapseGroup` snapshots those objects and `expandGroup` would restore the old
 * words (group-operations.ts L45–57). The caller then lays out again instead.
 */
export function patchGraph(
  nodes: Node[],
  edges: Edge[],
  next: ReactFlowGraph,
): { nodes: Node[]; edges: Edge[] } | null {
  const nextNodes = new Map(next.nodes.map((n) => [n.id, n]));
  const nextEdges = new Map(next.edges.map((e) => [e.id, e]));
  let exact = true;
  let changed = false;
  const patchedNodes = nodes.map((node) => {
    const want = nextNodes.get(node.id);
    if (!want) return node;
    if (same(withoutRuntime(node.data), want.data) && node.ariaLabel === want.ariaLabel) {
      return node;
    }
    if (node.hidden || node.data.collapsed) exact = false;
    changed = true;
    return { ...node, data: want.data, ariaLabel: want.ariaLabel };
  });
  const patchedEdges = edges.map((edge) => {
    const want = nextEdges.get(edge.id);
    if (!want) return edge; // a collapse proxy edge: not in the compiled graph
    if (
      same(withoutRoute(edge.data), want.data ?? {}) &&
      edge.ariaLabel === want.ariaLabel &&
      same(edge.markerStart, want.markerStart) &&
      same(edge.markerEnd, want.markerEnd)
    ) {
      return edge;
    }
    if (edge.hidden) exact = false;
    changed = true;
    const route = edge.data?.route;
    return {
      ...edge,
      data: route === undefined ? want.data : { ...want.data, route },
      ariaLabel: want.ariaLabel,
      markerStart: want.markerStart,
      markerEnd: want.markerEnd,
    };
  });
  if (!exact) return null;
  // Nothing changed: hand back the same arrays, so `setNodes` is a no-op.
  return changed ? { nodes: patchedNodes, edges: patchedEdges } : { nodes, edges };
}

/**
 * A node between a structural change and the layout that places it: mounted (React Flow
 * must measure it) but not seen. A style, not a class: React Flow writes `visibility`
 * inline on every node wrapper and spreads `node.style` after it (@xyflow/react
 * dist/esm/index.mjs L2342), so a `className` like `invisible` loses once the node is
 * measured. `useDiagramLayout`'s `apply` calls `unstage`.
 */
export function stage(node: Node): Node {
  return { ...node, style: { ...node.style, visibility: "hidden" } };
}

export function unstage(node: Node): Node {
  if (node.style?.visibility !== "hidden") return node;
  const { visibility: _staged, ...style } = node.style;
  return { ...node, style };
}

/**
 * Before a re-layout: nodes already on the canvas keep their laid-out position (nothing
 * jumps to `{0,0}`); new nodes are staged invisible; edges that touch a new node are
 * `hidden` until the layout places it (drawn now, they would run to the origin). Hidden,
 * not left out: DG-08's legend counts every edge in the store, so it already has its final
 * size when the fit measures it (`chromeFitPadding`). Data comes from the new compile.
 */
export function stageGraph(current: readonly Node[], next: ReactFlowGraph): ReactFlowGraph {
  const placed = new Map(current.map((n) => [n.id, n]));
  const fresh = new Set<string>();
  const nodes = next.nodes.map((node) => {
    const old = placed.get(node.id);
    if (old && old.parentId === node.parentId) {
      // A zone keeps its laid-out box too, unless it was a collapsed chip (220×48).
      const box =
        old.width !== undefined && old.height !== undefined && !old.data.collapsed
          ? { width: old.width, height: old.height }
          : {};
      return { ...node, position: old.position, ...box };
    }
    fresh.add(node.id);
    return stage(node);
  });
  const edges = next.edges.map((edge) =>
    fresh.has(edge.source) || fresh.has(edge.target) ? { ...edge, hidden: true } : edge,
  );
  return { nodes, edges };
}

/** A diagram element's place in the text it was compiled from. */
export interface ElementRange {
  id: string;
  range: SourceRange;
}

/**
 * Node and edge id → the text range of the dialect entry it came from (DG-10 `origin` +
 * DG-09 `locate`). Parses `text` once more: DG-09's `checkArchYaml` does not return its
 * source map. Call it lazily (on a cursor move or a selection), never per keystroke.
 */
export function elementRanges(text: string, compiled: CompiledDiagram): ElementRange[] {
  const { spec, origin } = compiled;
  if (!spec) return [];
  const { sourceMap } = parseArchYaml(text);
  const out: ElementRange[] = [];
  spec.nodes.forEach((node, index) => {
    const path = origin[`nodes[${index}]`];
    if (path !== undefined) out.push({ id: node.id, range: locate(sourceMap, path, "value") });
  });
  spec.edges.forEach((edge, index) => {
    const path = origin[`edges[${index}]`];
    if (path !== undefined) out.push({ id: edge.id, range: locate(sourceMap, path, "value") });
  });
  return out;
}

/** The innermost element whose range holds `offset` (a zone's range holds its children). */
export function elementAt(ranges: readonly ElementRange[], offset: number): string | null {
  let best: ElementRange | undefined;
  for (const entry of ranges) {
    const [start, end] = entry.range.offset;
    if (offset < start || offset > end) continue;
    if (!best || end - start < best.range.offset[1] - best.range.offset[0]) best = entry;
  }
  return best?.id ?? null;
}

/**
 * `next` with each item's `selected` flag taken from `live`, the canvas's current state. A
 * restaged graph is built from a fresh compile and a layout lands on the snapshot it started
 * from; neither may drop the selection the canvas and the editor share.
 */
export function keepSelection<T extends Node | Edge>(next: readonly T[], live: readonly T[]): T[] {
  const selected = new Set(live.filter((item) => item.selected).map((item) => item.id));
  return next.map((item) =>
    Boolean(item.selected) === selected.has(item.id)
      ? item
      : { ...item, selected: selected.has(item.id) },
  );
}
