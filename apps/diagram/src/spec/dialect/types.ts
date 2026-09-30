import type { StyleSelection } from "../../style/types";
/**
 * Dialect v1 vocabulary (a superset of v0) and the normalized AST. React-free,
 * dependency-free.
 */

/** The dialect this app writes: new files, the upgrader's target. */
export const DIALECT_VERSION = "1";
/** Every dialect this app reads (N3: an older major still opens). */
export const READ_VERSIONS = ["0", "1"] as const;
export type DialectVersion = (typeof READ_VERSIONS)[number];

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
export const VISUAL_ROLES = [
  "sources",
  "customer-managed",
  "customer-vpc",
  "vendor-cloud",
  "targets",
] as const;
export type VisualRole = (typeof VISUAL_ROLES)[number];
export interface ArchVisualLane {
  id: string;
  role: VisualRole;
  title: string;
  of?: readonly string[];
}
export interface ArchVisualBox {
  boundary?: string;
  summary?: boolean;
  slot?: number;
  id: string;
  lane: string;
  title: string;
  members: readonly string[];
  processes?: readonly string[];
  sub?: readonly string[];
  aside?: boolean;
}
export interface ArchVisualFlow {
  from: string;
  to: string;
  process?: string;
  label?: string;
}
export interface ArchVisualSpec {
  composition?: "deployment" | "process";
  lanes?: readonly ArchVisualLane[];
  boxes?: readonly ArchVisualBox[];
  flows?: readonly ArchVisualFlow[];
  hide?: readonly string[];
  controlPlane?: readonly string[];
}
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
/** Plan V13. DG-25 shows it on the card; the canvas look is DG-33's (out of R1). */
export const NODE_STATUS = ["ok", "degraded", "down", "planned"] as const;
export type NodeStatus = (typeof NODE_STATUS)[number];
/**
 * Keys a reference supplies when the node does not write them (maintainer ruling
 * 2026-09-27: nodes are reference-first). Part 1b fills them for catalog references;
 * Part 2 reads title and icon for diagram references. `description` and `docs` are
 * applied by the reader (DG-25), not filled.
 */
export const SUPPLIED_KEYS = ["title", "subtitle", "icon", "type", "badges"] as const;
export type SuppliedKey = (typeof SUPPLIED_KEYS)[number];

/**
 * Whether a `SuppliedKey`'s raw value on a node counts as written — the value a reference
 * will not fill in. YAML null (the key present with no value, e.g. `title:`) is always
 * unwritten, same as the key's outright absence. An explicit `""` is a deliberate override
 * that draws nothing, the same as `badges: []`; it never falls back to the reference's value.
 * One check, shared by `normalize.ts` (what `unwritten` lists) and `upgrade.ts` (what the
 * reference-first migration may still need to pin).
 */
export function isSuppliedKeyWritten(entry: Record<string, unknown>, key: SuppliedKey): boolean {
  return key in entry && entry[key] !== null;
}

export interface Point {
  x: number;
  y: number;
}

// ── Normalized AST ─────────────────────────────────────────────────────────
// `path` is the entry's address in the authoring text ("zones[0].children[1]");
// issues and the source map use the same paths.

export interface ArchZoneSpec {
  arrangement?: "sequence" | "parallel";
  align?: "start" | "center";
  path: string;
  id: string;
  parent?: string;
  kind: ZoneKind;
  owner?: ZoneOwner;
  provider?: string;
  role?: VisualRole;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  class?: readonly string[];
  collapsed: boolean;
  direction?: Direction;
  position?: Point;
  docs?: string;
  status?: NodeStatus;
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
  docs?: string;
  status?: NodeStatus;
  /** `catalog/<pack>/<entry>` or `ws/<folder>/…/<file name>`, as written. */
  ref?: string;
  /** Only with `ref`: the SUPPLIED_KEYS this node does not write. */
  unwritten?: readonly SuppliedKey[];
  /** As written. Means something only on a diagram reference: false = one node, true = inline (Part 3). */
  expand?: boolean;
  /** The catalog entry name ("aws/glue") once a catalog reference resolved (Part 1b). */
  catalogEntry?: string;
}

export interface ArchFlowSpec {
  layoutRole?: "primary" | "secondary";
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

/** `component:` (plan §4.2): marks and describes a diagram meant to be referenced. */
export interface ArchComponentSpec {
  icon?: string;
  description?: string;
  /** Carried, not checked: the shape and its enforcement are R2's (success-plan :69). */
  extensionPoints?: readonly Record<string, unknown>[];
}

export interface ArchStoryCallout {
  path: string;
  at: string;
  text: string;
}
export interface ArchStoryStep {
  path: string;
  title: string;
  targets: readonly string[];
  text?: string;
  /** Seconds, normalized to 8 when absent. */
  duration: number;
  callouts: readonly ArchStoryCallout[];
}
export interface ArchStorySpec {
  autoplay?: boolean;
  steps: readonly ArchStoryStep[];
}

export interface ArchDiagram {
  version: typeof DIALECT_VERSION;
  /** What the file said ("0" or "1"); `version` above is always the dialect this app writes. */
  sourceVersion: DialectVersion;
  title?: string;
  // DG-68: the title block's prose line (title-block.tsx description prop).
  description?: string;
  direction: Direction;
  nodeStyle: NodeStyle;
  theme?: string;
  style?: StyleSelection;
  legend: LegendSetting;
  layout: LayoutMode;
  /** Every zone, flattened, in document pre-order. */
  zones: ArchZoneSpec[];
  /** Every node, flattened, in document pre-order. */
  nodes: ArchNodeSpec[];
  flows: ArchFlowSpec[];
  styles: Record<string, ArchStyleSpec>;
  notes: ArchNoteSpec[];
  /** Describes this diagram as a reusable reference (plan §4.2). */
  component?: ArchComponentSpec;
  /** Explicit empty steps suppress the numbered-flow shortcut. */
  story?: ArchStorySpec;
  /** Optional authored structure for the visual lens. */
  visual?: ArchVisualSpec;
}
