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
  /**
   * Layout-owned (wave-2 review M2): the route ELK computed for this edge, in absolute flow
   * coordinates. Written by `layoutDiagram`/`relayoutVisible`, never by the compiler;
   * `patchGraph` keeps it through a words-only edit. `DataFlowEdge` draws it while its ends
   * still sit on the rendered handles and falls back to a smooth step otherwise.
   */
  route?: DataFlowEdgeRoute;
}

/** A point in absolute flow coordinates. */
export interface RoutePoint {
  x: number;
  y: number;
}

/** ELK's route for one edge: start, bend points and end, plus the placed label box. */
export interface DataFlowEdgeRoute {
  points: RoutePoint[];
  /** The label cluster's box as ELK placed it (top-left corner and size). */
  label?: { x: number; y: number; width: number; height: number };
  /**
   * An end ELK could only route to a zone's border: the zone has its own `direction:`, is laid
   * out separately, and the edge was lifted to it (`decorateElkGraph`). The route stops on
   * that zone's border; `DataFlowEdge` joins it to the handle inside with a short step.
   */
  via?: { source?: string; target?: string };
}

/** The edge-type key `DataFlowEdge` is registered under. */
export const FLOW_EDGE_TYPE_KEY = "arch/flow" as const;

/** A `DataFlowEdge` edge object. */
export type DataFlowEdge = Edge<DataFlowEdgeData, typeof FLOW_EDGE_TYPE_KEY>;
