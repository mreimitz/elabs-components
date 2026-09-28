/**
 * Field definitions of the dialect's entities, on the shared ui definition
 * base. One source for the validator (validateProps) and the JSON Schema
 * (toJsonSchema). React-free.
 */
import {
  defineComponent,
  field,
  headerGroup,
  statusGroup,
  type HeaderGroupProps,
} from "@elabs-ai/components-ui/definition";
import {
  DIRECTIONS,
  FLOW_DIRECTIONS,
  FLOW_KINDS,
  FLOW_SECURE,
  FLOW_STYLES,
  LAYOUT_MODES,
  LEGEND_MODES,
  LEGEND_PARTS,
  NODE_STATUS,
  NODE_STYLES,
  NODE_TYPES,
  VISUAL_ROLES,
  type VisualRole,
  type ArchVisualSpec,
  ZONE_KINDS,
  ZONE_OWNERS,
  type ArchNodeType,
  type Direction,
  type FlowDirection,
  type FlowKind,
  type FlowSecure,
  type FlowStyle,
  type LayoutMode,
  type LegendPart,
  type NodeStatus,
  type NodeStyle,
  type Point,
  type Tone,
  type ZoneKind,
  type ZoneOwner,
} from "./types";

const TONES = statusGroup.fields.status.values;

// P4: library gap — no recursive/$ref field kind; children are checked entry by entry.
const OPEN_ENTRY = field.object({ fields: {}, open: true });
const POSITION = field.object({
  fields: {
    x: field.number({ required: true }),
    y: field.number({ required: true }),
  },
  description: "Top-left position; only under layout: manual.",
});
const CLASS_LIST = field.array({
  of: field.string({ min: 1 }),
  description: "Names of style classes defined in the diagram’s styles section.",
});

// DG-26 — v1 keys (maintainer ruling 2026-09-27: nodes are reference-first). No `tier` on
// DOCS/STATUS/EXPAND: the inspector shows them under Advanced (form-spec.ts:89). REF is
// essential: it is what the node is.
const DOCS = field.string({
  description: "Link to the product's documentation (https://…).",
});
const STATUS = field.enum({
  values: NODE_STATUS,
  description: "Run state: ok, degraded, down or planned. Shown on the details card (DG-25).",
});
const REF = field.string({
  min: 1,
  tier: "essential",
  description:
    "What this node is: catalog/<pack>/<entry> for a catalog item (catalog/aws/rds), or ws/<folder>/<file name> for another diagram. Keys written beside it override what it supplies.",
});
const EXPAND = field.boolean({
  default: false,
  description:
    "Only when ref names a diagram: false draws it as one node, true draws its content inline as a zone.",
});
const COMPONENT = field.object({
  fields: {
    icon: field.string({
      description: "Icon (vendor/name) of this diagram when another diagram references it.",
    }),
    description: field.string({
      description: "One sentence about this diagram (Home, the collapsed reference).",
    }),
    // Carried, not checked in R1: the point shape and protection are R2's (success-plan :69).
    extensionPoints: field.array({ of: OPEN_ENTRY }),
  },
  description: "Describes this diagram as a reusable part (it usually lives under components/).",
});
// end DG-26

const STORY = field.object({
  fields: {
    autoplay: field.boolean({
      description:
        "Reserved preference. Start playback with Play; stories never start automatically.",
    }),
    steps: field.array({
      required: true,
      max: 100,
      of: field.object({
        fields: {
          title: field.string({ required: true, min: 1 }),
          targets: field.array({
            required: true,
            min: 1,
            max: 100,
            of: field.string({ min: 1 }),
            description:
              "Node, zone, diagram instance, qualified inner id, or an existing flow expression.",
          }),
          text: field.string({
            description: "Markdown narration; raw HTML and images are not rendered.",
          }),
          duration: field.number({ min: 1, max: 300, default: 8, unit: "s" }),
          callouts: field.array({
            max: 20,
            of: field.object({
              fields: {
                at: field.string({
                  required: true,
                  min: 1,
                  description: "Node or zone endpoint id, including qualified inner ids.",
                }),
                text: field.string({ required: true, min: 1 }),
              },
            }),
          }),
        },
      }),
    }),
  },
});

