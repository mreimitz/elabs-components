/** Stable default grouping, augmented only by explicit roles and catalog capabilities. */
import { aggregateVisualFlows } from "./aggregate-flows";
import type {
  ArchDiagram,
  ArchFlowSpec,
  ArchNodeSpec,
  ArchNodeType,
  ArchZoneSpec,
} from "../spec/dialect";
import {
  LANE_ORDER,
  LANE_TITLE,
  type LaneRole,
  type VisualBox,
  type VisualBoxMember,
  type VisualLane,
  type VisualLens,
} from "./visual-model";

/** Rule 2's plain kind label, for a multi-member box with no shared zone to name it by. */
const PLURAL_KIND_LABEL: Record<ArchNodeType, string> = {
  service: "Services",
  actor: "Actors",
  datastore: "Databases",
  queue: "Queues",
  external: "External systems",
  note: "Notes",
};

interface ZoneInfo {
  zone: ArchZoneSpec;
  /** `zone.owner ?? parent's resolved owner ?? "customer"` — mirrors `compile-arch.ts`. */
  owner: NonNullable<ArchZoneSpec["owner"]> | "customer";
}

function resolveZoneOwners(zones: readonly ArchZoneSpec[]): Map<string, ZoneInfo> {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const info = new Map<string, ZoneInfo>();
  // Parents before children, however the text ordered them (compile-arch.ts `zonesParentFirst`).
  const depthOf = (zone: ArchZoneSpec): number => {
    const seen = new Set([zone.id]);
    let depth = 0;
    for (let id: string | undefined = zone.parent; id !== undefined && !seen.has(id); ) {
      const parent = byId.get(id);
      if (!parent) break;
      seen.add(id);
      depth += 1;
      id = parent.parent;
    }
    return depth;
  };
  const ordered = [...zones].sort((a, b) => depthOf(a) - depthOf(b));
  for (const zone of ordered) {
    const parent = zone.parent !== undefined ? info.get(zone.parent) : undefined;
    info.set(zone.id, { zone, owner: zone.owner ?? parent?.owner ?? "customer" });
  }
  return info;
}

/** Rule 1: the zone's own role, walking from it up to the root; `undefined` = "fall through". */
function customerRoleOf(zoneId: string, zoneInfo: Map<string, ZoneInfo>): LaneRole | undefined {
  const seen = new Set<string>();
  for (let id: string | undefined = zoneId; id !== undefined && !seen.has(id); ) {
    seen.add(id);
    const entry = zoneInfo.get(id);
    if (!entry) return undefined;
    if (entry.owner === "customer") {
      if (entry.zone.kind === "on-prem" || entry.zone.kind === "datacenter")
        return "customer-managed";
      if (entry.zone.kind === "cloud-account" || entry.zone.kind === "vnet") return "customer-vpc";
    }
    id = entry.zone.parent;
  }
  return undefined;
}

/** All node ids whose (possibly indirect) parent is `zoneId`, in document order. */
function descendantNodeIds(
  zoneId: string,
  nodes: readonly ArchNodeSpec[],
  zoneInfo: Map<string, ZoneInfo>,
): string[] {
  const isDescendantZone = (id: string): boolean => {
    const seen = new Set<string>();
    for (let cur: string | undefined = id; cur !== undefined && !seen.has(cur); ) {
      seen.add(cur);
      if (cur === zoneId) return true;
      cur = zoneInfo.get(cur)?.zone.parent;
    }
    return false;
  };
  return nodes.filter((n) => n.parent !== undefined && isDescendantZone(n.parent)).map((n) => n.id);
}

/**
 * Net `kind: "data"` flow across one endpoint's boundary: positive emits more than it
 * receives. A `direction: "both"` flow crossing the boundary is symmetric by definition (it is
 * simultaneously an inflow and an outflow) and contributes nothing either way.
 */
