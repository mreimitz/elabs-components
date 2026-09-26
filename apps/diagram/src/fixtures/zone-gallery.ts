import type { Edge, FlowNodeData, Node } from "@elabs-ai/components-flow";
import { ZONE_NODE_TYPE, type ZoneData } from "../nodes/zone-data";

/**
 * DG-06 — the `#zones` gallery: four top-level zones, one per owner, each nesting other
 * kinds (up to three zone levels below the top), a few leaves, one zone collapsed and
 * provider marks on three zones. Positions are all `{0,0}`: the view measures the leaves,
 * then lays everything out with nested `layoutFlowElk`.
 *
 * Leaves are the built-in `FlowNode` (`type: "brand"`) — DG-05's `arch/service` is not on
 * this branch; the orchestrator swaps them after DG-05 merges. Parents precede children
 * (React Flow requires it). No `extent: "parent"`: the auto-fit grows a zone when a child
 * is dropped past its edge, which a clamped drag could never do.
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

function leaf(id: string, parentId: string, title: string, subtitle?: string): Node<FlowNodeData> {
  return {
    id,
    type: "brand",
    position: origin,
    parentId,
    data: { title, ...(subtitle ? { subtitle } : {}) },
  };
}

export const zoneGalleryNodes: Node[] = [
  // Customer managed ⊃ on-prem ⊃ subnet ⊃ leaves (three zone levels), and ⊃ a collapsed
  // cloud account with a provider mark.
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

  // Partner ⊃ datacenter ⊃ trust boundary ⊃ leaf.
  zone("partner-soc", { title: "Partner SOC", kind: "datacenter", owner: "partner" }),
  zone("pci", { title: "PCI scope", kind: "trust-boundary", owner: "partner" }, "partner-soc"),
  leaf("siem", "pci", "SIEM"),
  leaf("vault", "pci", "Key vault"),
];

export const zoneGalleryEdges: Edge[] = [
  { id: "waf-proxy", source: "waf", target: "proxy", type: "brand" },
  { id: "proxy-erp", source: "proxy", target: "erp", type: "brand" },
  { id: "erp-gateway", source: "erp", target: "gateway", type: "brand" },
  { id: "gateway-talend", source: "gateway", target: "talend", type: "brand" },
  { id: "talend-analytics", source: "talend", target: "analytics", type: "brand" },
  { id: "ingest-workers", source: "ingest", target: "workers", type: "brand" },
  { id: "workers-siem", source: "workers", target: "siem", type: "brand" },
  { id: "siem-vault", source: "siem", target: "vault", type: "brand" },
];

/** Zones the fixture wants folded: collapsed after layout through `collapseGroup`. */
export const zoneGalleryCollapsed = zoneGalleryNodes
  .filter((node) => node.type === ZONE_NODE_TYPE && (node.data as ZoneData).collapsed)
  .map((node) => node.id);
