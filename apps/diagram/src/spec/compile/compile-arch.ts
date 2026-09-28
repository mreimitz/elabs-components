/**
 * `compileArch(ast)` — dialect AST (DG-09) → FlowSpec v1 (plan D1). Total: never throws, and
 * silently skips what the dialect stage already reported (unknown endpoints, unknown or
 * non-zone parents, unknown note targets), so one mistake is reported once. React-free.
 */
import { expandInstances, type InnerSource } from "../compose/inline";
import type { ArchIssue } from "../dialect/issues";
import type { ComponentTable } from "../compose/resolver";
import type {
  ArchDiagram,
  ArchNodeSpec,
  ArchNodeType,
  ArchStyleSpec,
  ArchZoneSpec,
  Direction,
  FlowDirection,
  FlowKind,
  FlowSecure,
  FlowStyle,
  LegendPart,
  NodeStatus,
  NodeStyle,
  Tone,
  ZoneKind,
  ZoneOwner,
} from "../dialect";
import { refFileOf, refForm } from "../dialect/ids";
import {
  FLOW_SPEC_VERSION,
  type FlowSpec,
  type FlowSpecEdge,
  type FlowSpecNode,
} from "../flow-spec/types";
import {
  COMPOSITE_TYPE_KEY,
  FLOW_TYPE_KEY,
  NODE_TYPE_KEY,
  ZONE_TYPE_KEY,
} from "./arch-definitions";

/**
 * The owner of a top-level zone without `owner:` (nested zones inherit their parent's).
 * Matches `zoneVariants`' default owner (src/nodes/zone-variants.ts).
 */
export const DEFAULT_ZONE_OWNER: ZoneOwner = "customer";

/** What the compiler writes into `data`. `registry.ts` asserts each is assignable to the component's data type. */
export type CompiledNodeData = {
  title: string;
  subtitle?: string;
  icon?: string;
  badges?: string[];
  variant?: NodeStyle;
  tone?: Tone;
  description?: string;
  href?: string;
  classes?: string[];
  text?: string;
  docs?: string;
  status?: NodeStatus;
  /** The catalog entry name ("aws/glue") once a catalog reference resolved (Part 1b). */
  catalogEntry?: string;
  inner?: true;
};

export type CompiledZoneData = {
  description?: string;
  inner?: true;
  component?: string;
  count?: number;
  title: string;
  subtitle?: string;
  kind: ZoneKind;
  owner: ZoneOwner;
  provider?: string;
  icon?: string;
  direction?: Direction;
  classes?: string[];
  docs?: string;
  status?: NodeStatus;
};

export type CompiledFlowData = {
  inner?: true;
  label?: string;
  kind: FlowKind;
  style?: FlowStyle;
  animated: boolean;
  secure?: FlowSecure;
  direction: FlowDirection;
  step?: number;
  protocol?: string;
  schedule?: string;
  /** Set when either end is a zone: DG-07 floats that end onto the zone border. */
  floating?: true;
  classes?: string[];
  /** DG-26 — set on the end that points inside a collapsed diagram reference (`tenant.qca`). */
  innerSource?: string;
  innerTarget?: string;
};

/** A collapsed diagram reference (DG-27 draws it; DG-25's card reads `component`). */
export type CompiledCompositeData = CompiledNodeData & {
  /** `components/<path>.yaml` (the workspace file), or the `ref:` as written when it is not a valid diagram path. */
  component: string;
  /** Inner ids this file's flows name, first-use order (plan §4.2: "the ports needed by inner-targeted flows"). */
  ports?: string[];
  /** Number of nodes inside the referenced diagram. */
  count?: number;
  /**
   * Explicit node kind used by the collapsed composite renderer. The normalized default
   * service kind needs no override.
   */
  overrideType?: ArchNodeType;
  /** The reference is broken; `subtitle` says why in words (N11). */
  broken?: true;
  /** The referenced file is not loaded yet. */
  pending?: true;
};
/** Broken references always have a written reason, not only a destructive tone. */
export const COMPOSITE_LABELS = {
  badPath: "Not a diagram path: ",
  missing: "Missing: ",
  invalid: "Cannot read: ",
  cycle: "References itself: ",
  "too-deep": "Nested too deep: ",
} as const;

