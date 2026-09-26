/**
 * Dialect v0 vocabulary and the normalized AST. React-free, dependency-free.
 */

export const DIALECT_VERSION = "0";

export const DIRECTIONS = ["LR", "TB"] as const;
export const NODE_STYLES = ["icon", "card"] as const;
export const LAYOUT_MODES = ["auto", "manual"] as const;
export const LEGEND_MODES = ["auto", "none"] as const;
export const LEGEND_PARTS = ["owners", "providers", "edges"] as const;
export const NODE_TYPES = ["service", "actor", "datastore", "queue", "external", "note"] as const;
export const ZONE_KINDS = [
  "cloud-account",
  "region",
  "vnet",
  "subnet",
  "cluster",
  "on-prem",
  "datacenter",
  "trust-boundary",
  "generic",
] as const;
export const ZONE_OWNERS = ["customer", "saas", "hosted", "partner"] as const;
export const FLOW_KINDS = ["data", "request", "access", "control", "network"] as const;
export const FLOW_STYLES = ["solid", "dashed", "dotted"] as const;
export const FLOW_SECURE = ["tls", "vpn", "private-link", "sso", "none"] as const;
export const FLOW_DIRECTIONS = ["forward", "back", "both"] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type NodeStyle = (typeof NODE_STYLES)[number];
export type LayoutMode = (typeof LAYOUT_MODES)[number];
export type LegendPart = (typeof LEGEND_PARTS)[number];
export type LegendSetting = (typeof LEGEND_MODES)[number] | readonly LegendPart[];
export type ArchNodeType = (typeof NODE_TYPES)[number];
export type ZoneKind = (typeof ZONE_KINDS)[number];
export type ZoneOwner = (typeof ZONE_OWNERS)[number];
export type FlowKind = (typeof FLOW_KINDS)[number];
export type FlowStyle = (typeof FLOW_STYLES)[number];
export type FlowSecure = (typeof FLOW_SECURE)[number];
export type FlowDirection = (typeof FLOW_DIRECTIONS)[number];
export type Tone = "neutral" | "info" | "success" | "warning" | "destructive";

export interface Point {
  x: number;
  y: number;
}

// ── Normalized AST ─────────────────────────────────────────────────────────
// `path` is the entry's address in the authoring text ("zones[0].children[1]");
// issues and the source map use the same paths.

export interface ArchZoneSpec {
  path: string;
  id: string;
  parent?: string;
  kind: ZoneKind;
  owner?: ZoneOwner;
  provider?: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  class?: readonly string[];
  collapsed: boolean;
  direction?: Direction;
  position?: Point;
}

export interface ArchNodeSpec {
  path: string;
  id: string;
  parent?: string;
  type: ArchNodeType;
  variant?: NodeStyle;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  badges?: readonly string[];
  class?: readonly string[];
  tone?: Tone;
  href?: string;
  text?: string;
  position?: Point;
}

export interface ArchFlowSpec {
  path: string;
  /** How it was written: `- a -> b`, `- a -> b: …`, or `- { from, to }`. DG-14 writes back in the same form. */
  form: "string" | "shorthand" | "object";
  from: string;
  to: string;
  direction: FlowDirection;
  kind: FlowKind;
  animated: boolean;
  label?: string;
  style?: FlowStyle;
  secure?: FlowSecure;
  protocol?: string;
  schedule?: string;
  step?: number;
  class?: readonly string[];
}

export interface ArchNoteSpec {
  path: string;
  at: string;
  text: string;
}

export interface ArchStyleSpec {
  tone?: Tone;
  badge?: string;
}

export interface ArchDiagram {
  version: typeof DIALECT_VERSION;
  title?: string;
  direction: Direction;
  nodeStyle: NodeStyle;
  theme?: string;
  legend: LegendSetting;
  layout: LayoutMode;
  /** Every zone, flattened, in document pre-order. */
  zones: ArchZoneSpec[];
  /** Every node, flattened, in document pre-order. */
  nodes: ArchNodeSpec[];
  flows: ArchFlowSpec[];
  styles: Record<string, ArchStyleSpec>;
  notes: ArchNoteSpec[];
}
