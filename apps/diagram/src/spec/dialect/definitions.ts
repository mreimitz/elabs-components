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
  NODE_STYLES,
  NODE_TYPES,
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
  description: "Style classes from styles:.",
});

export interface RootInput {
  diagram: "0" | 0;
  title?: string;
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
}

export const ROOT_DEF = defineComponent<RootInput>()({
  id: "arch-diagram",
  version: 0,
  label: "Diagram",
  description: "brand-ui architecture diagram, dialect v0.",
  groups: [],
  fields: {
    diagram: field.enum({
      values: ["0", 0],
      required: true,
      description: 'Dialect version: "0".',
    }),
    title: field.string(),
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
  },
  codeOnly: [],
  targets: [],
});

export interface ZoneInput extends HeaderGroupProps {
  id: string;
  kind?: ZoneKind;
  owner?: ZoneOwner;
  provider?: string;
  icon?: string;
  class?: readonly string[];
  collapsed?: boolean;
  direction?: Direction;
  parent?: string;
  position?: Point;
  children?: readonly Record<string, unknown>[];
}

export const ZONE_DEF = defineComponent<ZoneInput>()({
  id: "arch-zone",
  version: 0,
  label: "Zone",
  groups: [headerGroup],
  fields: {
    id: field.string({ required: true, min: 1 }),
    kind: field.enum({ values: ZONE_KINDS, default: "generic" }),
    owner: field.enum({ values: ZONE_OWNERS }),
    provider: field.string({
      description: "Vendor key, e.g. aws, azure, qlik.",
    }),
    icon: field.string({ description: "Icon name vendor/name." }),
    class: CLASS_LIST,
    collapsed: field.boolean({ default: false }),
    direction: field.enum({ values: DIRECTIONS }),
    parent: field.string({
      description: "Parent zone id (alternative to nesting).",
    }),
    position: POSITION,
    children: field.array({ of: OPEN_ENTRY }),
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
}

export const NODE_DEF = defineComponent<NodeInput>()({
  id: "arch-node",
  version: 0,
  label: "Node",
  groups: [headerGroup],
  fields: {
    id: field.string({ required: true, min: 1 }),
    type: field.enum({ values: NODE_TYPES, default: "service" }),
    variant: field.enum({ values: NODE_STYLES }),
    icon: field.string({ description: "Icon name vendor/name." }),
    badges: field.array({ of: field.string() }),
    class: CLASS_LIST,
    tone: field.enum({ values: TONES }),
    href: field.string(),
    text: field.string({ description: "Body text of a note node." }),
    parent: field.string({
      description: "Parent zone id (alternative to nesting).",
    }),
    position: POSITION,
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
    label: field.string(),
    kind: field.enum({ values: FLOW_KINDS, default: "data" }),
    style: field.enum({ values: FLOW_STYLES }),
    animated: field.boolean({ default: false }),
    secure: field.enum({ values: FLOW_SECURE }),
    protocol: field.string({
      description: "Mono badge, e.g. HTTPS 443, JDBC, Kafka.",
    }),
    schedule: field.string({
      description: "e.g. real-time, hourly, nightly batch.",
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
