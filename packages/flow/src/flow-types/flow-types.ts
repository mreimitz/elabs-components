import type { ReactNode } from "react";
import type { FlowEmphasis, FlowToneInput } from "../flow-tone";

/**
 * The `type` key of every built-in node kind — what a node's `type` field names and
 * what a `nodeTypes` map is keyed by. `FLOW_GROUP_NODE_TYPE` is `FLOW_NODE_TYPE.group`.
 */
export const FLOW_NODE_TYPE = {
  brand: "brand",
  group: "group",
  placeholder: "placeholder",
} as const;

/** A built-in node kind's `type` key. */
export type FlowNodeType = (typeof FLOW_NODE_TYPE)[keyof typeof FLOW_NODE_TYPE];

/** The `type` key of every built-in edge kind — what an `edgeTypes` map is keyed by. */
export const FLOW_EDGE_TYPE = {
  brand: "brand",
  button: "button",
  smart: "smart",
  floating: "floating",
  weighted: "weighted",
  selfLoop: "self-loop",
} as const;

/** A built-in edge kind's `type` key. */
export type FlowEdgeType = (typeof FLOW_EDGE_TYPE)[keyof typeof FLOW_EDGE_TYPE];

/**
 * The fields every built-in node kind shares: a title, an optional icon and the two
 * tone axes. `FlowNodeData` and `FlowGroupNodeData` extend it, and a custom node's data
 * can too, so a tone or a title means the same thing on every node of a canvas.
 */
export interface FlowNodeBaseData extends Record<string, unknown> {
  /** The node's primary label. */
  title: string;
  /** Optional leading glyph (a Lucide icon element). Code-only: it is not serializable. */
  icon?: ReactNode;
  /**
   * Status tone — `StatusTone`: `"neutral" | "info" | "success" | "warning" |
   * "destructive"`. The legacy `"default"` (→ `"neutral"`) and `"accent"` (→
   * `emphasis: "featured"`) still work, with a one-time warning, until 6.0.0.
   * @default "neutral"
   */
  tone?: FlowToneInput;
  /** Flow-only emphasis: `"featured"` marks the "look here" node with a star. @default "default" */
  emphasis?: FlowEmphasis;
}
