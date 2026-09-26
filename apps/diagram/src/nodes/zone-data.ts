import type { Node } from "@xyflow/react";

/**
 * DG-06 — the zone vocabulary (plan §2 D3): topology `kind` × `owner` × `provider`.
 * `kind` sets the boundary's shape and weight, `owner` its fill and border style, and
 * `provider` the vendor mark in the header. Owner and kind must survive greyscale
 * (WCAG 1.4.1), so neither is carried by colour: border style + the owner word in the
 * header name the owner, border weight + radius + the kind glyph name the kind.
 */
export type ZoneKind =
  | "cloud-account"
  | "region"
  | "vnet"
  | "subnet"
  | "cluster"
  | "on-prem"
  | "datacenter"
  | "trust-boundary"
  | "generic";

export type ZoneOwner = "customer" | "saas" | "hosted" | "partner";

export interface ZoneData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  kind: ZoneKind;
  owner: ZoneOwner;
  /** A vendor key (`aws`, `azure`, `qlik`, …); the header shows `<vendor>/<vendor>`. */
  provider?: string;
  icon?: string;
  /** Written by `useFlowGroups().collapseGroup` / `expandGroup` (and the header toggle). */
  collapsed?: boolean;
  direction?: "LR" | "TB";
  /**
   * `"auto"` (default): `useZoneAutofit` keeps the zone wrapped around its children.
   * `"manual"`: the zone keeps its own size — resizing a zone by hand switches it here.
   */
  sizing?: "auto" | "manual";
  classes?: string[];
}

export const ZONE_NODE_TYPE = "arch/zone" as const;

export type ZoneNode = Node<ZoneData, typeof ZONE_NODE_TYPE>;

/** True for a node rendered by `ZoneNode`. */
export function isZoneNode(node: Node): node is ZoneNode {
  return node.type === ZONE_NODE_TYPE;
}

/**
 * Geometry shared by the node, the auto-fit hook and ELK, so all three agree on where a
 * zone's children may sit.
 *
 * `layoutFlowElk` reserves `[top=60,left=16,bottom=16,right=16]` inside every group
 * (`GROUP_PADDING`, packages/flow/src/flow-layout/layout-flow-elk.ts:104 — a private
 * string, not exported). 60 = a 44 px header band + the 16 px inset the other three sides
 * get. The zone header is `h-11` (44 px) and the auto-fit hook keeps a 16 px inset below
 * it, so ELK's output is already a fixed point of the auto-fit: nothing moves on load.
 * P4: library gap — the header height and group inset are not exported from flow; they
 * are mirrored here by hand (DG-06-zone-primitives.md, "Shared group geometry").
 */
export const ZONE_HEADER_HEIGHT = 44;
export const ZONE_PADDING = 16;
export const ZONE_MIN_WIDTH = 160;
export const ZONE_MIN_HEIGHT = 80;

/** The kind, spelled out for assistive technology (sighted users read glyph + border). */
export const KIND_LABEL: Record<ZoneKind, string> = {
  "cloud-account": "Cloud account",
  region: "Region",
  vnet: "Virtual network",
  subnet: "Subnet",
  cluster: "Cluster",
  "on-prem": "On-premises",
  datacenter: "Data center",
  "trust-boundary": "Trust boundary",
  generic: "Zone",
};

/** The owner word in the header — the greyscale-proof channel for `owner` (WCAG 1.4.1). */
export const OWNER_LABEL: Record<ZoneOwner, string> = {
  customer: "Customer managed",
  saas: "SaaS",
  hosted: "Hosted",
  partner: "Partner",
};
