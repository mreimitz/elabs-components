/**
 * filter-tree.ts — the framework-free hierarchy model behind the `filter` tile.
 *
 * Two hierarchy shapes, the same two the hierarchical filter extension supports:
 * - **levels**: 2–6 fields, left to right, each `rows` record one leaf path
 *   (Country → Region → City).
 * - **parent-child**: a self-referential table (`parentField` → `childField`, optional
 *   `labelField`) — an org chart, a bill of materials.
 *
 * Pure functions over plain data; the tile keeps the expanded set and the search query and
 * asks this module which nodes to show.
 */
import type { SelectionValue } from "../core/selection";

/** One level of a multi-level hierarchy. */
export interface FilterTileLevel {
  /** The data field this level selects on. */
  field: string;
  /** Shown in the header when several levels exist; defaults to `field`. */
  label?: string;
}

/** A parent-child hierarchy read from `rows`. Selections write to `childField`. */
export interface FilterTileParentChild {
  parentField: string;
  childField: string;
  /** The field whose value names the node; defaults to `childField`. */
  labelField?: string;
}

/** One node of the built tree. */
export interface FilterTreeNode {
  /** Stable id: the node's path, `field=value` segments joined by `/`. */
  id: string;
  /** The field a click on this node selects in. */
  field: string;
  value: SelectionValue;
  label: string;
  /** Leaf rows under this node (levels), or `rows[i].count` summed when present. */
  count: number;
  depth: number;
  children: FilterTreeNode[];
}

type Row = Readonly<Record<string, SelectionValue | null | undefined>>;

function isValue(value: unknown): value is SelectionValue {
  return (typeof value === "string" && value !== "") || typeof value === "number";
}

function rowCount(row: Row): number {
  const count = row.count;
  return typeof count === "number" && Number.isFinite(count) ? count : 1;
}

/** Build a tree from `levels` (2–6 fields) over `rows`, one record per leaf path. */
export function buildLevelTree(
  levels: readonly FilterTileLevel[],
  rows: readonly Row[],
): FilterTreeNode[] {
  const roots: FilterTreeNode[] = [];
  const index = new Map<string, FilterTreeNode>();
  for (const row of rows) {
    let siblings = roots;
    let path = "";
    let missing = false;
    for (let depth = 0; depth < levels.length; depth++) {
      const level = levels[depth];
      if (!level) break;
      const value = row[level.field];
      if (!isValue(value)) {
        missing = true;
        break;
      }
      path = path ? `${path}/${level.field}=${String(value)}` : `${level.field}=${String(value)}`;
      let node = index.get(path);
      if (!node) {
        node = {
          id: path,
          field: level.field,
          value,
          label: String(value),
          count: 0,
          depth,
          children: [],
        };
        index.set(path, node);
        siblings.push(node);
      }
      node.count += rowCount(row);
      siblings = node.children;
    }
    void missing;
  }
  return roots;
}

/** Build a tree from a parent-child table; roots are rows whose parent is empty or unknown. */
export function buildParentChildTree(
  spec: FilterTileParentChild,
  rows: readonly Row[],
): FilterTreeNode[] {
  const labelField = spec.labelField ?? spec.childField;
  const byId = new Map<string, FilterTreeNode>();
  const parentOf = new Map<string, SelectionValue | null>();
  for (const row of rows) {
    const child = row[spec.childField];
    if (!isValue(child)) continue;
    const key = String(child);
    if (byId.has(key)) continue;
    const label = row[labelField];
    byId.set(key, {
      id: `${spec.childField}=${key}`,
      field: spec.childField,
      value: child,
      label: isValue(label) ? String(label) : key,
      count: rowCount(row),
      depth: 0,
      children: [],
    });
    const parent = row[spec.parentField];
    parentOf.set(key, isValue(parent) ? parent : null);
  }
  const roots: FilterTreeNode[] = [];
  for (const [key, node] of byId) {
    const parent = parentOf.get(key);
    const parentNode =
      parent === null || parent === undefined ? undefined : byId.get(String(parent));
    if (parentNode && parentNode !== node) parentNode.children.push(node);
    else roots.push(node);
  }
  // Depths and rolled-up counts, guarding against cycles.
  const visit = (node: FilterTreeNode, depth: number, seen: Set<string>): number => {
    node.depth = depth;
    if (seen.has(node.id)) {
      node.children = [];
      return node.count;
    }
    seen.add(node.id);
    let total = node.count;
    for (const child of node.children) total += visit(child, depth + 1, seen);
    seen.delete(node.id);
    node.count = total;
    return total;
  };
  for (const root of roots) visit(root, 0, new Set());
  return roots;
}

/** Every node, depth-first. */
export function flattenTree(nodes: readonly FilterTreeNode[]): FilterTreeNode[] {
  const out: FilterTreeNode[] = [];
  const walk = (list: readonly FilterTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Ids of every node at `depth < level` (`-1` = every expandable node, `0` = none). */
export function expandedToLevel(nodes: readonly FilterTreeNode[], level: number): string[] {
  const out: string[] = [];
  for (const node of flattenTree(nodes)) {
    if (node.children.length === 0) continue;
    if (level < 0 || node.depth < level) out.push(node.id);
  }
  return out;
}

/** The tree pruned to nodes whose label matches `query` and their ancestors. */
export function filterTree(nodes: readonly FilterTreeNode[], query: string): FilterTreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...nodes];
  const prune = (list: readonly FilterTreeNode[]): FilterTreeNode[] =>
    list.flatMap((node) => {
      const children = prune(node.children);
      const matches = node.label.toLowerCase().includes(needle);
      if (!matches && children.length === 0) return [];
      return [{ ...node, children: matches ? node.children : children }];
    });
  return prune(nodes);
}

/** Descendants of `node`, depth-first (the node itself excluded). */
export function descendantsOf(node: FilterTreeNode): FilterTreeNode[] {
  return flattenTree(node.children);
}