export interface ArchCompileView {
  /** Imported node/zone/flow ids map to their own source diagram, never an editable origin. */
  inner?: Record<string, InnerSource>;
  /**
   * Zones the text marks `collapsed: true`. Never written into `data`: collapse is runtime
   * view state (review §4.4), and flow's `expandGroup` can only undo a `collapseGroup` it
   * snapshotted (DG-06 finding 8). DG-11 applies `collapseGroup` to these after layout.
   */
  collapsed: string[];
  /** Note node id → the node or zone it annotates (`notes[].at`). DG-11 places notes beside it. */
  noteAnchors: Record<string, string>;
  /** `legend:` as a mutable copy — DG-08's `LegendMode` (`src/chrome/build-legend.ts:14`) takes `LegendSection[]`. */
  legend: "auto" | "none" | LegendPart[];
  theme?: string;
}

export interface ArchCompileResult {
  issues: readonly ArchIssue[];
  spec: FlowSpec;
  view: ArchCompileView;
  /** FlowSpec path prefix (`nodes[3]`, `edges[0]`) → dialect path (`zones[0].children[1]`, `flows[2]`), to position flow-spec issues. */
  origin: Record<string, string>;
}

/** Drops keys whose value is `undefined`, so `data` holds only what the text said. */
function compact<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) if (value[key] === undefined) delete value[key];
  return value;
}

/** `class:` → the styles' tone (later class wins) and badges, in class order. */
function applyStyles(
  classes: readonly string[] | undefined,
  styles: Record<string, ArchStyleSpec>,
) {
  let tone: Tone | undefined;
  const badges: string[] = [];
  for (const name of classes ?? []) {
    const style = styles[name];
    if (!style) continue;
    if (style.tone) tone = style.tone;
    if (style.badge) badges.push(style.badge);
  }
  return { tone, badges };
}

/** The first entry per id. DG-09 reports `duplicate-id` on a repeat; the compiler skips it. */
function firstById<T extends { id: string }>(items: readonly T[], taken: Set<string>): T[] {
  const kept: T[] = [];
  for (const item of items) {
    if (taken.has(item.id)) continue;
    taken.add(item.id);
    kept.push(item);
  }
  return kept;
}

/** Zones whose `parent:` chain comes back to themselves (DG-09 reports `parent-cycle`). */
function zonesOnCycle(zones: readonly ArchZoneSpec[]): Set<string> {
  const parentOf = new Map(zones.map((z) => [z.id, z.parent]));
  const onCycle = new Set<string>();
  for (const zone of zones) {
    const seen = new Set<string>();
    for (let id: string | undefined = zone.id; id !== undefined; id = parentOf.get(id)) {
      if (seen.has(id)) {
        if (id === zone.id) onCycle.add(zone.id);
        break;
      }
      seen.add(id);
    }
  }
  return onCycle;
}

