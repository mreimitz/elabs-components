import type { ArchFlowSpec, ZoneOwner } from "../spec/dialect";

/**
 * Where a lane sits, left → right (`docs/2026-09-27-visual-lens-concept.md` §3 rule 1). No
 * `vendor-cloud` is ever derived in this slice: it depends on a "hero" vendor, which is
 * app/theme-level (S1) and out of scope here — kept as a role so a later slice can add it
 * without a new type.
 */
export type LaneRole = "sources" | "customer-managed" | "customer-vpc" | "vendor-cloud" | "targets";

/** Fixed left-to-right order (concept §3 rule 1, style-system concept §2.2 `layout.lanes`). */
export const LANE_ORDER: readonly LaneRole[] = [
  "vendor-cloud",
  "sources",
  "customer-managed",
  "customer-vpc",
  "targets",
];

export const LANE_TITLE: Record<LaneRole, string> = {
  "vendor-cloud": "Vendor cloud",
  sources: "Sources",
  "customer-managed": "Customer managed",
  "customer-vpc": "Customer VPC",
  targets: "Targets",
};

export interface VisualLane {
  id: string;
  role: LaneRole;
  title: string;
  of?: readonly string[];
}

export interface VisualBoxMember {
  /** The technical node id — kept so hover/⌥-click (orientation) can frame it. */
  id: string;
  title: string;
  icon?: string;
}

export interface VisualBox {
  summary?: boolean;
  slot?: number;
  /** Exact technical boundary represented independently of its children. */
  boundaryOf?: string;
  id: string;
  lane: string;
  title: string;
  members: VisualBoxMember[];
  /** Rule 6: a network/access-only fold, drawn as a lighter, secondary box. */
  aside?: boolean;
  processes?: readonly string[];
  sub?: readonly string[];
  controlPlane?: boolean;
  provider?: string;
  /** No hero this slice (S1/S3): boxes colour by the owner of their members' zone. */
  owner: ZoneOwner | "unowned";
}

/** Aggregated box→box flow (concept §3 rule 3): `data` → solid, everything else → dashed. */
export type VisualFlowKind = "data" | "other";

export interface VisualRelationship extends Omit<ArchFlowSpec, "path" | "form"> {
  id: string;
}

export interface VisualFlow {
  /** Explicit visual annotation; derived source labels must not become broad pair overrides. */
  annotated?: boolean;
  sourceFlowIds?: readonly string[];
  relationships?: readonly VisualRelationship[];
  id: string;
  from: string;
  to: string;
  kind: VisualFlowKind;
  bidirectional: boolean;
  label?: string;
  process?: string;
}

export interface VisualLens {
  /** All technical relationships, including those internal to a capability. */
  relationships?: readonly VisualRelationship[];
  composition?: "deployment" | "process";
  hidden?: readonly string[];
  lanes: VisualLane[];
  boxes: VisualBox[];
  flows: VisualFlow[];
}
