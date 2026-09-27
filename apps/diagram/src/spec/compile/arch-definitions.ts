/**
 * The pure half of the arch registry (review §4.2): one FlowSpec definition per `arch/*`
 * type. Ports mirror the components' `FlowPort`s — `ArchPorts` (src/nodes/service-node.tsx)
 * on service/datastore/queue/external, side ports only on actor (actor-node.tsx) and zone
 * (zone-node.tsx), none on note (note-node.tsx). React-free; `registry.ts` binds components.
 */
import type { ArchNodeType } from "../dialect";
import type {
  FlowFieldDefinition,
  FlowPortDefinition,
  FlowSpecDefinition,
  FlowSpecDefinitions,
} from "../flow-spec/types";

/** Dialect node type → React Flow type key. `registry.ts` asserts these equal `ARCH_NODE_TYPE`. */
export const NODE_TYPE_KEY = {
  service: "arch/service",
  actor: "arch/actor",
  datastore: "arch/datastore",
  queue: "arch/queue",
  external: "arch/external",
  note: "arch/note",
} as const satisfies Record<ArchNodeType, string>;

export const ZONE_TYPE_KEY = "arch/zone";
export const FLOW_TYPE_KEY = "arch/flow";
/** DG-26 — `registry.ts` asserts this equals ARCH_COMPOSITE_TYPE (src/nodes/arch-node-data.ts). */
export const COMPOSITE_TYPE_KEY = "arch/composite";

const SIDE_PORTS = {
  in: { direction: "input", side: "left" },
  out: { direction: "output", side: "right" },
} as const satisfies Record<string, FlowPortDefinition>;

const ALL_PORTS = {
  ...SIDE_PORTS,
  top: { direction: "input", side: "top" },
  bottom: { direction: "output", side: "bottom" },
} as const satisfies Record<string, FlowPortDefinition>;

const NODE_FIELDS = {
  title: { kind: "string", required: true },
  subtitle: { kind: "string" },
  icon: { kind: "string" },
  badges: { kind: "string[]" },
  variant: { kind: "string" },
  tone: { kind: "string" },
  description: { kind: "string" },
  href: { kind: "string" },
  classes: { kind: "string[]" },
  text: { kind: "string" },
  docs: { kind: "string" }, // DG-26
  status: { kind: "string" }, // DG-26
  catalogEntry: { kind: "string" }, // DG-26 (1b)
} as const satisfies Record<string, FlowFieldDefinition>;

const ZONE_FIELDS = {
  title: { kind: "string", required: true },
  subtitle: { kind: "string" },
  kind: { kind: "string", required: true },
  owner: { kind: "string", required: true },
  provider: { kind: "string" },
  icon: { kind: "string" },
  direction: { kind: "string" },
  classes: { kind: "string[]" },
  docs: { kind: "string" }, // DG-26
  status: { kind: "string" }, // DG-26
} as const satisfies Record<string, FlowFieldDefinition>;

const FLOW_FIELDS = {
  label: { kind: "string" },
  kind: { kind: "string" },
  style: { kind: "string" },
  animated: { kind: "boolean" },
  secure: { kind: "string" },
  direction: { kind: "string" },
  step: { kind: "number" },
  protocol: { kind: "string" },
  schedule: { kind: "string" },
  floating: { kind: "boolean" },
  classes: { kind: "string[]" },
  innerSource: { kind: "string" }, // DG-26
  innerTarget: { kind: "string" }, // DG-26
} as const satisfies Record<string, FlowFieldDefinition>;

// DG-26 — a collapsed diagram reference: the node's own fields plus what the reference adds.
const COMPOSITE_FIELDS = {
  ...NODE_FIELDS,
  component: { kind: "string", required: true },
  ports: { kind: "string[]" },
  count: { kind: "number" },
  broken: { kind: "boolean" },
  pending: { kind: "boolean" },
} as const satisfies Record<string, FlowFieldDefinition>;

const node = (
  type: ArchNodeType,
  label: string,
  targets: Record<string, FlowPortDefinition>,
): FlowSpecDefinition => ({
  id: NODE_TYPE_KEY[type],
  kind: "node",
  label,
  fields: NODE_FIELDS,
  targets,
});

export const ARCH_DEFINITION_LIST: readonly FlowSpecDefinition[] = [
  node("service", "Service", ALL_PORTS),
  node("actor", "Actor", SIDE_PORTS),
  node("datastore", "Data store", ALL_PORTS),
  node("queue", "Queue", ALL_PORTS),
  node("external", "External system", ALL_PORTS),
  node("note", "Note", {}),
  {
    id: ZONE_TYPE_KEY,
    kind: "node",
    label: "Zone",
    fields: ZONE_FIELDS,
    targets: SIDE_PORTS,
    capabilities: { container: true },
  },
  { id: FLOW_TYPE_KEY, kind: "edge", label: "Flow", fields: FLOW_FIELDS },
  // DG-26 — interim renderer ServiceNode (node-types.ts); DG-27 draws it for real.
  {
    id: COMPOSITE_TYPE_KEY,
    kind: "node",
    label: "Diagram reference", // review round 0 F5/F7 — never "Component" (Ruling 9)
    fields: COMPOSITE_FIELDS,
    targets: ALL_PORTS,
  },
];

/** Later entries win (review §4.2). */
export const ARCH_DEFINITIONS: FlowSpecDefinitions = new Map(
  ARCH_DEFINITION_LIST.map((def) => [def.id, def]),
);
