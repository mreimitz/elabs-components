/**
 * `deriveVisualLens(ast)` — the technical dialect AST → a `VisualLens` (visual-model.ts), with
 * no `visual:` block in the YAML: every diagram gets a visual lens on day one (maintainer
 * 2026-09-27; `docs/2026-09-27-visual-lens-concept.md` §3's derivation rules, narrowed for this
 * slice — no hero, no catalog `capability` field). Pure and React-free: only `ArchDiagram`
 * (`spec/dialect`) in, `VisualLens` out. Deterministic — the same AST always derives the same
 * lens (same box/lane ids, same member and flow order): every grouping `Map` here is filled by
 * walking `ast.zones`/`ast.nodes`/`ast.flows` in their given (document) order, and a `Map`
 * iterates in insertion order, so the derived order always traces back to the document's.
 *
 * ## Rule 1 — lanes (concept §3 rule 1)
 * A zone's role is read by walking from it up through `parent` (closest ancestor first): the
 * first zone on the way whose (inherited) `owner` is `"customer"` and whose OWN `kind` is
 * `on-prem`/`datacenter` gives `customer-managed`; `cloud-account`/`vnet` gives `customer-vpc`.
 * No match up to the root, and the zone's own owner is `customer` → `customer-managed` (a
 * customer zone with a kind the rule does not name, e.g. `generic`, still reads as customer
 * territory). Everything else — `saas`, `hosted`, `partner`, and a customer zone that matched
 * nothing — falls to the "other saas" branch: `sources` if it is a net emitter, `targets` if a
 * net receiver, counting only `kind: "data"` flows that cross the zone's own boundary (control/
 * access/network flows are rule 6's business, not lane placement). **No hero this slice** (S1
 * says hero is app/theme-level): the concept's `owner: saas + provider == hero → vendor-cloud`
 * branch never fires here — `vendor-cloud` is derived by nothing in this file, only kept as a
 * `LaneRole` for forward compatibility. A node with no zone at all uses the same net-flow rule,
 * over its own edges.
 *
 * **A documented simplification:** a tie (net flow of exactly 0, including a zone/node with no
 * data flow crossing its boundary at all) defaults to `targets`. The concept's own rule is
 * silent on ties; `docs/findings/lens-switch-slice.md` records this and flags it as arbitrary.
 *
 * ## Rule 2 — boxes (concept §3 rule 2, narrowed: no catalog `capability` field)
 * Nodes with the same derived lane and the same parent zone group into one box, if either
 * shares one more thing: a real product vendor (the icon's namespace, e.g. `"aws"` in
 * `"aws/rds"`) — regardless of technical `type` — or, with no such vendor to go on (no icon,
 * or a generic `lucide` glyph — not a real product's brand), the same `type` (`ArchNodeType`)
 * instead, the stricter original match. `undefined` parent zone counts as one shared "no
 * zone" bucket for the `type` path only; a vendor match always requires an actual shared
 * zone. **Maintainer feedback, 2026-09-27** (`.evidence/lens-preview-merge/`): matching on
 * `type` alone read as "the technical diagram in boxes" — two S3 buckets and Glue
 * (`datastore`/`service`) are one AWS system, not two; Postgres and MSK (`datastore`/`queue`)
 * likewise. The vendor match is what lets those merge while still keeping Databricks jobs —
 * same zone, `databricks` vendor — its own box: a `type`-only key could not tell "one system,
 * several technical roles" apart from "two unrelated systems that happen to share a zone",
 * and a vendor could. A group of exactly one node keeps its own title and icon; a group of
 * two or more is titled by the shared parent zone's title when they have one AND no other
 * multi-member group shares it (a zone can still produce two boxes — a real vendor's cluster
 * plus a generic-icon leftover, e.g. `clickhouse-cloud-stack.yaml`'s Grafana + Superset beside
 * its AWS trio — and both cannot be named after the same zone), else a plain plural label for
 * the kind (`PLURAL_KIND_LABEL`, e.g. "Databases" for `datastore` — the `type`-path, no-zone,
 * and zone-collision cases alike). `note` nodes never enter a box: they are canvas
 * annotations, not architecture, in both lenses.
 *
 * ## Rule 6 — network/access aside (concept §3 rule 6), applied BEFORE rule 2
 * A node whose every technical flow (either end) is `kind: "access"` or `kind: "network"`, and
 * that has at least one flow, is pulled out of its rule-2 group into a "Network & Access" aside
 * box for its lane instead (one aside box per lane that needs one, not a single global one —
 * findings doc explains why).
 *
 * ## Rule 3 — flows (concept §3 rule 3)
 * Every technical flow is resolved to a `(fromBox, toBox)` pair and `kind: "data"` → `"data"`,
 * else `"other"`. A flow endpoint that names a ZONE (a "floating" edge, `edges/zone-endpoint.ts`)
 * resolves to that zone's own **primary box**: the box holding the most of the zone's descendant
 * nodes, ties broken by which of those nodes comes first in `ast.nodes` document order — a
 * documented simplification (see findings) that keeps a zone-wide flow (e.g. a VPC's
 * PrivateLink to a SaaS zone) as one edge instead of a box-count cartesian product. Same-box
 * pairs (a flow that collapses onto itself) are dropped. Two opposite-direction pairs between
 * the same two boxes merge into one bidirectional flow (solid if either contributing flow is
 * `data`). Duplicate same-direction pairs collapse into one (solid wins over dashed).
 */
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
  type VisualFlow,
  type VisualFlowKind,
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
  for (let id: string | undefined = zoneId; id !== undefined; ) {
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
    for (let cur: string | undefined = id; cur !== undefined; ) {
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

/** Rule 1, the "other saas" / no-zone branch. Ties (net === 0) default to `targets` (documented). */
function flowRole(id: string, flows: readonly ArchFlowSpec[], members: Set<string>): LaneRole {
  return netDataFlow(id, flows, members) > 0 ? "sources" : "targets";
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
  return { lane: flowRole(node.id, ast.flows, new Set([node.id])), owner: "unowned" };
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

export function deriveVisualLens(ast: ArchDiagram): VisualLens {
  const zoneInfo = resolveZoneOwners(ast.zones);
  const zoneTitle = new Map(ast.zones.map((z) => [z.id, z.title]));

  const derived: DerivedNode[] = ast.nodes
    .filter((n) => n.type !== "note")
    .map((node) => {
      const { lane, owner } = laneForNode(node, ast, zoneInfo);
      return { node, lane, owner, aside: isNetworkOrAccessOnly(node.id, ast.flows) };
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
    const key = groupKey(entry.lane, entry.node);
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
  let boxSeq = 0;

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
    const title = single ? first.node.title : (parentZone ?? PLURAL_KIND_LABEL[first.node.type]);
    const id = `box:${boxSeq++}`;
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
    const id = `box:${boxSeq++}`;
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

  // Rule 3: technical flows → box→box, deduped, opposite pairs merged bidirectional.
  const zoneNodeIds = new Map<string, string[]>();
  const primaryBoxForZone = (zoneId: string): string | undefined => {
    let cached = zoneNodeIds.get(zoneId);
    if (!cached) {
      cached = descendantNodeIds(zoneId, ast.nodes, zoneInfo);
      zoneNodeIds.set(zoneId, cached);
    }
    const counts = new Map<string, number>();
    const firstSeenAt = new Map<string, number>();
    cached.forEach((nodeId, index) => {
      const boxId = nodeToBox.get(nodeId);
      if (!boxId) return;
      counts.set(boxId, (counts.get(boxId) ?? 0) + 1);
      if (!firstSeenAt.has(boxId)) firstSeenAt.set(boxId, index);
    });
    let best: string | undefined;
    for (const [boxId, count] of counts) {
      if (
        !best ||
        count > (counts.get(best) ?? 0) ||
        (count === counts.get(best) && (firstSeenAt.get(boxId) ?? 0) < (firstSeenAt.get(best) ?? 0))
      ) {
        best = boxId;
      }
    }
    return best;
  };
  const boxOf = (endpoint: string): string | undefined =>
    nodeToBox.get(endpoint) ?? primaryBoxForZone(endpoint);

  const pairs = new Map<string, { forward: VisualFlowKind[]; backward: VisualFlowKind[] }>();
  for (const flow of ast.flows) {
    const from = boxOf(flow.from);
    const to = boxOf(flow.to);
    if (!from || !to || from === to) continue;
    const flowKind: VisualFlowKind = flow.kind === "data" ? "data" : "other";
    const forward = flow.direction !== "back";
    const [a, b] = forward ? [from, to] : [to, from];
    const key = `${a}\u0000${b}`;
    const reverseKey = `${b}\u0000${a}`;
    const existing = pairs.get(key) ?? pairs.get(reverseKey);
    if (existing && pairs.has(reverseKey)) {
      // The pair already exists in the opposite direction: this flow makes it bidirectional.
      existing.backward.push(flowKind);
      if (flow.direction === "both") existing.forward.push(flowKind);
    } else {
      const bucket = pairs.get(key) ?? { forward: [], backward: [] };
      bucket.forward.push(flowKind);
      if (flow.direction === "both") bucket.backward.push(flowKind);
      pairs.set(key, bucket);
    }
  }
  const flows: VisualFlow[] = [];
  let flowSeq = 0;
  for (const [key, { forward, backward }] of pairs) {
    const [from, to] = key.split("\u0000") as [string, string];
    const kinds = [...forward, ...backward];
    flows.push({
      id: `flow:${flowSeq++}`,
      from,
      to,
      kind: kinds.includes("data") ? "data" : "other",
      bidirectional: backward.length > 0,
    });
  }

  const laneRoles = new Set(boxes.map((b) => b.lane));
  const lanes: VisualLane[] = LANE_ORDER.filter((role) => laneRoles.has(role)).map((role) => ({
    id: role,
    role,
    title: LANE_TITLE[role],
  }));

  return { lanes, boxes, flows };
}
