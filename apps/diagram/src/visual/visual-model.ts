/**
 * The visual lens's own vocabulary (maintainer 2026-09-27, "the switch from technical to
 * visual"). A coarser-grain view of the same technical diagram: lanes group zones by role,
 * boxes group nodes, flows aggregate edges. React-free — `derive-visual.ts` builds it from
 * the dialect AST; `src/panes/visual-canvas-pane.tsx` is the only consumer that touches React.
 *
 * Scope for this slice (see `docs/2026-09-27-visual-lens-concept.md` for the fuller model this
 * narrows): no `visual:` YAML block (everything is derived, never authored or materialized), no
 * style profiles or hero vendor (S1/S3 — colour is by `owner` only), no catalog `capability`
 * field (a box with more than one member is titled by its shared parent zone, or a plain kind
 * label when the members share no zone).
 */
import type { ZoneOwner } from "../spec/dialect";

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
  id: LaneRole;
  role: LaneRole;
  title: string;
}

export interface VisualBoxMember {
  /** The technical node id — kept so hover/⌥-click (orientation) can frame it. */
  id: string;
  title: string;
  icon?: string;
}

export interface VisualBox {
  id: string;
  lane: LaneRole;
  title: string;
  members: VisualBoxMember[];
  /** Rule 6: a network/access-only fold, drawn as a lighter, secondary box. */
  aside?: boolean;
  /** No hero this slice (S1/S3): boxes colour by the owner of their members' zone. */
  owner: ZoneOwner | "unowned";
}

/** Aggregated box→box flow (concept §3 rule 3): `data` → solid, everything else → dashed. */
export type VisualFlowKind = "data" | "other";

export interface VisualFlow {
  id: string;
  from: string;
  to: string;
  kind: VisualFlowKind;
  bidirectional: boolean;
}

export interface VisualLens {
  lanes: VisualLane[];
  boxes: VisualBox[];
  flows: VisualFlow[];
}