function netDataFlow(id: string, flows: readonly ArchFlowSpec[], members: Set<string>): number {
  let net = 0;
  for (const flow of flows) {
    if (flow.kind !== "data" || flow.direction === "both") continue;
    const fromIn = flow.from === id || members.has(flow.from);
    const toIn = flow.to === id || members.has(flow.to);
    if (fromIn === toIn) continue; // both inside or both outside: not a boundary crossing
    const forward = flow.direction !== "back";
    net += fromIn === forward ? 1 : -1;
  }
  return net;
}

/**
 * Net flow of ANY kind across an endpoint's boundary — rule 1's fallback tiebreak (review
 * round, F6) for an endpoint with no `data` flow crossing its boundary at all: a
 * control/access-only actor or control plane still clearly emits or receives, and reading
 * only `kind: "data"` sent every one of them to the `targets` default, regardless of which
 * way its own arrows actually point.
 */
function netFlow(id: string, flows: readonly ArchFlowSpec[], members: Set<string>): number {
  let net = 0;
  for (const flow of flows) {
    if (flow.direction === "both") continue;
    const fromIn = flow.from === id || members.has(flow.from);
    const toIn = flow.to === id || members.has(flow.to);
    if (fromIn === toIn) continue;
    const forward = flow.direction !== "back";
    net += fromIn === forward ? 1 : -1;
  }
  return net;
}

/**
 * Rule 1, the "other saas" / no-zone branch. A `data`-flow tie falls back to the net over
 * EVERY flow kind (F6); a tie there too uses `defaultRole` — `targets` (documented,
 * unchanged) for a zone, `sources` for a bare actor with no flows to go on at all (an actor
 * with truly nothing wired up reads as a source of the diagram, not a destination).
 */
function flowRole(
  id: string,
  flows: readonly ArchFlowSpec[],
  members: Set<string>,
  defaultRole: LaneRole = "targets",
): LaneRole {
  const data = netDataFlow(id, flows, members);
  if (data !== 0) return data > 0 ? "sources" : "targets";
  const any = netFlow(id, flows, members);
  if (any !== 0) return any > 0 ? "sources" : "targets";
  const successors = new Map<string, Set<string>>();
  for (const flow of flows) {
    if (flow.direction === "both") continue;
    const source = flow.direction === "back" ? flow.to : flow.from;
    const target = flow.direction === "back" ? flow.from : flow.to;
    if (!successors.has(source)) successors.set(source, new Set());
    successors.get(source)!.add(target);
  }
  const inside = (node: string) => node === id || members.has(node);
  const reachesInside = (start: string): boolean => {
    const seen = new Set<string>();
    const pending = [start];
    while (pending.length) {
      const node = pending.pop()!;
      if (inside(node)) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      pending.push(...(successors.get(node) ?? []));
    }
    return false;
  };
  // An outgoing edge that cannot return is an upstream relation in the condensed DAG.
  // Cycles preserve the documented fallback rather than arbitrarily reversing a loop.
  for (const node of [id, ...members]) {
    for (const next of successors.get(node) ?? []) {
      if (!inside(next) && !reachesInside(next)) return "sources";
    }
  }
  return defaultRole;
}

/** Rule 6: every flow touching this node is access/network-only, and there is at least one. */
function isNetworkOrAccessOnly(nodeId: string, flows: readonly ArchFlowSpec[]): boolean {
  let touched = false;
  for (const flow of flows) {
    if (flow.from !== nodeId && flow.to !== nodeId) continue;
    touched = true;
    if (flow.kind !== "access" && flow.kind !== "network") return false;
  }
  return touched;
}

interface DerivedNode {
  node: ArchNodeSpec;
  lane: LaneRole;
  owner: NonNullable<ArchZoneSpec["owner"]> | "customer" | "unowned";
  aside: boolean;
}

