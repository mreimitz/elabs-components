import type { Node } from "@elabs-ai/components-flow";
import {
  FLOW_EDGE_TYPE_KEY,
  type DataFlowEdge,
  type DataFlowEdgeData,
} from "../edges/data-flow-edge-data";
import { edgeAriaLabel, edgeMarkers } from "../edges/edge-style";
import { ARCH_NODE_TYPE, type ArchNode } from "../nodes/arch-node-data";
import { archNodeAriaLabel } from "../nodes/service-node";
import { ZONE_NODE_TYPE, type ZoneData } from "../nodes/zone-data";

/**
 * DG-06 — the `#zones` gallery: four top-level zones, one per owner, each nesting other
 * kinds (up to three zone levels below the top), a few leaves, one zone collapsed and
 * provider marks on three zones. Two trust boundaries — one customer-owned, one
 * partner-owned — show that a trust boundary keeps its owner's line style (wave-1 review
 * M8). Positions are all `{0,0}`: the view measures the leaves, then lays everything out
 * with nested `layoutFlowElk`.
 *
 * Leaves are DG-05's `arch/service` nodes and edges DG-07's `arch/flow` edges, named by
 * their end nodes' titles (`edgeAriaLabel`), not by raw ids (wave-1 review m5). Parents
 * precede children (React Flow requires it). No `extent: "parent"`: the auto-fit grows a
 * zone when a child is dropped past its edge, which a clamped drag could never do.
 */

const origin = { x: 0, y: 0 };

function zone(id: string, data: ZoneData, parentId?: string): Node<ZoneData> {
  return {
    id,
    type: ZONE_NODE_TYPE,
    position: origin,
    data,
    ...(parentId ? { parentId } : {}),
  };
}

function leaf(id: string, parentId: string, title: string, subtitle?: string): ArchNode {
  return {
    id,
    type: ARCH_NODE_TYPE.service,
    position: origin,
    parentId,
    ariaLabel: archNodeAriaLabel("service", title),
    data: { title, ...(subtitle ? { subtitle } : {}) },
  };
}

export const zoneGalleryNodes: Node[] = [
  // Customer managed ⊃ on-prem ⊃ subnet ⊃ leaves (three zone levels), ⊃ a customer-owned
  // trust boundary, and ⊃ a collapsed cloud account with a provider mark.
  zone("customer", { title: "Customer estate", kind: "generic", owner: "customer" }),
  zone(
    "vienna-dc",
    { title: "Vienna data center", subtitle: "Tier III", kind: "on-prem", owner: "customer" },
    "customer",
  ),
  zone(
    "dmz",
    { title: "DMZ", subtitle: "10.20.0.0/24", kind: "subnet", owner: "customer" },
    "vienna-dc",
  ),
  leaf("waf", "dmz", "Web application firewall"),
  leaf("proxy", "dmz", "Reverse proxy", "nginx"),
  leaf("erp", "vienna-dc", "SAP S/4HANA", "ERP"),
  zone(
    "cardholder",
    { title: "Cardholder data", kind: "trust-boundary", owner: "customer" },
    "vienna-dc",
  ),
  leaf("payments", "cardholder", "Payment service"),
  zone(
    "azure-sub",
    {
      title: "Azure subscription",
      kind: "cloud-account",
      owner: "customer",
      provider: "azure",
      collapsed: true,
    },
    "customer",
  ),
  leaf("gateway", "azure-sub", "Data Gateway", "VM, outbound only"),

  // SaaS ⊃ region ⊃ leaves.
  zone("qlik-cloud", {
    title: "Qlik Cloud",
    subtitle: "Tenant",
    kind: "cloud-account",
    owner: "saas",
    provider: "qlik",
  }),
  zone("eu-region", { title: "EU (Frankfurt)", kind: "region", owner: "saas" }, "qlik-cloud"),
  leaf("analytics", "eu-region", "Qlik Cloud Analytics"),
  leaf("talend", "eu-region", "Talend Data Integration"),

  // Hosted ⊃ vnet ⊃ cluster ⊃ leaves (three zone levels).
  zone("hosted-aws", {
    title: "Managed AWS account",
    kind: "cloud-account",
    owner: "hosted",
    provider: "aws",
  }),
  zone(
    "prod-vpc",
    { title: "Production VPC", subtitle: "10.0.0.0/16", kind: "vnet", owner: "hosted" },
    "hosted-aws",
  ),
  zone("eks", { title: "EKS cluster", kind: "cluster", owner: "hosted" }, "prod-vpc"),
  leaf("ingest", "eks", "Ingest API"),
  leaf("workers", "eks", "Workers"),

  // Partner ⊃ datacenter ⊃ partner-owned trust boundary ⊃ leaf.
  zone("partner-soc", { title: "Partner SOC", kind: "datacenter", owner: "partner" }),
  zone("pci", { title: "PCI scope", kind: "trust-boundary", owner: "partner" }, "partner-soc"),
  leaf("siem", "pci", "SIEM"),
  leaf("vault", "pci", "Key vault"),
];

/** Every flow runs between two leaves' main ports (`out:out` → `in:in`, `ArchPorts`). */
const MAIN_PORTS = { sourceHandle: "out:out", targetHandle: "in:in" } as const;

function titleOf(id: string): string {
  const node = zoneGalleryNodes.find((candidate) => candidate.id === id);
  return (node?.data as { title?: string } | undefined)?.title ?? id;
}

function flow(source: string, target: string, data: DataFlowEdgeData): DataFlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: FLOW_EDGE_TYPE_KEY,
    data,
    ariaLabel: edgeAriaLabel(titleOf(source), titleOf(target), data),
    ...MAIN_PORTS,
    ...edgeMarkers(data.kind, data.direction),
  };
}

export const zoneGalleryEdges: DataFlowEdge[] = [
  flow("waf", "proxy", { kind: "request" }),
  flow("proxy", "erp", { kind: "request" }),
  flow("erp", "payments", { kind: "request" }),
  flow("erp", "gateway", { kind: "data" }),
  flow("gateway", "talend", { kind: "data" }),
  flow("talend", "analytics", { kind: "data" }),
  flow("ingest", "workers", { kind: "request" }),
  flow("workers", "siem", { kind: "data" }),
  flow("siem", "vault", { kind: "access" }),
];

/** Zones the fixture wants folded: collapsed after layout through `collapseGroup`. */
export const zoneGalleryCollapsed = zoneGalleryNodes
  .filter((node) => node.type === ZONE_NODE_TYPE && (node.data as ZoneData).collapsed)
  .map((node) => node.id);
