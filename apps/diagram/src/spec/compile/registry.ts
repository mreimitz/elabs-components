/**
 * The arch registry (review §4.2): `{ definition, component }` bound for the canvas. The ONLY
 * file under `src/spec/` that imports components — everything else here stays React-free.
 * Also the compile-time parity check between the dialect vocabulary (DG-09) and the
 * component unions (DG-05/06/07): a drift fails `typecheck:local` on this file.
 */
import type { FlowToneInput } from "@elabs-ai/components-flow";
import type {
  ArchNodeType as DialectNodeType,
  Direction,
  FlowDirection as DialectFlowDirection,
  FlowKind as DialectFlowKind,
  FlowSecure as DialectFlowSecure,
  FlowStyle,
  NodeStyle,
  Tone,
  ZoneKind as DialectZoneKind,
  ZoneOwner as DialectZoneOwner,
} from "../dialect";
import type { FlowSpecDefinitions } from "../flow-spec/types";
import type { ReactFlowGraph } from "../flow-spec/to-react-flow";
import type {
  ArchMarkedKind,
  ArchNodeData,
  ArchNodeKind,
  ArchNodeType as ComponentNodeType,
  ArchNodeVariant,
} from "../../nodes/arch-node-data";
import {
  isZoneNode,
  KIND_LABEL,
  OWNER_LABEL,
  type ZoneData,
  type ZoneKind,
  type ZoneOwner,
  type ZONE_NODE_TYPE,
} from "../../nodes/zone-data";
import type {
  DataFlowEdgeData,
  FlowDirection,
  FlowKind,
  FlowLineStyle,
  FlowSecure,
  FLOW_EDGE_TYPE_KEY,
} from "../../edges/data-flow-edge-data";
import { archNodeTypes } from "../../nodes/node-types";
import { archNodeAriaLabel } from "../../nodes/service-node";
import { archEdgeTypes } from "../../edges/edge-types";
import { edgeAriaLabel, edgeMarkers } from "../../edges/edge-style";
import {
  ARCH_DEFINITIONS,
  NODE_TYPE_KEY,
  type FLOW_TYPE_KEY,
  type ZONE_TYPE_KEY,
} from "./arch-definitions";
import type { LegendMode } from "../../chrome/build-legend";
import type {
  ArchCompileView,
  CompiledFlowData,
  CompiledNodeData,
  CompiledZoneData,
} from "./compile-arch";

// ── Parity (plan §11 / DG-09 addition 18) ─────────────────────────────────────────────
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export type VocabularyParity = [
  Assert<Equals<DialectZoneKind, ZoneKind>>,
  Assert<Equals<DialectZoneOwner, ZoneOwner>>,
  Assert<Equals<DialectFlowKind, FlowKind>>,
  Assert<Equals<FlowStyle, FlowLineStyle>>,
  Assert<Equals<DialectFlowSecure, FlowSecure>>,
  Assert<Equals<DialectFlowDirection, FlowDirection>>,
  Assert<Equals<DialectNodeType, ArchNodeKind>>,
  Assert<Equals<NodeStyle, ArchNodeVariant>>,
  Assert<Equals<Direction, NonNullable<ZoneData["direction"]>>>,
  Assert<Tone extends FlowToneInput ? true : false>,
  Assert<Equals<(typeof NODE_TYPE_KEY)[keyof typeof NODE_TYPE_KEY], ComponentNodeType>>,
  Assert<Equals<typeof ZONE_TYPE_KEY, typeof ZONE_NODE_TYPE>>,
  Assert<Equals<typeof FLOW_TYPE_KEY, typeof FLOW_EDGE_TYPE_KEY>>,
  Assert<CompiledNodeData extends ArchNodeData ? true : false>,
  Assert<CompiledZoneData extends ZoneData ? true : false>,
  Assert<CompiledFlowData extends DataFlowEdgeData ? true : false>,
  Assert<Equals<ArchCompileView["legend"], LegendMode>>,
];

/** `arch/<kind>` → the kind, for every type that draws a mark (all but `arch/note`). */
const MARKED_KIND = new Map<string, ArchMarkedKind>(
  (Object.entries(NODE_TYPE_KEY) as [ArchNodeKind, string][])
    .filter((entry): entry is [ArchMarkedKind, string] => entry[0] !== "note")
    .map(([kind, type]) => [type, kind]),
);

export interface ArchRegistry {
  nodeTypes: typeof archNodeTypes;
  edgeTypes: typeof archEdgeTypes;
  /** The pure half, for `validateFlowSpec` / `toReactFlow`. */
  definitions: FlowSpecDefinitions;
  /**
   * Arch-only finishing that needs component-side helpers: a node's accessible name
   * ("<title>, <kind>", `archNodeAriaLabel` — wave-1 review m1: CanvasShell names a node
   * from `data.title` alone), DG-07's markers (`edgeMarkers`, never the edge object's
   * `animated`) and an edge's accessible name (`edgeAriaLabel`, from the end nodes'
   * titles). Those helpers live in React modules, so they cannot run inside the core.
   */
  decorate(graph: ReactFlowGraph): ReactFlowGraph;
}

export function createArchRegistry(): ArchRegistry {
  return {
    nodeTypes: archNodeTypes,
    edgeTypes: archEdgeTypes,
    definitions: ARCH_DEFINITIONS,
    decorate({ nodes, edges }) {
      const title = new Map(
        nodes.map((n) => [n.id, typeof n.data.title === "string" ? n.data.title : n.id]),
      );
      return {
        nodes: nodes.map((node) => {
          // Wave-2 review m3: a zone is named "<title>, <kind>, <owner>" — its aria-label
          // overrides the header's sr-only kind and owner spans, so it must carry them.
          if (isZoneNode(node)) {
            const { kind, owner } = node.data;
            const name = title.get(node.id) ?? node.id;
            return { ...node, ariaLabel: `${name}, ${KIND_LABEL[kind]}, ${OWNER_LABEL[owner]}` };
          }
          const kind = node.type ? MARKED_KIND.get(node.type) : undefined;
          return kind
            ? { ...node, ariaLabel: archNodeAriaLabel(kind, title.get(node.id) ?? node.id) }
            : node;
        }),
        edges: edges.map((edge) => {
          const data = (edge.data ?? {}) as DataFlowEdgeData;
          return {
            ...edge,
            ...edgeMarkers(data.kind, data.direction),
            ariaLabel: edgeAriaLabel(
              title.get(edge.source) ?? edge.source,
              title.get(edge.target) ?? edge.target,
              data,
            ),
          };
        }),
      };
    },
  };
}