const VISUAL_IDS = field.array({ max: 1000, of: field.string({ min: 1 }) });
const VISUAL = field.object({
  fields: {
    controlPlane: VISUAL_IDS,
    hide: VISUAL_IDS,
    lanes: field.array({
      max: 100,
      of: field.object({
        fields: {
          id: field.string({ required: true, min: 1 }),
          role: field.enum({ required: true, values: VISUAL_ROLES }),
          title: field.string({ required: true, min: 1 }),
          of: VISUAL_IDS,
        },
      }),
    }),
    boxes: field.array({
      max: 1000,
      of: field.object({
        fields: {
          id: field.string({ required: true, min: 1 }),
          lane: field.string({ required: true, min: 1 }),
          title: field.string({ required: true, min: 1 }),
          members: field.array({ required: true, min: 1, max: 1000, of: field.string({ min: 1 }) }),
          processes: field.array({ max: 20, of: field.string({ min: 1 }) }),
          sub: VISUAL_IDS,
          aside: field.boolean(),
        },
      }),
    }),
    flows: field.array({
      max: 2000,
      of: field.object({
        fields: {
          from: field.string({ required: true, min: 1 }),
          to: field.string({ required: true, min: 1 }),
          process: field.string({ min: 1 }),
          label: field.string(),
        },
      }),
    }),
  },
});

export interface RootInput {
  diagram: "1" | 1 | "0" | 0;
  title?: string;
  // DG-68: one-sentence prose under the title, in the title block.
  description?: string;
  direction?: Direction;
  nodeStyle?: NodeStyle;
  theme?: string;
  legend?: (typeof LEGEND_MODES)[number] | readonly LegendPart[];
  layout?: LayoutMode;
  zones?: readonly Record<string, unknown>[];
  nodes?: readonly Record<string, unknown>[];
  flows?: readonly (string | Record<string, unknown>)[];
  styles?: Record<string, unknown>;
  notes?: readonly { at: string; text: string }[];
  // DG-26
  component?: Record<string, unknown>;
  story?: {
    autoplay?: boolean;
    steps: readonly {
      title: string;
      targets: readonly string[];
      text?: string;
      duration?: number;
      callouts?: readonly { at: string; text: string }[];
    }[];
  };
  visual?: ArchVisualSpec;
  // end DG-26
}

export const ROOT_DEF = defineComponent<RootInput>()({
  id: "arch-diagram",
  version: 0,
  label: "Diagram",
  description: "brand-ui architecture diagram, dialect v1.",
  groups: [],
  fields: {
    diagram: field.enum({
      values: ["1", 1, "0", 0],
      required: true,
      description: 'Dialect version: "1". Files that say "0" still open.',
    }),
    title: field.string(),
    // DG-68: the title block's prose line (title-block.tsx); previously accepted nowhere,
    // so a `description:` key was a silent "unknown-prop" warning.
    description: field.string({
      description: "One-sentence summary of the diagram, under the title on the canvas.",
    }),
    direction: field.enum({ values: DIRECTIONS, default: "LR" }),
    nodeStyle: field.enum({ values: NODE_STYLES, default: "icon" }),
    theme: field.string({ description: "Brand theme family for the canvas." }),
    legend: field.union({
      of: [
        field.enum({ values: LEGEND_MODES }),
        field.array({ of: field.enum({ values: LEGEND_PARTS }) }),
      ],
      default: "auto",
    }),
    layout: field.enum({ values: LAYOUT_MODES, default: "auto" }),
    zones: field.array({ of: OPEN_ENTRY }),
    nodes: field.array({ of: OPEN_ENTRY }),
    flows: field.array({
      of: field.union({ of: [field.string(), OPEN_ENTRY] }),
    }),
    // P4: library gap — no map-of field kind; each style is checked with STYLE_DEF.
    styles: OPEN_ENTRY,
    notes: field.array({
      of: field.object({
        fields: {
          at: field.string({ required: true }),
          text: field.string({ required: true }),
        },
      }),
    }),
    // DG-26
    component: COMPONENT,
    story: STORY,
    visual: VISUAL,
    // end DG-26
  },
  codeOnly: [],
  targets: [],
});

export interface ZoneInput extends HeaderGroupProps {
  id: string;
  kind?: ZoneKind;
  owner?: ZoneOwner;
  provider?: string;
  role?: VisualRole;
  icon?: string;
  class?: readonly string[];
  collapsed?: boolean;
  direction?: Direction;
  parent?: string;
  position?: Point;
  children?: readonly Record<string, unknown>[];
  docs?: string;
  status?: NodeStatus;
}