/** Zones with every parent before its children (`parent:` may point forward). */
function zonesParentFirst(zones: readonly ArchZoneSpec[]): ArchZoneSpec[] {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const depth = (zone: ArchZoneSpec) => {
    const seen = new Set([zone.id]);
    let d = 0;
    for (let p = zone.parent; p !== undefined && !seen.has(p); p = byId.get(p)?.parent) {
      if (!byId.has(p)) break;
      seen.add(p);
      d += 1;
    }
    return d;
  };
  return zones
    .map((zone, index) => ({ zone, index, depth: depth(zone) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((entry) => entry.zone);
}

export interface ArchCompileOptions {
  /** Additional instance ids to reveal for this compile only. */
  expand?: ReadonlySet<string>;
  /** Viewer overrides take precedence over authored expansion and `expand`. */
  collapse?: ReadonlySet<string>;
}

export function compileArch(
  ast: ArchDiagram,
  components?: ComponentTable,
  options: ArchCompileOptions = {},
): ArchCompileResult {
  const expanded = components
    ? expandInstances(ast, components, options.expand, options.collapse)
    : undefined;
  const src = expanded?.ast ?? ast;
  const manual = src.layout === "manual";
  const taken = new Set<string>();
  const zones = firstById(src.zones, taken);
  const archNodes = firstById(src.nodes, taken);
  const zoneIds = new Set(zones.map((z) => z.id));
  const nodeIds = new Set(archNodes.map((n) => n.id));
  const onCycle = zonesOnCycle(zones);
  const parentOf = new Map<string, string>();
  const positionOf = new Map<string, { x: number; y: number }>();
  const origin: Record<string, string> = {};
  const nodes: FlowSpecNode[] = [];
  const add = (node: FlowSpecNode, from: string) => {
    if (!expanded?.inner.has(node.id)) origin[`nodes[${nodes.length}]`] = from;
    nodes.push(node);
    if (node.parent !== undefined) parentOf.set(node.id, node.parent);
    if (node.position) positionOf.set(node.id, node.position);
  };
  // Unknown, non-zone and cyclic parents are dropped: DG-09 already reported each.
  const validParent = (id: string, parent: string | undefined) =>
    parent !== undefined && zoneIds.has(parent) && !onCycle.has(id) ? parent : undefined;

  // Zones — owner inheritance (plan §11): a nested zone without `owner:` takes its parent's.
  const ownerOf = new Map<string, ZoneOwner>();
  for (const zone of zonesParentFirst(zones)) {
    const parent = validParent(zone.id, zone.parent);
    const owner =
      zone.owner ?? (parent !== undefined ? ownerOf.get(parent) : undefined) ?? DEFAULT_ZONE_OWNER;
    ownerOf.set(zone.id, owner);
  }
  const collapsed: string[] = [];
  for (const zone of zones) {
    const parent = validParent(zone.id, zone.parent);
    const data: CompiledZoneData = compact({
      inner: expanded?.inner.has(zone.id) ? true : undefined,
      ...expanded?.instances.get(zone.id),
      title: zone.title,
      description: zone.description,
      subtitle: zone.subtitle,
      kind: zone.kind,
      owner: ownerOf.get(zone.id) ?? DEFAULT_ZONE_OWNER,
      provider: zone.provider,
      icon: zone.icon,
      direction: zone.direction,
      classes: zone.class ? [...zone.class] : undefined,
      docs: zone.docs,
      status: zone.status,
    });
    if (zone.collapsed) collapsed.push(zone.id);
    add(
      compact({
        id: zone.id,
        type: ZONE_TYPE_KEY,
        data,
        parent,
        position: manual && zone.position ? { ...zone.position } : undefined,
      }),
      zone.path,
    );
  }

  // DG-26 — the data every node carries (was inline in the node loop); a diagram reference starts from it.
  const nodeData = (node: ArchNodeSpec): CompiledNodeData => {
    const styled = applyStyles(node.class, src.styles);
    const badges = [...new Set([...(node.badges ?? []), ...styled.badges])];
    return compact({
      inner: expanded?.inner.has(node.id) ? true : undefined,
      title: node.title,
      subtitle: node.subtitle,
      icon: node.icon,
      badges: badges.length > 0 ? badges : undefined,
      variant: node.type === "note" ? undefined : (node.variant ?? src.nodeStyle),
      tone: node.tone ?? styled.tone,
      description: node.description,
      href: node.href,
      classes: node.class ? [...node.class] : undefined,
      text: node.text,
      docs: node.docs,
      status: node.status,
      catalogEntry: node.catalogEntry, // DG-26
    });
  };
  const isDiagramRef = (node: ArchNodeSpec) =>
    node.ref !== undefined && refForm(node.ref) === "diagram";
  // Collapsed diagram references, and the inner ids this file's flows name (ports, first-use order).
  const compositeIds = new Set(archNodes.filter(isDiagramRef).map((n) => n.id));
  const compositeEnd = (end: string): { id: string; inner: string } | null => {
    for (let dot = end.lastIndexOf("."); dot > 0; dot = end.lastIndexOf(".", dot - 1)) {
      const head = end.slice(0, dot);
      if (compositeIds.has(head)) return { id: head, inner: end.slice(dot + 1) };
    }
    return null;
  };
  const portsOf = new Map<string, string[]>();
  for (const flow of src.flows) {
    for (const end of [flow.from, flow.to]) {
      const found = compositeEnd(end);
      if (!found) continue;
      const ports = portsOf.get(found.id) ?? [];
      if (!ports.includes(found.inner)) portsOf.set(found.id, [...ports, found.inner]);
    }
  }
  // end DG-26

  // Nodes — variant from `nodeStyle`; tone and badges merged from `styles`.
  for (const node of archNodes) {
    // DG-26 — a node whose ref is a diagram compiles to one collapsed composite node.
    if (isDiagramRef(node)) {
      const ref = node.ref as string;
      const file = refFileOf(ref);
      const entry = file ? components?.get(file) : undefined;
      const data: CompiledCompositeData = compact({
        ...nodeData(node),
        component: file ?? ref,
        ports: portsOf.get(node.id),
        overrideType: node.type !== "service" ? node.type : undefined,
        ...(file === undefined
          ? {
              subtitle: `${COMPOSITE_LABELS.badPath}${ref}`,
              tone: "destructive" as const,
              broken: true as const,
            }
          : !entry
            ? { pending: true as const }
            : entry.status === "ok"
              ? {
                  title: node.unwritten?.includes("title") ? entry.title : node.title,
                  icon: node.unwritten?.includes("icon") ? entry.icon : node.icon,
                  description: node.description ?? entry.description,
                  count: entry.count,
                }
              : {
                  subtitle: `${COMPOSITE_LABELS[entry.status]}${ref}`,
                  tone: "destructive" as const,
                  broken: true as const,
                }),
      });
      add(
        compact({
          id: node.id,
          type: COMPOSITE_TYPE_KEY,
          data,
          parent: validParent(node.id, node.parent),
          position: manual && node.position ? { ...node.position } : undefined,
        }),
        node.path,
      );
      continue;
    }
    // end DG-26
    const data: CompiledNodeData = nodeData(node);
    add(
      compact({
        id: node.id,
        type: NODE_TYPE_KEY[node.type],
        data,
        parent: validParent(node.id, node.parent),
        position: manual && node.position ? { ...node.position } : undefined,
      }),
      node.path,
    );
  }

  // Notes — an `arch/note` beside its target, in the target's parent. `note:<n>` cannot
  // collide with a dialect id (the id grammar has no ":", DG-09 ids.ts ID_SOURCE).
  const noteAnchors: Record<string, string> = {};
  src.notes.forEach((note, index) => {
    if (!zoneIds.has(note.at) && !nodeIds.has(note.at)) return;
    const id = `note:${index}`;
    noteAnchors[id] = note.at;
    const anchor = positionOf.get(note.at);
    const data: CompiledNodeData = { title: note.text, text: note.text };
    add(
      compact({
        id,
        type: NODE_TYPE_KEY.note,
        data,
        parent: parentOf.get(note.at),
        // Manual layout needs a position on every node; DG-11 moves the note beside its target.
        position: manual && anchor ? { ...anchor } : undefined,
      }),
      note.path,
    );
  });

  // Flows — id `<from>-><to>` (+ `#n` for repeats): stable while flows are reordered or
  // inserted, and unambiguous (an id never ends in "-" nor starts with ">").
  const seen = new Map<string, number>();
  const edges: FlowSpecEdge[] = [];
  const endpoints = new Set([...zoneIds, ...nodeIds]);
  // DG-26 — an end is an id in this file, or `<node>.<inner>` on a collapsed diagram reference.
  const endOf = (end: string) =>
    endpoints.has(end) ? { id: end, inner: undefined } : compositeEnd(end);
  for (const flow of src.flows) {
    const from = endOf(flow.from);
    const to = endOf(flow.to);
    if (!from || !to || !endpoints.has(from.id) || !endpoints.has(to.id)) continue;
    // inner-flow (validate.ts warns): both ends inside one collapsed reference would draw a loop.
    if (from.id === to.id && (from.inner !== undefined || to.inner !== undefined)) continue;
    // end DG-26
    const key = `${flow.from}->${flow.to}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    const id = count === 1 ? key : `${key}#${count}`;
    const inner = expanded?.inner.has(id) ? true : undefined;
    // A flow's `class:` is passed through only: DG-07's edge data has no tone or badge.
    const data: CompiledFlowData = compact({
      inner,
      label: flow.label,
      kind: flow.kind,
      style: flow.style,
      animated: flow.animated,
      secure: flow.secure,
      direction: flow.direction,
      step: flow.step,
      protocol: flow.protocol,
      schedule: flow.schedule,
      floating: zoneIds.has(from.id) || zoneIds.has(to.id) ? true : undefined,
      classes: flow.class ? [...flow.class] : undefined,
      innerSource: from.inner,
      innerTarget: to.inner,
    });
    if (!inner) origin[`edges[${edges.length}]`] = flow.path;
    edges.push({
      id,
      source: from.id,
      target: to.id,
      type: FLOW_TYPE_KEY,
      data,
    });
  }

  const spec: FlowSpec = {
    flow: FLOW_SPEC_VERSION,
    ...(src.title !== undefined ? { title: src.title } : {}),
    ...(src.description !== undefined ? { description: src.description } : {}), // DG-68
    layout: { engine: manual ? "none" : "elk", direction: src.direction },
    nodes,
    edges,
  };
  return {
    issues: expanded?.issues ?? [],
    spec,
    view: compact({
      inner: expanded?.inner.size ? Object.fromEntries(expanded.inner) : undefined,
      collapsed,
      noteAnchors,
      legend: typeof src.legend === "string" ? src.legend : [...src.legend],
      theme: src.theme,
    }),
    origin,
  };
}
