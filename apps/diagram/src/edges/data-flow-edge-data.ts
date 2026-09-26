import type { Edge } from "@elabs-ai/components-flow";

/** What a flow carries (plan D12). Each kind has a non-colour second channel — `edge-style.ts`. */
export type FlowKind = "data" | "request" | "access" | "control" | "network";

/** Line pattern of a flow. `control` defaults to `dotted` when no style is given. */
export type FlowLineStyle = "solid" | "dashed" | "dotted";

/** How a flow is secured; `none` renders no glyph. */
export type FlowSecure = "tls" | "vpn" | "private-link" | "sso" | "none";

/**
 * Arrow direction. `back` keeps the written order (`from: a, to: b`) and only flips the
 * arrowhead (plan §11, "Reverse arrows"); `both` draws a head at each end.
 */
export type FlowDirection = "forward" | "back" | "both";

/** Per-edge `data` of a `DataFlowEdge` — every D12 axis, all optional. */
export interface DataFlowEdgeData extends Record<string, unknown> {
  label?: string;
  kind?: FlowKind;
  style?: FlowLineStyle;
  animated?: boolean;
  secure?: FlowSecure;
  direction?: FlowDirection;
  /** Numbered step (1-based) for a step-through reading of the diagram. */
  step?: number;
  /** Mono chip, e.g. `HTTPS 443`, `JDBC`, `Kafka`. */
  protocol?: string;
  /** Secondary meta text, e.g. `real-time`, `hourly`, `nightly batch`. */
  schedule?: string;
  /**
   * Attach a zone endpoint to the zone's rectangle border (facing the other end)
   * instead of the zone's fixed port. Leaf endpoints always stay on their measured handle.
   */
  floating?: boolean;
  /** Reusable style classes from the dialect's `styles:` block (DG-10 resolves them). */
  classes?: string[];
}

/** The edge-type key `DataFlowEdge` is registered under. */
export const FLOW_EDGE_TYPE_KEY = "arch/flow" as const;

/** A `DataFlowEdge` edge object. */
export type DataFlowEdge = Edge<DataFlowEdgeData, typeof FLOW_EDGE_TYPE_KEY>;