export const ZONE_DEF = defineComponent<ZoneInput>()({
  id: "arch-zone",
  version: 0,
  label: "Zone",
  groups: [headerGroup],
  fields: {
    id: field.string({ required: true, min: 1 }),
    // DG-14: `tier: "essential"` puts a field before the inspector's "Advanced" disclosure.
    kind: field.enum({ values: ZONE_KINDS, default: "generic", tier: "essential" }),
    owner: field.enum({ values: ZONE_OWNERS, tier: "essential" }),
    role: field.enum({
      values: VISUAL_ROLES,
      description: "Visual lane role; inherited by nested zones.",
    }),
    provider: field.string({
      description: "Vendor key, e.g. aws, azure, qlik.",
      tier: "essential",
    }),
    icon: field.string({ description: "Icon name vendor/name.", tier: "essential" }),
    class: CLASS_LIST,
    collapsed: field.boolean({ default: false }),
    direction: field.enum({ values: DIRECTIONS }),
    parent: field.string({
      description: "Parent zone id (alternative to nesting).",
    }),
    position: POSITION,
    children: field.array({ of: OPEN_ENTRY }),
    docs: DOCS, // DG-26
    status: STATUS, // DG-26
  },
  codeOnly: [],
  targets: [],
});

export interface NodeInput extends HeaderGroupProps {
  id: string;
  type?: ArchNodeType;
  variant?: NodeStyle;
  icon?: string;
  badges?: readonly string[];
  class?: readonly string[];
  tone?: Tone;
  href?: string;
  text?: string;
  parent?: string;
  position?: Point;
  docs?: string;
  status?: NodeStatus;
  /** `catalog/<pack>/<entry>` or `ws/<folder>/…/<file name>`, as written. */
  ref?: string;
  /** Only when `ref` is a diagram path: false = one node, true = inline (Part 3). */
  expand?: boolean;
}

export const NODE_DEF = defineComponent<NodeInput>()({
  id: "arch-node",
  version: 0,
  label: "Node",
  groups: [headerGroup],
  fields: {
    id: field.string({ required: true, min: 1 }),
    // DG-26 — there is no separate "reference" entity: a node is a node, and every node
    // key is allowed on it. `ref` names what it is; every written key overrides what it
    // supplies (maintainer ruling 2026-09-27). Placed right after `id`: under reference-first
    // nodes, `ref` is the node's identity, so it leads the essential group in the inspector.
    ref: REF,
    type: field.enum({ values: NODE_TYPES, default: "service", tier: "essential" }),
    variant: field.enum({ values: NODE_STYLES }),
    icon: field.string({ description: "Icon name vendor/name.", tier: "essential" }),
    badges: field.array({ of: field.string() }),
    class: CLASS_LIST,
    tone: field.enum({ values: TONES, tier: "essential" }),
    href: field.string(),
    text: field.string({
      description: "Body text of a note node.",
      tier: "essential",
      appliesWhen: { field: "type", equals: "note" },
    }),
    parent: field.string({
      description: "Parent zone id (alternative to nesting).",
    }),
    position: POSITION,
    expand: EXPAND,
    docs: DOCS,
    status: STATUS,
    // end DG-26
  },
  codeOnly: [],
  targets: [],
});

export interface FlowInput {
  from: string;
  to: string;
  direction?: FlowDirection;
  label?: string;
  kind?: FlowKind;
  style?: FlowStyle;
  animated?: boolean;
  secure?: FlowSecure;
  protocol?: string;
  schedule?: string;
  step?: number;
  class?: readonly string[];
}

export const FLOW_DEF = defineComponent<FlowInput>()({
  id: "arch-flow",
  version: 0,
  label: "Flow",
  groups: [],
  fields: {
    from: field.string({ required: true, min: 1 }),
    to: field.string({ required: true, min: 1 }),
    direction: field.enum({ values: FLOW_DIRECTIONS, default: "forward" }),
    label: field.string({ tier: "essential" }),
    kind: field.enum({ values: FLOW_KINDS, default: "data", tier: "essential" }),
    style: field.enum({ values: FLOW_STYLES }),
    animated: field.boolean({ default: false }),
    secure: field.enum({ values: FLOW_SECURE, tier: "essential" }),
    protocol: field.string({
      description: "Mono badge, e.g. HTTPS 443, JDBC, Kafka.",
      tier: "essential",
    }),
    schedule: field.string({
      description: "e.g. real-time, hourly, nightly batch.",
      appliesWhen: { field: "kind", equals: "data" },
    }),
    step: field.integer({ min: 1 }),
    class: CLASS_LIST,
  },
  codeOnly: [],
  targets: [],
});

export interface StyleInput {
  tone?: Tone;
  badge?: string;
}

export const STYLE_DEF = defineComponent<StyleInput>()({
  id: "arch-style",
  version: 0,
  label: "Style",
  groups: [],
  fields: {
    tone: field.enum({ values: TONES }),
    badge: field.string(),
  },
  codeOnly: [],
  targets: [],
});
