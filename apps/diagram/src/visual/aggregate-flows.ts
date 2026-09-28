import type { ArchDiagram } from "../spec/dialect/types";
import type { VisualBox, VisualFlow } from "./visual-model";

/** Aggregate like-kind traffic only; parallel data/control directions remain independent. */
export function aggregateVisualFlows(ast: ArchDiagram, boxes: readonly VisualBox[]): VisualFlow[] {
  const members = new Map(boxes.flatMap((box) => box.members.map((m) => [m.id, box.id] as const)));
  const zones = new Map(ast.zones.map((zone) => [zone.id, zone]));
  const endpoint = (id: string): string | undefined => {
    if (members.has(id)) return members.get(id);
    // A qualified end still reaches its collapsed outer instance when no finer box claims it.
    const parts = id.split(".");
    while (parts.length > 1) {
      parts.pop();
      const match = members.get(parts.join("."));
      if (match) return match;
    }
    const inner = new Map<string, number>();
    for (const [member, box] of members)
      if (member.startsWith(`${id}.`)) inner.set(box, (inner.get(box) ?? 0) + 1);
    if (inner.size) return [...inner].sort((a, b) => b[1] - a[1])[0]?.[0];
    const counts = new Map<string, number>();
    for (const node of ast.nodes) {
      const seen = new Set<string>();
      let parent = node.parent;
      while (parent && !seen.has(parent)) {
        if (parent === id) {
          const box = members.get(node.id);
          if (box) counts.set(box, (counts.get(box) ?? 0) + 1);
          break;
        }
        seen.add(parent);
        parent = zones.get(parent)?.parent;
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const pairs = new Map<string, VisualFlow>();
  for (const flow of ast.flows) {
    const from = endpoint(flow.direction === "back" ? flow.to : flow.from);
    const to = endpoint(flow.direction === "back" ? flow.from : flow.to);
    if (!from || !to || from === to) continue;
    const kind = flow.kind === "data" ? "data" : "other";
    const key = `${from}\0${to}\0${kind}`;
    const reverse = pairs.get(`${to}\0${from}\0${kind}`);
    const same = pairs.get(key);
    if (reverse) reverse.bidirectional = true;
    else if (same) same.bidirectional ||= flow.direction === "both";
    else
      pairs.set(key, {
        id: `flow:${pairs.size}`,
        from,
        to,
        kind,
        bidirectional: flow.direction === "both",
      });
  }
  return [...pairs.values()];
}
