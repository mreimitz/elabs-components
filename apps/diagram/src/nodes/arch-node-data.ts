import type { FlowEmphasis, FlowToneInput, Node } from "@elabs-ai/components-flow";

/**
 * DG-05 — the data contract every architecture node (`arch/*`) renders from.
 *
 * Plan §4: node `type` is `service` (default), `actor`, `datastore`, `queue`, `external`
 * or `note`; `variant` is the D5 look, `icon` (AWS/Azure reference-architecture style) or
 * `card` (C4 style). Everything here is JSON — the dialect compiles straight into it — so
 * the icon is a `vendor/name` NAME (plan D4), never the `ReactNode` that flow's
 * `FlowNodeBaseData.icon` takes (flow review §4.1).
 */
export type ArchNodeKind = "service" | "actor" | "datastore" | "queue" | "external" | "note";

/** The D5 node look. */
export type ArchNodeVariant = "icon" | "card";

export interface ArchNodeData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  /** A `vendor/name` icon name (`aws/lambda`, `lucide/database`) — see `icons/icon-name.ts`. */
  icon?: string;
  badges?: string[];
  /** The D5 look; the diagram's `nodeStyle` fills it in when the node does not. */
  variant?: ArchNodeVariant;
  tone?: FlowToneInput;
  emphasis?: FlowEmphasis;
  provider?: string;
  /** Hover / inspector only — never drawn on the node. */
  description?: string;
  href?: string;
  classes?: string[];
  /** Note only: the note's body. Falls back to `title`. */
  text?: string;
}

/** The React Flow `type` of each kind — the keys of `archNodeTypes` (`node-types.ts`). */
export const ARCH_NODE_TYPE = {
  service: "arch/service",
  actor: "arch/actor",
  datastore: "arch/datastore",
  queue: "arch/queue",
  external: "arch/external",
  note: "arch/note",
} as const;

export type ArchNodeType = (typeof ARCH_NODE_TYPE)[ArchNodeKind];

export type ArchNode = Node<ArchNodeData, ArchNodeType>;

/** The kinds that draw a mark, a title and ports (every kind but `note`). */
export type ArchMarkedKind = Exclude<ArchNodeKind, "note">;

/**
 * The glyph a node of each kind draws when its data names no `icon`, so the kind still
 * reads in the `icon` look (where no frame carries it). `actor` → `lucide/user` is the
 * item's rule; the others follow the same idea. Every name is a `LUCIDE_ICONS` key.
 */
export const ARCH_KIND_DEFAULT_ICON: Record<ArchMarkedKind, string> = {
  service: "lucide/box",
  actor: "lucide/user",
  datastore: "lucide/database",
  queue: "lucide/layers",
  external: "lucide/globe",
};

/** The `card` look's eyebrow when the node names no `provider`. */
export const ARCH_KIND_LABEL: Record<ArchMarkedKind, string> = {
  service: "Service",
  actor: "Actor",
  datastore: "Data store",
  queue: "Queue",
  external: "External system",
};
