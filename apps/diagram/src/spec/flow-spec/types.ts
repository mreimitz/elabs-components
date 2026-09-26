/**
 * FlowSpec v1 — the minimal in-app core of the flow review §4.4
 * (docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md). Same names and shapes as
 * the review, so P4 replaces this folder, not its callers. React-free.
 */

export const FLOW_SPEC_VERSION = "1";

/** `elk` = laid out by DG-11; `none` = every node carries its own `position` (`layout: manual`). */
export type FlowSpecLayoutEngine = "elk" | "none";
export type FlowSpecDirection = "LR" | "TB";

export interface FlowSpecPoint {
  x: number;
  y: number;
}

export interface FlowSpecNode {
  id: string;
  /** A registered type key (`arch/service`, `arch/zone`, …). */
  type: string;
  data: Record<string, unknown>;
  parent?: string;
  position?: FlowSpecPoint;
}

export interface FlowSpecEdge {
  id: string;
  source: string;
  target: string;
  /** Port NAME on the source (`out`, `bottom`); unset → `toReactFlow` picks one from the definition. */
  sourcePort?: string;
  targetPort?: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FlowSpec {
  flow: typeof FLOW_SPEC_VERSION;
  title?: string;
  layout: { engine: FlowSpecLayoutEngine; direction: FlowSpecDirection };
  nodes: FlowSpecNode[];
  edges: FlowSpecEdge[];
}

// ── Definitions: the stand-in for defineFlowNodeType / defineFlowEdgeType (review §4.1) ──

export type FlowPortSide = "left" | "right" | "top" | "bottom";

export interface FlowPortDefinition {
  direction: "input" | "output";
  side: FlowPortSide;
  /** Most edges this port accepts. Unset → unlimited. */
  max?: number;
}

export type FlowFieldKind = "string" | "number" | "boolean" | "string[]" | "object";

export interface FlowFieldDefinition {
  kind: FlowFieldKind;
  required?: boolean;
}

export interface FlowSpecDefinition {
  /** The type key a spec node/edge names in `type`. */
  id: string;
  kind: "node" | "edge";
  label: string;
  /** Light field map (key → kind). Unknown keys are allowed — the dialect already checked them. */
  fields: Readonly<Record<string, FlowFieldDefinition>>;
  /**
   * Ports by NAME (nodes only). The React Flow handle id is `in:<name>` / `out:<name>` — flow's
   * `flowPortId` (packages/flow/src/flow-port/flow-port.tsx:16), mirrored here because that
   * module is React.
   */
  targets?: Readonly<Record<string, FlowPortDefinition>>;
  capabilities?: { container?: boolean };
}

export type FlowSpecDefinitions = ReadonlyMap<string, FlowSpecDefinition>;

export type FlowSpecIssueCode =
  | "unsupported-flow-version"
  | "duplicate-id"
  | "unknown-type"
  | "unknown-parent"
  | "parent-not-container"
  | "parent-cycle"
  | "dangling-edge"
  | "no-port"
  | "unknown-port"
  | "port-limit"
  | "missing-position"
  | "missing-field"
  | "wrong-field-type";

/** Same shape as DG-09's `ArchIssue` minus `range` (a FlowSpec has no text). */
export interface FlowSpecIssue {
  /** `nodes[3].data.title`, `edges[1].target`, … */
  path: string;
  code: FlowSpecIssueCode;
  message: string;
  severity: "error" | "warning";
}
