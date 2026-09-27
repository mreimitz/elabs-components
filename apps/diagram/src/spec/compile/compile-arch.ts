/**
 * `compileArch(ast)` — dialect AST (DG-09) → FlowSpec v1 (plan D1). Total: never throws, and
 * silently skips what the dialect stage already reported (unknown endpoints, unknown or
 * non-zone parents, unknown note targets), so one mistake is reported once. React-free.
 */
import type {
  ArchDiagram,
  ArchStyleSpec,
  ArchZoneSpec,
  Direction,
  FlowDirection,
  FlowKind,
  FlowSecure,
  FlowStyle,
  LegendPart,
  NodeStyle,
  Tone,
  ZoneKind,
  ZoneOwner,
} from "../dialect";
import {
  FLOW_SPEC_VERSION,
  type FlowSpec,
  type FlowSpecEdge,
  type FlowSpecNode,
} from "../flow-spec/types";
import { FLOW_TYPE_KEY, NODE_TYPE_KEY, ZONE_TYPE_KEY } from "./arch-definitions";

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
};

export type CompiledZoneData = {
  title: string;
  subtitle?: string;
  kind: ZoneKind;
  owner: ZoneOwner;
  provider?: string;
  icon?: string;
  direction?: Direction;
  classes?: string[];
};

export type CompiledFlowData = {
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
};

export interface ArchCompileView {
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

export function compileArch(ast: ArchDiagram): ArchCompileResult {
  const manual = ast.layout === "manual";
  const taken = new Set<string>();
  const zones = firstById(ast.zones, taken);
  const archNodes = firstById(ast.nodes, taken);
  const zoneIds = new Set(zones.map((z) => z.id));
  const nodeIds = new Set(archNodes.map((n) => n.id));
  const onCycle = zonesOnCycle(zones);
  const parentOf = new Map<string, string>();
  const positionOf = new Map<string, { x: number; y: number }>();
  const origin: Record<string, string> = {};
  const nodes: FlowSpecNode[] = [];
  const add = (node: FlowSpecNode, from: string) => {
    origin[`nodes[${nodes.length}]`] = from;
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
      title: zone.title,
      subtitle: zone.subtitle,
      kind: zone.kind,
      owner: ownerOf.get(zone.id) ?? DEFAULT_ZONE_OWNER,
      provider: zone.provider,
      icon: zone.icon,
      direction: zone.direction,
      classes: zone.class ? [...zone.class] : undefined,
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

  // Nodes — variant from `nodeStyle`; tone and badges merged from `styles`.
  for (const node of archNodes) {
    const styled = applyStyles(node.class, ast.styles);
    const badges = [...new Set([...(node.badges ?? []), ...styled.badges])];
    const data: CompiledNodeData = compact({
      title: node.title,
      subtitle: node.subtitle,
      icon: node.icon,
      badges: badges.length > 0 ? badges : undefined,
      variant: node.type === "note" ? undefined : (node.variant ?? ast.nodeStyle),
      tone: node.tone ?? styled.tone,
      description: node.description,
      href: node.href,
      classes: node.class ? [...node.class] : undefined,
      text: node.text,
    });
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
  ast.notes.forEach((note, index) => {
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
  for (const flow of ast.flows) {
    if (!endpoints.has(flow.from) || !endpoints.has(flow.to)) continue;
    const key = `${flow.from}->${flow.to}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    // A flow's `class:` is passed through only: DG-07's edge data has no tone or badge.
    const data: CompiledFlowData = compact({
      label: flow.label,
      kind: flow.kind,
      style: flow.style,
      animated: flow.animated,
      secure: flow.secure,
      direction: flow.direction,
      step: flow.step,
      protocol: flow.protocol,
      schedule: flow.schedule,
      floating: zoneIds.has(flow.from) || zoneIds.has(flow.to) ? true : undefined,
      classes: flow.class ? [...flow.class] : undefined,
    });
    origin[`edges[${edges.length}]`] = flow.path;
    edges.push({
      id: count === 1 ? key : `${key}#${count}`,
      source: flow.from,
      target: flow.to,
      type: FLOW_TYPE_KEY,
      data,
    });
  }

  const spec: FlowSpec = {
    flow: FLOW_SPEC_VERSION,
    ...(ast.title !== undefined ? { title: ast.title } : {}),
    layout: { engine: manual ? "none" : "elk", direction: ast.direction },
    nodes,
    edges,
  };
  return {
    spec,
    view: compact({
      collapsed,
      noteAnchors,
      legend: typeof ast.legend === "string" ? ast.legend : [...ast.legend],
      theme: ast.theme,
    }),
    origin,
  };
}
