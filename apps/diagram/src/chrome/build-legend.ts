import type { Edge, Node } from "@elabs-ai/components-flow";
import {
  FLOW_EDGE_TYPE_KEY,
  type DataFlowEdgeData,
  type FlowKind,
  type FlowSecure,
} from "../edges/data-flow-edge-data";
import { isZoneNode, type ZoneOwner } from "../nodes/zone-data";

/** One legend section — matches `legend:` in the YAML dialect (plan §4). */
export type LegendSection = "owners" | "providers" | "edges";

/** `legend: auto | none | [owners, providers, edges]` (plan §4). */
export type LegendMode = "auto" | "none" | LegendSection[];

/** What a diagram's legend has to explain, derived from what is actually on the canvas. */
export interface LegendSpec {
  owners: ZoneOwner[];
  providers: string[];
  edgeKinds: FlowKind[];
  secure: Exclude<FlowSecure, "none">[];
  hasSteps: boolean;
}

const ALL_SECTIONS: LegendSection[] = ["owners", "providers", "edges"];

function sectionsOf(mode: Exclude<LegendMode, "none">): LegendSection[] {
  return mode === "auto" ? ALL_SECTIONS : mode;
}

/**
 * DG-08 — builds the legend's content from the nodes/edges actually on the canvas, never
 * from a fixed vocabulary: an owner, provider, edge kind, secure value or step only
 * appears once something on the canvas uses it, in first-seen (render) order. `mode`
 * picks which sections run at all — `"none"` short-circuits to `null` before either array
 * is walked, and an array mode leaves out every section it doesn't name (an empty array,
 * not a missing key, in the returned spec).
 *
 * Pure and React-free so it can run in a dev-only assertion (no store, no hooks) and,
 * later, in the DG-10 compiler.
 */
export function buildLegend(
  nodes: readonly Node[],
  edges: readonly Edge[],
  mode: LegendMode,
): LegendSpec | null {
  if (mode === "none") return null;
  const sections = sectionsOf(mode);
  const wantOwners = sections.includes("owners");
  const wantProviders = sections.includes("providers");
  const wantEdges = sections.includes("edges");

  const owners: ZoneOwner[] = [];
  const providers: string[] = [];
  if (wantOwners || wantProviders) {
    for (const node of nodes) {
      if (!isZoneNode(node)) continue;
      if (wantOwners && !owners.includes(node.data.owner)) owners.push(node.data.owner);
      if (wantProviders && node.data.provider && !providers.includes(node.data.provider)) {
        providers.push(node.data.provider);
      }
    }
  }

  const edgeKinds: FlowKind[] = [];
  const secure: Exclude<FlowSecure, "none">[] = [];
  let hasSteps = false;
  if (wantEdges) {
    for (const edge of edges) {
      if (edge.type !== FLOW_EDGE_TYPE_KEY) continue;
      const data = (edge.data ?? {}) as DataFlowEdgeData;
      const kind = data.kind ?? "data";
      if (!edgeKinds.includes(kind)) edgeKinds.push(kind);
      if (data.secure && data.secure !== "none" && !secure.includes(data.secure)) {
        secure.push(data.secure);
      }
      if (data.step !== undefined) hasSteps = true;
    }
  }

  return { owners, providers, edgeKinds, secure, hasSteps };
}
