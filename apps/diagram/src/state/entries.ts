/**
 * DG-14 — canvas id → the dialect entry it came from, and the text paths a delete removes.
 * Reads DG-10's `origin` (FlowSpec path → dialect path) and DG-09's AST. React-free.
 */
import type { ArchFlowSpec, ArchNodeSpec, ArchZoneSpec } from "../spec/dialect";
import type { CompiledDiagram } from "./compile-text";

export type DiagramEntry =
  | { kind: "zone"; id: string; path: string; zone: ArchZoneSpec }
  | { kind: "node"; id: string; path: string; node: ArchNodeSpec }
  | { kind: "note"; id: string; path: string }
  | { kind: "flow"; id: string; path: string; flow: ArchFlowSpec };

/** The entry a canvas node or edge id was compiled from; `null` for a collapse proxy edge. */
export function entryOf(compiled: CompiledDiagram, id: string): DiagramEntry | null {
  const { ast, spec, origin } = compiled;
  if (!ast || !spec) return null;
  const nodeIndex = spec.nodes.findIndex((node) => node.id === id);
  if (nodeIndex !== -1) {
    const path = origin[`nodes[${nodeIndex}]`];
    if (path === undefined) return null;
    const zone = ast.zones.find((z) => z.path === path);
    if (zone) return { kind: "zone", id, path, zone };
    const node = ast.nodes.find((n) => n.path === path);
    if (node) return { kind: "node", id, path, node };
    return path.startsWith("notes[") ? { kind: "note", id, path } : null;
  }
  const edgeIndex = spec.edges.findIndex((edge) => edge.id === id);
  const path = edgeIndex === -1 ? undefined : origin[`edges[${edgeIndex}]`];
  const flow = path === undefined ? undefined : ast.flows.find((f) => f.path === path);
  return flow ? { kind: "flow", id, path: flow.path, flow } : null;
}

/**
 * Every text path a canvas delete removes: the deleted zones, nodes and notes with
 * everything inside a deleted zone (nested or `parent:`), each flow that touches one of them,
 * each note anchored to one of them, and the deleted flows.
 */
export function pathsToDelete(
  compiled: CompiledDiagram,
  nodeIds: readonly string[],
  edgeIds: readonly string[],
): string[] {
  const { ast } = compiled;
  if (!ast) return [];
  const gone = new Set<string>();
  const paths = new Set<string>();
  for (const id of nodeIds) {
    const entry = entryOf(compiled, id);
    if (!entry) continue;
    if (entry.kind === "zone" || entry.kind === "node") gone.add(entry.id);
    paths.add(entry.path);
  }
  // Inside a deleted zone, at any depth.
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of [...ast.zones, ...ast.nodes]) {
      if (item.parent !== undefined && gone.has(item.parent) && !gone.has(item.id)) {
        gone.add(item.id);
        paths.add(item.path);
        grew = true;
      }
    }
  }
  for (const flow of ast.flows) {
    if (gone.has(flow.from) || gone.has(flow.to)) paths.add(flow.path);
  }
  for (const note of ast.notes) if (gone.has(note.at)) paths.add(note.path);
  for (const id of edgeIds) {
    const entry = entryOf(compiled, id);
    if (entry?.kind === "flow") paths.add(entry.path);
  }
  return [...paths];
}