function laneForNode(
  node: ArchNodeSpec,
  ast: ArchDiagram,
  zoneInfo: Map<string, ZoneInfo>,
): { lane: LaneRole; owner: NonNullable<ArchZoneSpec["owner"]> | "customer" | "unowned" } {
  if (node.parent !== undefined) {
    const zone = zoneInfo.get(node.parent);
    if (zone) {
      const customerLane = customerRoleOf(node.parent, zoneInfo);
      if (customerLane) return { lane: customerLane, owner: zone.owner };
      // No ancestor zone's kind matched rule 1, but this zone is still customer territory
      // (owner is inherited, so every zone in the chain shares it): default customer-managed.
      if (zone.owner === "customer") return { lane: "customer-managed", owner: zone.owner };
      const members = new Set(descendantNodeIds(node.parent, ast.nodes, zoneInfo));
      return { lane: flowRole(node.parent, ast.flows, members), owner: zone.owner };
    }
  }
  // A bare actor (no parent zone at all) ties to `sources`, not `targets` — a person is
  // where a diagram's flows start, when its own flows give no other signal.
  const bareDefault: LaneRole = node.type === "actor" ? "sources" : "targets";
  return {
    lane: flowRole(node.id, ast.flows, new Set([node.id]), bareDefault),
    owner: "unowned",
  };
}

/**
 * The icon's vendor namespace (`"aws/rds"` → `"aws"`); `undefined` with no icon, no `/`, or
 * the generic `lucide` glyph set — a placeholder, not a real product's brand, so it never
 * counts as a vendor match (see rule 2's docstring above).
 */
function iconVendor(icon: string | undefined): string | undefined {
  const vendor = icon?.split("/")[0];
  return vendor && vendor !== "lucide" ? vendor : undefined;
}

/** Rule 2's grouping key — see the rule's docstring above for the vendor-vs-`type` choice. */
function groupKey(lane: LaneRole, node: ArchNodeSpec): string {
  const vendor = node.parent !== undefined ? iconVendor(node.icon) : undefined;
  return vendor
    ? `${lane}\u0000vendor:${vendor}\u0000${node.parent}`
    : `${lane}\u0000type:${node.type}\u0000${node.parent ?? ""}`;
}

/**
 * A vendor key (`"aws"`, `"gcp"`, `"qlik"`) as a plain label for a box title — no catalog
 * lookup: `deriveVisualLens` stays synchronous and React-free, and the
 * catalog's own display names load asynchronously. A short key is a known cloud acronym
 * (`aws` → `AWS`); anything longer is just capitalised (`databricks` → `Databricks`).
 */
function vendorLabel(vendor: string): string {
  return vendor.length <= 4 ? vendor.toUpperCase() : vendor[0]!.toUpperCase() + vendor.slice(1);
}

