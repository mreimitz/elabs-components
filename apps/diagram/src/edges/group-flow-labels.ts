import type { Edge } from "@elabs-ai/components-flow";
import { FLOW_EDGE_TYPE_KEY } from "./data-flow-edge-data";

/** A shared caption; the member edges retain their own paths, IDs and selection. */
export interface FlowLabelGroup {
  ownerId: string;
  memberIds: string[];
  endpoint: "source" | "target";
  endpointId: string;
  handle: string | null;
}

interface Candidate extends Omit<FlowLabelGroup, "ownerId"> {
  key: string;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** CSS property insertion order does not change the rendered style. */
function styleKey(style: Edge["style"]) {
  return Object.entries(style ?? {}).sort(([a], [b]) => compare(a, b));
}

function captionKey(edge: Edge) {
  const data = edge.data ?? {};
  const kind = data.kind ?? "data";
  return [
    data.label,
    kind,
    data.style ?? (kind === "control" ? "dotted" : "solid"),
    data.secure ?? "none",
    data.direction ?? "forward",
    data.protocol || "",
    data.schedule || "",
    data.step ?? null,
    Boolean(data.animated ?? edge.animated),
    data.classes ?? [],
    edge.className ?? "",
    styleKey(edge.style),
  ];
}

/**
 * Share equal captions at a common source or target port. Greedy disjoint groups avoid
 * joining a chain or diamond into a caption that implies unrelated flows are the same.
 * The largest remaining group wins; ties prefer a target, then stable endpoint/edge IDs.
 * Neither the input edges nor their data are changed, and singletons have no map entry.
 */
export function groupFlowLabels(edges: readonly Edge[]): Map<string, FlowLabelGroup> {
  const candidates = new Map<string, Candidate>();
  for (const edge of edges) {
    const label = edge.data?.label;
    if (
      edge.hidden ||
      edge.type !== FLOW_EDGE_TYPE_KEY ||
      typeof label !== "string" ||
      !label.trim()
    ) {
      continue;
    }
    const caption = captionKey(edge);
    for (const endpoint of ["target", "source"] as const) {
      const endpointId = edge[endpoint];
      const handle = edge[endpoint === "source" ? "sourceHandle" : "targetHandle"] ?? null;
      const inner = edge.data?.[endpoint === "source" ? "innerSource" : "innerTarget"] ?? null;
      const key = JSON.stringify([endpoint, endpointId, handle, inner, caption]);
      const existing = candidates.get(key);
      if (existing) existing.memberIds.push(edge.id);
      else candidates.set(key, { key, endpoint, endpointId, handle, memberIds: [edge.id] });
    }
  }

  const result = new Map<string, FlowLabelGroup>();
  let remaining = [...candidates.values()];
  while (remaining.length) {
    remaining = remaining
      .map((candidate) => ({
        ...candidate,
        memberIds: candidate.memberIds.filter((id) => !result.has(id)).sort(compare),
      }))
      .filter((candidate) => candidate.memberIds.length > 1)
      .sort(
        (a, b) =>
          b.memberIds.length - a.memberIds.length ||
          (a.endpoint === b.endpoint ? 0 : a.endpoint === "target" ? -1 : 1) ||
          compare(a.key, b.key),
      );
    const next = remaining.shift();
    if (!next) break;
    const group: FlowLabelGroup = {
      ownerId: next.memberIds[0]!,
      memberIds: next.memberIds,
      endpoint: next.endpoint,
      endpointId: next.endpointId,
      handle: next.handle,
    };
    for (const id of group.memberIds) result.set(id, group);
  }
  return result;
}
