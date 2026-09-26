import type { Node } from "@elabs-ai/components-flow";
import {
  FLOW_EDGE_TYPE_KEY,
  type DataFlowEdge,
  type DataFlowEdgeData,
} from "../edges/data-flow-edge-data";
import { edgeAriaLabel, edgeMarkers } from "../edges/edge-style";
import { ARCH_NODE_TYPE, type ArchNode, type ArchNodeData } from "../nodes/arch-node-data";
import { ZONE_NODE_TYPE, type ZoneData, type ZoneNode } from "../nodes/zone-data";

/**
 * DG-08 — the `#legend` demo: four zones (one per `ZoneOwner`), three providers (`azure`,
 * `qlik`, `aws`) and every `DataFlowEdge` kind/secure value/step the legend has to explain,
 * hand-placed like `fixtures/edge-gallery.ts` (no ELK). Proves `DiagramLegend` and
 * `TitleBlock` together; wiring them onto the compiled spec's real canvas is DG-12's job
 * (see `#legend`'s finding in the item file — the main canvas still renders DG-03's
 * lakehouse and has neither zones nor `arch/flow` edges).
 */

/** Every edge here connects two leaves' (or a zone's) main left/right ports. */
const MAIN_PORTS = { sourceHandle: "out:out", targetHandle: "in:in" } as const;

/**
 * m9: `api` and `warehouse` sit directly above/below one another (same x). Routed through
 * the main left/right ports, the smoothstep path had to leave right, drop, and re-enter
 * left — an orthogonal detour that reads as a box (a hosted boundary), not an edge. Their
 * own top/bottom ports (`ArchPorts`, `service`/`datastore` only) make it a short straight
 * run instead.
 */
const VERTICAL_PORTS = { sourceHandle: "out:bottom", targetHandle: "in:top" } as const;

function zone(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  data: ZoneData,
): ZoneNode {
  return { id, type: ZONE_NODE_TYPE, position: { x, y }, width, height, data };
}

function leaf(
  id: string,
  kind: "service" | "datastore",
  parentId: string,
  x: number,
  y: number,
  data: ArchNodeData,
): ArchNode {
  return { id, type: ARCH_NODE_TYPE[kind], parentId, position: { x, y }, data };
}

function actor(id: string, x: number, y: number, data: ArchNodeData): ArchNode {
  return { id, type: ARCH_NODE_TYPE.actor, position: { x, y }, data };
}

function flow(
  id: string,
  source: { id: string; title: string },
  target: { id: string; title: string },
  data: DataFlowEdgeData,
  ports: { sourceHandle: string; targetHandle: string } = MAIN_PORTS,
): DataFlowEdge {
  return {
    id,
    source: source.id,
    target: target.id,
    type: FLOW_EDGE_TYPE_KEY,
    data,
    ariaLabel: edgeAriaLabel(source.title, target.title, data),
    ...ports,
    ...edgeMarkers(data.kind, data.direction),
  };
}

// Zones — one per `ZoneOwner`, three of the four naming a provider (D3, D4).
const customerZone = zone("customer", 280, 0, 240, 190, {
  title: "Customer subscription",
  kind: "cloud-account",
  owner: "customer",
  provider: "azure",
});
const saasZone = zone("saas", 620, 0, 240, 190, {
  title: "Qlik Cloud",
  kind: "cloud-account",
  owner: "saas",
  provider: "qlik",
});
const hostedZone = zone("hosted", 960, 0, 240, 300, {
  title: "Managed AWS account",
  kind: "cloud-account",
  owner: "hosted",
  provider: "aws",
});
const partnerZone = zone("partner", 1300, 0, 240, 190, {
  title: "Partner SOC",
  kind: "trust-boundary",
  owner: "partner",
});

const analystNode = actor("analyst", 0, 96, { title: "Data analyst" });
const vmLeaf = leaf("vm", "service", "customer", 24, 60, {
  title: "App VM",
  icon: "azure/virtual-machine",
});
const qcaLeaf = leaf("qca", "service", "saas", 24, 60, {
  title: "Qlik Cloud Analytics",
  icon: "qlik/cloud",
});
const apiLeaf = leaf("api", "service", "hosted", 24, 60, {
  title: "Order API",
  icon: "aws/lambda",
});
const warehouseLeaf = leaf("warehouse", "datastore", "hosted", 24, 190, {
  title: "Data lake",
  icon: "aws/simple-storage-service",
});
const siemLeaf = leaf("siem", "service", "partner", 24, 60, { title: "SIEM" });

/** Parents precede children (verified-apis.md → flow). */
export const legendDemoNodes: Node[] = [
  analystNode,
  customerZone,
  vmLeaf,
  saasZone,
  qcaLeaf,
  hostedZone,
  apiLeaf,
  warehouseLeaf,
  partnerZone,
  siemLeaf,
];

const analyst = { id: "analyst", title: "Data analyst" };
const vm = { id: "vm", title: "App VM" };
const customer = { id: "customer", title: "Customer subscription" };
const qca = { id: "qca", title: "Qlik Cloud Analytics" };
const api = { id: "api", title: "Order API" };
const warehouse = { id: "warehouse", title: "Data lake" };
const siem = { id: "siem", title: "SIEM" };

/** All five `FlowKind`s, three `secure` values and steps 1–3, across five flows. */
export const legendDemoEdges: DataFlowEdge[] = [
  flow("vm-qca", vm, qca, {
    kind: "data",
    secure: "tls",
    protocol: "HTTPS 443",
    label: "Ingest",
    step: 1,
  }),
  flow("qca-api", qca, api, { kind: "request", label: "Query", step: 2 }),
  flow("analyst-customer", analyst, customer, {
    kind: "access",
    secure: "sso",
    label: "Sign-in",
    floating: true,
  }),
  flow(
    "api-warehouse",
    api,
    warehouse,
    { kind: "control", direction: "both", label: "Sync catalog", step: 3 },
    VERTICAL_PORTS,
  ),
  flow("warehouse-siem", warehouse, siem, {
    kind: "network",
    secure: "private-link",
    label: "Export logs",
  }),
];
