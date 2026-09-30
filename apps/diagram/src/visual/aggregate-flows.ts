import type { ArchDiagram } from "../spec/dialect/types";
import type { VisualBox, VisualFlow, VisualRelationship } from "./visual-model";

/** Boundary connections must never silently become a connection to a selected child. */
export function addVisualBoundaries(ast: ArchDiagram, boxes: VisualBox[]): void {
  const members = new Set(boxes.flatMap((box) => box.members.map((member) => member.id)));
  const zones = new Map(ast.zones.map((zone) => [zone.id, zone]));
  for (const id of new Set(ast.flows.flatMap((flow) => [flow.from, flow.to]))) {
    if (members.has(id) || boxes.some((box) => box.boundaryOf === id)) continue;
    const zone = zones.get(id);
    const expanded = boxes.some((box) =>
      box.members.some((member) => member.id.startsWith(`${id}.`)),
    );
    if (!zone && !expanded) continue;
    const descendant = (nodeId: string): boolean => {
      if (nodeId.startsWith(`${id}.`)) return true;
      let parent = ast.nodes.find((node) => node.id === nodeId)?.parent;
      const seen = new Set<string>();
      while (parent && !seen.has(parent)) {
        if (parent === id) return true;
        seen.add(parent);
        parent = zones.get(parent)?.parent;
      }
      return false;
    };
    const representative = boxes.find((box) => box.members.some((member) => descendant(member.id)));
    boxes.push({
      id: `box:boundary:${id}`,
      boundaryOf: id,
      title: zone?.title ?? ast.nodes.find((node) => node.id === id)?.title ?? id,
      lane: representative?.lane ?? zone?.role ?? "targets",
      owner: zone?.owner ?? representative?.owner ?? "unowned",
      members: [],
      summary: true,
    });
  }
}

/** Stable content identity survives unrelated insertions and source reordering. */
function signature(flow: Omit<VisualRelationship, "id">): string {
  return JSON.stringify([
    flow.from,
    flow.to,
    flow.direction,
    flow.kind,
    flow.label ?? "",
    flow.protocol ?? "",
    flow.schedule ?? "",
    flow.secure ?? "",
    flow.style ?? "",
    flow.step ?? null,
    flow.animated,
    flow.class ?? [],
    flow.layoutRole ?? "primary",
  ]);
}

/** Source records include internal and deliberately hidden relationships for drill-down. */
export function visualRelationships(ast: ArchDiagram): VisualRelationship[] {
  const occurrences = new Map<string, number>();
  return ast.flows.map(({ path: _path, form: _form, ...source }) => {
    const identity = signature(source);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { ...source, id: `source:${identity}:${occurrence}` };
  });
}

/** Preserve directed source relationships even when opposite traffic shares one connector. */
export function aggregateVisualFlows(ast: ArchDiagram, boxes: readonly VisualBox[]): VisualFlow[] {
  const members = new Map(
    boxes.flatMap((box) => [
      ...box.members.map((m) => [m.id, box.id] as const),
      ...(box.boundaryOf ? [[box.boundaryOf, box.id] as const] : []),
    ]),
  );
  const endpoint = (id: string): string | undefined => {
    if (members.has(id)) return members.get(id);
    const parts = id.split(".");
    while (parts.length > 1) {
      parts.pop();
      const match = members.get(parts.join("."));
      if (match) return match;
    }
    return undefined;
  };
  const pairs = new Map<string, VisualFlow>();
  for (const relationship of visualRelationships(ast)) {
    const flow = relationship;
    const from = endpoint(flow.direction === "back" ? flow.to : flow.from);
    const to = endpoint(flow.direction === "back" ? flow.from : flow.to);
    if (!from || !to || from === to) continue;
    const kind = flow.kind === "data" ? "data" : "other";
    // Do not collapse semantically different relationships into an unlabeled arrow.
    const semantics = JSON.stringify([
      flow.kind,
      flow.label ?? "",
      flow.protocol ?? "",
      flow.schedule ?? "",
      flow.secure ?? "",
    ]);
    const key = JSON.stringify([from, to, semantics]);
    const reverse = pairs.get(JSON.stringify([to, from, semantics]));
    const same = pairs.get(key);
    const existing = reverse ?? same;
    if (existing) {
      existing.bidirectional ||= Boolean(reverse) || flow.direction === "both";
      existing.sourceFlowIds = [...(existing.sourceFlowIds ?? []), relationship.id];
      existing.relationships = [...(existing.relationships ?? []), relationship];
    } else {
      pairs.set(key, {
        id: `flow:${JSON.stringify([[from, to].sort(), semantics])}`,
        from,
        to,
        kind,
        bidirectional: flow.direction === "both",
        ...(flow.label && { label: flow.label }),
        sourceFlowIds: [relationship.id],
        relationships: [relationship],
      });
    }
  }
  return [...pairs.values()];
}
