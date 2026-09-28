import type { Node } from "@elabs-ai/components-flow";
/** Manual diagrams and folded groups may hide a qualified endpoint; frame its visible owner. */
export function visibleStoryTarget(id: string, nodes: readonly Node[]): Node | undefined {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let candidate = byId.get(id);
  while (!candidate && id.includes(".")) {
    id = id.slice(0, id.lastIndexOf("."));
    candidate = byId.get(id);
  }
  while (candidate?.hidden && candidate.parentId) candidate = byId.get(candidate.parentId);
  return candidate?.hidden ? undefined : candidate;
}
/** A group target means its contained content, including arbitrarily nested child groups. */
export function litStoryNodes(ids: readonly string[], nodes: readonly Node[]): ReadonlySet<string> {
  const roots = new Set(
    ids.flatMap((id) => {
      const node = visibleStoryTarget(id, nodes);
      return node ? [node.id] : [];
    }),
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lit = new Set(roots);
  for (const node of nodes) {
    let parent = node.parentId;
    while (parent) {
      if (roots.has(parent)) {
        lit.add(node.id);
        break;
      }
      parent = byId.get(parent)?.parentId;
    }
  }
  return lit;
}
