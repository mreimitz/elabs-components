/** Pure projection of referenced diagrams into bounded, read-only instance contents. */
import type { ArchDiagram, ArchFlowSpec, ArchNodeSpec, ArchZoneSpec } from "../dialect/types";
import { refFileOf } from "../dialect/ids";
import { issue, type ArchIssue } from "../dialect/issues";
import { MAX_COMPONENT_DEPTH, type ComponentTable } from "./resolver";

/** Includes imported zones, nodes and flows; authored root entries do not consume this budget. */
export const MAX_INLINE_ELEMENTS = 1000;
export interface InnerSource {
  component: string;
  /** The id, or stable flow key, in the referenced source file. */
  id: string;
}
export interface ExpandedAst {
  ast: ArchDiagram;
  inner: ReadonlyMap<string, InnerSource>;
  instanceZones: ReadonlySet<string>;
  /** Expanded zone id → its reference metadata. */
  instances: ReadonlyMap<string, { component: string; count: number }>;
  issues: readonly ArchIssue[];
}

/** Expansion is additive: the override can reveal an instance without modifying its source. */
export function expandInstances(
  ast: ArchDiagram,
  table: ComponentTable,
  expand?: ReadonlySet<string>,
  collapse?: ReadonlySet<string>,
): ExpandedAst {
  const inner = new Map<string, InnerSource>();
  const instances = new Map<string, { component: string; count: number }>();
  const issues: ArchIssue[] = [];
  const zones: ArchZoneSpec[] = [...ast.zones];
  const nodes: ArchNodeSpec[] = [];
  const flows: ArchFlowSpec[] = [...ast.flows];
  const styles = { ...ast.styles };
  const flowSources = new Map<ArchFlowSpec, InnerSource>();
  let remaining = MAX_INLINE_ELEMENTS;

  function visit(node: ArchNodeSpec, chain: readonly string[], anchor: string) {
    const file = node.ref && refFileOf(node.ref);
    const entry = file ? table.get(file) : undefined;
    if (
      file &&
      ast.layout === "manual" &&
      !collapse?.has(node.id) &&
      (node.expand === true || expand?.has(node.id))
    ) {
      issues.push(
        issue(
          "expand-ignored",
          `${anchor}.expand`,
          'This diagram is drawn collapsed because the diagram around it is arranged by hand ("layout: manual").',
        ),
      );
    }
    if (
      ast.layout === "manual" ||
      collapse?.has(node.id) ||
      !(node.expand === true || expand?.has(node.id)) ||
      entry?.status !== "ok"
    ) {
      nodes.push(node);
      return;
    }
    // Reserve a whole child diagram before importing any of it. Nested references can remain
    // collapsed, but a budget boundary never truncates a diagram's own nodes or flows.
    const child = entry.ast;
    const cost = child.zones.length + child.nodes.length + child.flows.length;
    if (chain.length >= MAX_COMPONENT_DEPTH || chain.includes(entry.path) || cost > remaining) {
      nodes.push(node);
      issues.push(
        issue(
          "expand-limit",
          `${anchor}.expand`,
          `“${node.id}” stays collapsed: inline expansion is limited to ${MAX_COMPONENT_DEPTH} reference levels and ${MAX_INLINE_ELEMENTS} imported nodes, zones and flows.`,
        ),
      );
      return;
    }
    remaining -= cost;
    instances.set(node.id, { component: entry.path, count: entry.count });
    zones.push({
      path: node.path,
      id: node.id,
      parent: node.parent,
      kind: "generic",
      collapsed: false,
      title: node.unwritten?.includes("title") ? entry.title : node.title,
      subtitle: node.subtitle,
      description: node.description ?? entry.description,
      icon: node.unwritten?.includes("icon") ? entry.icon : node.icon,
      docs: node.docs,
      status: node.status,
      direction: child.direction,
    });
    const prefix = (id: string) => `${node.id}.${id}`;
    const classes = (names: readonly string[] | undefined) => names?.map(prefix);
    for (const [name, style] of Object.entries(child.styles)) styles[prefix(name)] = { ...style };
    for (const zone of child.zones) {
      const copy = {
        ...zone,
        id: prefix(zone.id),
        parent: zone.parent ? prefix(zone.parent) : node.id,
        position: undefined,
        class: classes(zone.class),
      };
      inner.set(copy.id, { component: entry.path, id: zone.id });
      zones.push(copy);
    }
    const counts = new Map<string, number>();
    for (const flow of child.flows) {
      const key = `${flow.from}->${flow.to}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      const copy = {
        ...flow,
        from: prefix(flow.from),
        to: prefix(flow.to),
        class: classes(flow.class),
      };
      flowSources.set(copy, { component: entry.path, id: count === 1 ? key : `${key}#${count}` });
      flows.push(copy);
    }
    for (const childNode of child.nodes) {
      const copy = {
        ...childNode,
        id: prefix(childNode.id),
        parent: childNode.parent ? prefix(childNode.parent) : node.id,
        position: undefined,
        class: classes(childNode.class),
        variant: childNode.variant ?? child.nodeStyle,
      };
      inner.set(copy.id, { component: entry.path, id: childNode.id });
      visit(copy, [...chain, entry.path], anchor);
    }
  }
  for (const node of ast.nodes) visit(node, [], node.path);
  const counts = new Map<string, number>();
  for (const flow of flows) {
    const key = `${flow.from}->${flow.to}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    const source = flowSources.get(flow);
    if (source) inner.set(count === 1 ? key : `${key}#${count}`, source);
  }
  return {
    ast: { ...ast, zones, nodes, flows, styles },
    inner,
    instanceZones: new Set(instances.keys()),
    instances,
    issues,
  };
}