export interface DeriveVisualContext {
  hero?: string | null;
  capability?: (node: ArchNodeSpec) => string | undefined;
}
export function deriveVisualLens(ast: ArchDiagram, context: DeriveVisualContext = {}): VisualLens {
  const zoneInfo = resolveZoneOwners(ast.zones);
  const zoneTitle = new Map(ast.zones.map((z) => [z.id, z.title]));

  const derived: DerivedNode[] = ast.nodes
    .filter((n) => n.type !== "note")
    .map((node) => {
      const initial = laneForNode(node, ast, zoneInfo);
      let lane = initial.lane;
      const owner = initial.owner;
      const seen = new Set<string>();
      let parent = node.parent;
      let heroMatch = false;
      let role: LaneRole | undefined;
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        const zone = ast.zones.find((entry) => entry.id === parent);
        if (!zone) break;
        if (zone.role) {
          role = zone.role;
          break;
        }
        if (context.hero && zone.provider === context.hero && owner === "saas") heroMatch = true;
        parent = zone.parent;
      }
      lane = role ?? (heroMatch ? "vendor-cloud" : lane);
      // Rule 6 pulls infrastructure that only ever moves access/network traffic into the
      // aside box — a PERSON whose only flows happen to be access flows (e.g. "Business
      // users" logging in) is not infrastructure and keeps their own box.
      const aside = node.type !== "actor" && isNetworkOrAccessOnly(node.id, ast.flows);
      return { node, lane, owner, aside };
    });

  // Rule 6 first: pull the aside members out into one bucket per lane.
  const asideByLane = new Map<LaneRole, DerivedNode[]>();
  const grouped = new Map<string, DerivedNode[]>();
  for (const entry of derived) {
    if (entry.aside) {
      const bucket = asideByLane.get(entry.lane) ?? [];
      bucket.push(entry);
      asideByLane.set(entry.lane, bucket);
      continue;
    }
    const capability = context.capability?.(entry.node);
    const key = capability
      ? `${entry.lane}\0capability:${capability}\0${entry.node.parent ?? ""}`
      : groupKey(entry.lane, entry.node);
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }

  // A zone with two or more multi-member groups (a real vendor cluster AND a generic-icon
  // leftover, say) would otherwise title both boxes identically off the one shared zone —
  // count multi-member groups per zone up front so the loop below can tell.
  const multiGroupsByZone = new Map<string, number>();
  for (const members of grouped.values()) {
    if (members.length < 2) continue;
    const zoneId = members[0]?.node.parent;
    if (zoneId === undefined) continue;
    multiGroupsByZone.set(zoneId, (multiGroupsByZone.get(zoneId) ?? 0) + 1);
  }

  const boxes: VisualBox[] = [];
  const nodeToBox = new Map<string, string>();

  const memberOf = (entry: DerivedNode): VisualBoxMember => ({
    id: entry.node.id,
    title: entry.node.title,
    icon: entry.node.icon,
  });

  for (const [, members] of grouped) {
    const [first] = members;
    if (!first) continue;
    const single = members.length === 1;
    const zoneId = first.node.parent;
    const sharesZoneWithAnotherGroup =
      zoneId !== undefined && (multiGroupsByZone.get(zoneId) ?? 0) > 1;
    const parentZone =
      !sharesZoneWithAnotherGroup && zoneId !== undefined ? zoneTitle.get(zoneId) : undefined;
    // `PLURAL_KIND_LABEL[first.node.type]` names the group by its FIRST member's type — fine
    // when every member shares one type, wrong for a
    // vendor-matched group that does not (a VPC endpoint beside two databases is not
    // "Databases"). A vendor-matched group always has a vendor (rule 2's own grouping key), so
    // the vendor itself is the fallback label there.
    const allSameType = members.every((m) => m.node.type === first.node.type);
    const kindLabel = allSameType
      ? PLURAL_KIND_LABEL[first.node.type]
      : (() => {
          const vendor = iconVendor(first.node.icon);
          return vendor ? `${vendorLabel(vendor)} services` : PLURAL_KIND_LABEL[first.node.type];
        })();
    const title =
      context.capability?.(first.node) ?? (single ? first.node.title : (parentZone ?? kindLabel));
    // The FIRST member's own id, not a running counter — `grouped` partitions every node
    // into exactly one group, so this is already
    // unique, and it is also STABLE: an unrelated edit elsewhere in the document used to
    // renumber every later box's id (a plain `box:0`, `box:1`, … counter), which would have
    // broken the orientation drill-down (`frameNodeIds`) and the morph overlay's before/after
    // matching (`lens-morph-overlay.tsx`) across two derivations of a changed document.
    const id = `box:${first.node.id}`;
    boxes.push({
      id,
      lane: first.lane,
      title,
      members: members.map(memberOf),
      owner: first.owner === "unowned" ? "unowned" : first.owner,
    });
    for (const entry of members) nodeToBox.set(entry.node.id, id);
  }

  for (const [lane, members] of asideByLane) {
    // F25: one aside box per lane (`asideByLane`'s own key), so the lane role alone is a
    // stable, unique id — same reasoning as the main groups' id just above.
    const id = `box:aside:${lane}`;
    boxes.push({
      id,
      lane,
      title: "Network & Access",
      members: members.map(memberOf),
      aside: true,
      owner: "unowned",
    });
    for (const entry of members) nodeToBox.set(entry.node.id, id);
  }

  const flows = aggregateVisualFlows(ast, boxes);

  const laneRoles = new Set(boxes.map((b) => b.lane));
  const lanes: VisualLane[] = LANE_ORDER.filter((role) => laneRoles.has(role)).map((role) => ({
    id: role,
    role,
    title: LANE_TITLE[role],
  }));

  return { lanes, boxes, flows };
}
