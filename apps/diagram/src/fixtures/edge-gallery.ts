import { Position, type Node } from "@elabs-ai/components-flow";
import {
  FLOW_EDGE_TYPE_KEY,
  type DataFlowEdge,
  type DataFlowEdgeData,
  type FlowKind,
  type FlowLineStyle,
} from "../edges/data-flow-edge-data";
import { edgeAriaLabel, edgeMarkers } from "../edges/edge-style";

/**
 * DG-07 `#edges` gallery: every `DataFlowEdge` axis on one canvas, laid out in code (no
 * ELK). Each case is a pair of leaves with one flow between them; the last band pairs a
 * leaf with a zone and a zone with a zone to show floating zone endpoints.
 *
 * Leaves are the built-in `FlowNode` (`type: "brand"`) and zones the built-in
 * `FlowGroupNode` (`type: "group"`) — stand-ins until DG-04's `arch/service` and DG-06's
 * `arch/zone` exist; the edges module's own `isZoneNode` (`edges/zone-endpoint.ts`) already
 * accepts both zone types — `nodes/zone-data.ts`'s `isZoneNode` accepts only `arch/zone`.
 */

/** Horizontal pitch of one case column, and the leaf-to-leaf offset inside a case. */
const COLUMN = 640;
const PAIR_OFFSET = 400;
const ROW = 120;

interface GalleryCase {
  key: string;
  title: string;
  data: DataFlowEdgeData;
}

const KINDS: FlowKind[] = ["data", "request", "access", "control", "network"];
const STYLES: FlowLineStyle[] = ["solid", "dashed", "dotted"];

const MATRIX: GalleryCase[] = KINDS.flatMap((kind) =>
  STYLES.map((style) => ({
    key: `${kind}-${style}`,
    title: `${kind} · ${style}`,
    data: { kind, style },
  })),
);

const AXES: GalleryCase[] = [
  {
    key: "animated-solid",
    title: "animated · solid",
    data: { kind: "data", animated: true, label: "Live stream" },
  },
  {
    key: "animated-dashed",
    title: "animated · dashed",
    data: { kind: "request", style: "dashed", animated: true, label: "Polling" },
  },
  {
    key: "control-default",
    title: "control · default",
    data: { kind: "control", label: "Orchestrates" },
  },
  { key: "secure-tls", title: "secure · tls", data: { secure: "tls", protocol: "HTTPS 443" } },
  { key: "secure-vpn", title: "secure · vpn", data: { secure: "vpn", label: "Site-to-site" } },
  {
    key: "secure-private-link",
    title: "secure · private-link",
    data: { kind: "network", secure: "private-link", label: "PrivateLink" },
  },
  {
    key: "secure-sso",
    title: "secure · sso",
    data: { kind: "access", secure: "sso", label: "SSO via Entra ID" },
  },
  { key: "step-1", title: "step 1", data: { step: 1, label: "Extract" } },
  { key: "step-2", title: "step 2", data: { step: 2, label: "Load" } },
  { key: "step-3", title: "step 3", data: { step: 3, label: "Transform", kind: "control" } },
  {
    key: "protocol-schedule",
    title: "protocol + schedule",
    data: { label: "Load & transform", protocol: "JDBC", schedule: "nightly batch" },
  },
  {
    key: "direction-both",
    title: "direction · both",
    data: { kind: "control", direction: "both", label: "Catalog sync" },
  },
  {
    key: "direction-back",
    title: "direction · back",
    data: { kind: "data", direction: "back", label: "Reverse ETL", schedule: "hourly" },
  },
];

const CASES = [...MATRIX, ...AXES];

function leaf(id: string, title: string, x: number, y: number, parentId?: string): Node {
  return {
    id,
    type: "brand",
    position: { x, y },
    data: { title },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ...(parentId ? { parentId, extent: "parent" as const } : null),
  };
}

function zone(id: string, title: string, x: number, y: number): Node {
  return { id, type: "group", position: { x, y }, width: 360, height: 200, data: { title } };
}

function flow(
  id: string,
  source: { id: string; title: string },
  target: { id: string; title: string },
  data: DataFlowEdgeData,
): DataFlowEdge {
  return {
    id,
    source: source.id,
    target: target.id,
    type: FLOW_EDGE_TYPE_KEY,
    data,
    ariaLabel: edgeAriaLabel(source.title, target.title, data),
    ...edgeMarkers(data.kind, data.direction),
  };
}

const COLUMNS = 3;
const caseNodes: Node[] = [];
const caseEdges: DataFlowEdge[] = [];
CASES.forEach((c, i) => {
  const x = (i % COLUMNS) * COLUMN;
  const y = Math.floor(i / COLUMNS) * ROW;
  const from = { id: `${c.key}-from`, title: c.title };
  const to = { id: `${c.key}-to`, title: "Service" };
  caseNodes.push(leaf(from.id, from.title, x, y), leaf(to.id, to.title, x + PAIR_OFFSET, y));
  caseEdges.push(flow(c.key, from, to, c.data));
});

/** The zone band sits below the last case row. */
const ZONE_Y = Math.ceil(CASES.length / COLUMNS) * ROW + 40;

const analyst = { id: "analyst", title: "Analyst" };
const zoneA = { id: "zone-a", title: "Customer VPC" };
const zoneB = { id: "zone-b", title: "Vendor SaaS" };

const zoneNodes: Node[] = [
  // Parents precede children (verified-apis.md → flow).
  zone(zoneA.id, zoneA.title, COLUMN, ZONE_Y),
  zone(zoneB.id, zoneB.title, 2 * COLUMN, ZONE_Y),
  leaf(analyst.id, analyst.title, 0, ZONE_Y + 76),
  leaf("zone-a-db", "Warehouse", 24, 76, zoneA.id),
  leaf("zone-b-app", "Analytics app", 24, 76, zoneB.id),
];

const zoneEdges: DataFlowEdge[] = [
  flow("node-to-zone", analyst, zoneA, {
    kind: "access",
    secure: "sso",
    label: "Sign-in",
    floating: true,
  }),
  flow("zone-to-zone", zoneA, zoneB, {
    kind: "data",
    style: "dashed",
    secure: "private-link",
    protocol: "HTTPS 443",
    label: "Replication",
    schedule: "real-time",
    floating: true,
  }),
];

/** Gallery nodes — zones before their children, as `FlowGroupNode` requires. */
export const edgeGalleryNodes: Node[] = [...caseNodes, ...zoneNodes];

/** Gallery edges — one `arch/flow` per case, plus the two floating zone cases. */
export const edgeGalleryEdges: DataFlowEdge[] = [...caseEdges, ...zoneEdges];
