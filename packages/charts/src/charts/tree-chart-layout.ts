/**
 * The pure, React-free layout engine behind `TreeChart`: stable node identity,
 * the visible (expanded) subset, d3's tidy tree, screen coordinates, label
 * placement, hit boxes and toggle boxes. No measurement, no DOM — every number
 * here is a function of the data, the expanded set and the props, which is
 * what lets `TreeChart` skip `ResizeObserver` for layout and lets this module
 * be unit-tested directly.
 *
 * Kept apart from `tree-chart.tsx` so the component file holds rendering and
 * state only; the public types it lays out (`TreeNode`, `TreeOrientation`,
 * `TreePalette`) are declared there, beside the props that document them.
 */

import {
  hierarchy,
  tree as d3Tree,
  type HierarchyNode,
  type HierarchyPointNode,
} from "d3-hierarchy";
import { linkHorizontal, linkVertical } from "d3-shape";
import { resolvePalette } from "./chart-context";
import { MIN_DATAPOINT_TARGET_SIZE } from "./chart-datapoint-layer";
import { estimateTextWidth } from "./use-text-measurer";
import type { TreeNode, TreeOrientation, TreePalette } from "./tree-chart";

// ── Tunables (internal — not speculative props; a fixed layout is the whole
// point of "never shrink", so these are constants, not knobs) ──────────────
export const DEFAULT_NODE_SIZE = 7;
/** Default box of a custom (`renderNode`) node, in px. */
export const DEFAULT_NODE_BOX_WIDTH = 160;
export const DEFAULT_NODE_BOX_HEIGHT = 72;
const SIBLING_GAP = 22;
const LEVEL_GAP = 132;
const MARGIN_CROSS = 16;
const MARGIN_GROWTH = 96;
export const LABEL_GAP = 8;
/** Approximate px size of the `text-chart-value` rung, for reserving label room in the pure layout. */
const LABEL_FONT_SIZE_ESTIMATE = 13; // the rung is 12px; one px more covers its heavier weight
/** Line box of one `text-chart-value` label — the cross-axis extent of a label's hit box. */
const LABEL_LINE_HEIGHT = 16;
/** Gaps between custom boxes: cross-axis breathing room and the growth-axis link run. */
const BOX_CROSS_GAP = 24;
const BOX_GROWTH_GAP = 72;
/** Outer breathing room around the custom-box canvas. */
const BOX_MARGIN = 16;
/**
 * The expand/collapse pill a custom node carries on its growth-side edge. It
 * is at least the WCAG 2.5.8 target in both directions; a collapsed pill
 * grows to fit its chevron and `(n)` count.
 */
const TOGGLE_SIZE = MIN_DATAPOINT_TARGET_SIZE;
const TOGGLE_ICON = 14;
const TOGGLE_PAD_X = 6;
const TOGGLE_ICON_GAP = 2;
/** Approximate px size of the pill's `text-meta` count. */
const TOGGLE_FONT_SIZE_ESTIMATE = 12;
/** The root belongs to no branch, so `palette: "categorical"` still needs a neutral shade for it. */
const TREE_ROOT_COLOR = "var(--chart-mono-4)";

export interface TreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Stable identity ──────────────────────────────────────────────────────────

/** One source node with its resolved identity and the counts the chart restates. */
export interface ResolvedTreeNode<TData = unknown> {
  /** The caller's `id`, or the sibling-index path (`"0"`, `"0.1"`, `"0.1.2"`). */
  id: string;
  parentId: string | null;
  name: string;
  source: TreeNode<TData>;
  depth: number;
  /** Ancestor names, root first, this node last. */
  path: string[];
  children: ResolvedTreeNode<TData>[];
  /** DIRECT children in the data — the `(n)` a collapsed node shows. */
  childCount: number;
  /** Leaves under this node in the data (`1` for a leaf). */
  descendantLeafCount: number;
  /** Position in a depth-first walk of the FULL data — stable across expand/collapse. */
  preorderIndex: number;
  siblingIndex: number;
  siblingCount: number;
  /** Index of this node's depth-1 ancestor among the root's children. `-1` for the root. */
  branchIndex: number;
}

export interface ResolvedTree<TData = unknown> {
  root: ResolvedTreeNode<TData>;
  byId: ReadonlyMap<string, ResolvedTreeNode<TData>>;
  /** Every node, depth-first. */
  preorder: ResolvedTreeNode<TData>[];
}

/**
 * Resolves every node's stable id. An explicit `id` wins; without one a node
 * is named by its sibling-index path — never by its render index (which
 * shifts on every collapse) and never by its name alone (siblings may share
 * one). Ids must be unique: a repeated explicit id, or a path id that an
 * explicit id already claims, falls back to a suffixed path id, with a
 * dev-only warning for the explicit duplicate.
 */
export function resolveTree<TData>(data: TreeNode<TData>): ResolvedTree<TData> {
  const explicit = new Set<string>();
  const duplicates = new Set<TreeNode<TData>>();
  const collect = (node: TreeNode<TData>) => {
    if (typeof node.id === "string" && node.id.length > 0) {
      if (explicit.has(node.id)) {
        duplicates.add(node);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[TreeChart] duplicate node id "${node.id}" — ids must be unique; ` +
              "this node falls back to its position in the tree.",
          );
        }
      } else {
        explicit.add(node.id);
      }
    }
    for (const child of node.children ?? []) collect(child);
  };
  collect(data);

  const taken = new Set(explicit);
  const byId = new Map<string, ResolvedTreeNode<TData>>();
  const preorder: ResolvedTreeNode<TData>[] = [];

  const visit = (
    node: TreeNode<TData>,
    indexPath: string,
    parent: ResolvedTreeNode<TData> | null,
    siblingIndex: number,
    siblingCount: number,
  ): ResolvedTreeNode<TData> => {
    let id: string;
    if (typeof node.id === "string" && node.id.length > 0 && !duplicates.has(node)) {
      id = node.id;
    } else {
      id = indexPath;
      for (let k = 2; taken.has(id); k++) id = `${indexPath}~${k}`;
      taken.add(id);
    }
    const depth = parent ? parent.depth + 1 : 0;
    const resolved: ResolvedTreeNode<TData> = {
      id,
      parentId: parent?.id ?? null,
      name: node.name,
      source: node,
      depth,
      path: parent ? [...parent.path, node.name] : [node.name],
      children: [],
      childCount: node.children?.length ?? 0,
      descendantLeafCount: 1,
      preorderIndex: preorder.length,
      siblingIndex,
      siblingCount,
      branchIndex: depth === 0 ? -1 : depth === 1 ? siblingIndex : (parent?.branchIndex ?? -1),
    };
    byId.set(id, resolved);
    preorder.push(resolved);
    const children = node.children ?? [];
    resolved.children = children.map((child, i) =>
      visit(child, `${indexPath}.${i}`, resolved, i, children.length),
    );
    if (resolved.children.length > 0) {
      resolved.descendantLeafCount = resolved.children.reduce(
        (sum, child) => sum + child.descendantLeafCount,
        0,
      );
    }
    return resolved;
  };

  const root = visit(data, "0", null, 0, 1);
  return { root, byId, preorder };
}

// ── Layout result ─────────────────────────────────────────────────────────

/** Which side of its dot a default node's label sits on (see {@link labelOffset}). */
export type TreeLabelPlacement = "leaf" | "branch";

export interface TreeLayoutNode<TData = unknown> {
  id: string;
  parentId: string | null;
  name: string;
  /** The drawn label: the name, plus ` (n)` on a collapsed branch. */
  label: string;
  depth: number;
  /** No children in the DATA (a legacy "+k" pill also counts as a leaf). */
  isLeaf: boolean;
  /** The legacy `collapseDepth` "+k" pill of a `collapsible={false}` chart. */
  isPill: boolean;
  /** Leaves the legacy pill stands for; `0` on every real node. */
  collapsedCount: number;
  /** Full ancestor path, root first, this node last. */
  path: string[];
  /** Leaves under this node in the data; `collapsedCount` for a pill. */
  descendantLeafCount: number;
  /** DIRECT children in the data. */
  childCount: number;
  /** Has children in the data (a pill never does). */
  isExpandable: boolean;
  /** Its children are laid out. */
  isExpanded: boolean;
  /** Draws with nothing after it — a data leaf or a collapsed branch. */
  rendersAsLeaf: boolean;
  /** Label side for a default node; custom boxes ignore it. */
  labelPlacement: TreeLabelPlacement;
  siblingIndex: number;
  siblingCount: number;
  /** Depth-first index in the FULL data — stable across expand/collapse. */
  preorderIndex: number;
  x: number;
  y: number;
  color: string;
  /** The pointer / focus box: the dot plus its label, or the custom box. Always ≥ 24×24. */
  hit: TreeRect;
  /** The expand/collapse hit zone of an expandable node; `null` otherwise. */
  toggle: TreeRect | null;
  /** The caller's node; `null` for a legacy pill. */
  source: TreeNode<TData> | null;
}

export interface TreeLayoutLink {
  /** `link:<targetId>` — a node has one parent, so the child names the link. */
  id: string;
  sourceId: string;
  targetId: string;
  /** The TARGET (child) node's depth — what `stagger` reveals by. */
  depth: number;
  d: string;
  /** Drawn endpoints — node centres for dots, box edges for custom nodes. */
  source: [number, number];
  target: [number, number];
}

export interface TreeLayoutResult<TData = unknown> {
  nodes: TreeLayoutNode<TData>[];
  links: TreeLayoutLink[];
  width: number;
  height: number;
  maxDepth: number;
  orientation: TreeOrientation;
  /** The custom-node box, or `null` for default dots. */
  nodeBox: { width: number; height: number } | null;
}

export interface ComputeTreeLayoutOptions {
  orientation: TreeOrientation;
  palette: TreePalette;
  nodeRadius: number;
  /**
   * Legacy static truncation (`collapsible={false}` only): past this depth a
   * branch's children are replaced by one "+k" pill.
   */
  collapseDepth?: number;
  /** Branches whose children are laid out. `undefined` = every branch. */
  expandedIds?: ReadonlySet<string>;
  /** A fixed box per node (custom `renderNode` nodes); omitted = default dots. */
  nodeBox?: { width: number; height: number };
}

// ── Label placement ──────────────────────────────────────────────────────────

export interface LabelOffset {
  dx: number;
  dy: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline: "middle" | "auto" | "hanging";
  /** Degrees to rotate the label about its anchor point (0 = horizontal). */
  rotate: number;
}

/**
 * A leaf's label sits BEFORE the node (the side facing back toward the root —
 * "left" in `"lr"`); a branch's label sits AFTER it (the side facing its own
 * children — "right" in `"lr"`).
 *
 * `"tb"` cannot mirror that: leaves are only `SIBLING_GAP` apart horizontally,
 * so centred horizontal leaf labels overprint each other ("Onboarding" became
 * "Onboa"). A `"tb"` leaf label instead runs vertically DOWN from the leaf,
 * into the bottom margin nothing else occupies; branches keep a centred label
 * under the node (their siblings are a whole subtree apart).
 *
 * A COLLAPSED branch draws as a leaf and takes the leaf placement too: with
 * nothing laid out after it, a neighbour's child can share its row one level
 * on, so the growth side is not free — and its siblings are only
 * `SIBLING_GAP` apart, like leaves.
 */
export function labelOffset(
  orientation: TreeOrientation,
  placement: TreeLabelPlacement,
  nodeRadius: number,
): LabelOffset {
  const gap = nodeRadius + LABEL_GAP;
  if (orientation === "lr") {
    return placement === "leaf"
      ? { dx: -gap, dy: 0, textAnchor: "end", dominantBaseline: "middle", rotate: 0 }
      : { dx: gap, dy: 0, textAnchor: "start", dominantBaseline: "middle", rotate: 0 };
  }
  return placement === "leaf"
    ? { dx: 0, dy: gap, textAnchor: "start", dominantBaseline: "middle", rotate: 90 }
    : { dx: 0, dy: gap, textAnchor: "middle", dominantBaseline: "hanging", rotate: 0 };
}

/** `Platform (3)` — the collapsed-branch label; the count is DIRECT children. */
export function collapsedLabel(name: string, childCount: number): string {
  return `${name} (${childCount})`;
}

function labelWidth(text: string): number {
  return estimateTextWidth(text, LABEL_FONT_SIZE_ESTIMATE);
}

/**
 * The hit box of a default node: a 24×24 square on the dot, grown over the
 * label. Along the growth axis the label's share is clamped to half a level
 * gap, so a parent's forward-running branch label and its child's
 * backward-running leaf label can never claim the same pixels — the visible
 * text is unchanged, only the click target stops at the midpoint. A `"tb"`
 * branch label also runs ACROSS, towards its row neighbours; that share is
 * clamped once the whole row is known (see {@link clampRowHits}).
 */
function dotHitRect(
  x: number,
  y: number,
  label: string,
  placement: TreeLabelPlacement,
  orientation: TreeOrientation,
  nodeRadius: number,
): TreeRect {
  const half = MIN_DATAPOINT_TARGET_SIZE / 2;
  const reach = Math.max(half, LEVEL_GAP / 2 - nodeRadius);
  const run = Math.min(nodeRadius + LABEL_GAP + labelWidth(label), reach);
  let x0 = x - half;
  let x1 = x + half;
  const y0 = y - half;
  let y1 = y + half;
  if (orientation === "lr") {
    if (placement === "leaf") x0 = Math.min(x0, x - run);
    else x1 = Math.max(x1, x + run);
  } else if (placement === "leaf") {
    y1 = Math.max(y1, y + run);
  } else {
    const w = labelWidth(label);
    x0 = Math.min(x0, x - w / 2);
    x1 = Math.max(x1, x + w / 2);
    y1 = Math.max(y1, y + Math.min(nodeRadius + LABEL_GAP + LABEL_LINE_HEIGHT, reach));
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Width of a custom node's collapsed pill: chevron + `(n)`, padded; round when expanded. */
function togglePillWidth(childCount: number, isExpanded: boolean): number {
  if (isExpanded) return TOGGLE_SIZE;
  const text = estimateTextWidth(`(${childCount})`, TOGGLE_FONT_SIZE_ESTIMATE);
  return Math.max(TOGGLE_SIZE, Math.ceil(TOGGLE_PAD_X * 2 + TOGGLE_ICON + TOGGLE_ICON_GAP + text));
}

// ── The engine ───────────────────────────────────────────────────────────────

interface TreeRenderNode<TData> {
  node: ResolvedTreeNode<TData>;
  /** The legacy "+k" pill stands in for `node`'s hidden subtree. */
  pill?: { count: number };
  children?: TreeRenderNode<TData>[];
}

/**
 * The pure, React-free layout engine behind `TreeChart`. Given the raw
 * {@link TreeNode} tree, returns every VISIBLE node's SCREEN position (already
 * orientation-swapped), every link's drawn path, and the content's total
 * pixel size — deliberately independent of any container measurement.
 *
 * Pass `resolved` (from {@link resolveTree}) to reuse one identity pass across
 * several layouts of the same data.
 */
export function computeTreeLayout<TData = unknown>(
  data: TreeNode<TData>,
  options: ComputeTreeLayoutOptions,
  resolved: ResolvedTree<TData> = resolveTree(data),
): TreeLayoutResult<TData> {
  const { orientation, collapseDepth, palette, nodeRadius, expandedIds, nodeBox } = options;

  const prepare = (node: ResolvedTreeNode<TData>): TreeRenderNode<TData> => {
    if (node.children.length === 0) return { node };
    if (collapseDepth != null && node.depth === collapseDepth) {
      return { node, children: [{ node, pill: { count: node.descendantLeafCount } }] };
    }
    if (expandedIds && !expandedIds.has(node.id)) return { node };
    return { node, children: node.children.map(prepare) };
  };

  const root = hierarchy<TreeRenderNode<TData>>(prepare(resolved.root), (d) => d.children);
  const crossStep = nodeBox
    ? (orientation === "lr" ? nodeBox.height : nodeBox.width) + BOX_CROSS_GAP
    : SIBLING_GAP;
  const growthStep = nodeBox
    ? (orientation === "lr" ? nodeBox.width : nodeBox.height) + BOX_GROWTH_GAP
    : LEVEL_GAP;

  /** How a (non-pill) node draws: its open state, label and which side the label takes. */
  const describe = (n: HierarchyNode<TreeRenderNode<TData>>) => {
    const { node } = n.data;
    const isExpandable = node.childCount > 0;
    const isExpanded = isExpandable && Boolean(n.children);
    const rendersAsLeaf = !n.children;
    // A collapsed ROOT in `"lr"` keeps the branch side: the leading margin
    // before it is sized for breathing room, not for a label, and nothing is
    // laid out after it.
    const labelPlacement: TreeLabelPlacement =
      rendersAsLeaf && !(orientation === "lr" && n.depth === 0 && isExpandable) ? "leaf" : "branch";
    const label =
      isExpandable && !isExpanded ? collapsedLabel(node.name, node.childCount) : node.name;
    return { isExpandable, isExpanded, rendersAsLeaf, labelPlacement, label };
  };

  const layoutFn = d3Tree<TreeRenderNode<TData>>().nodeSize([crossStep, growthStep]);
  if (nodeBox) {
    // d3's default separation doubles the gap between cousins — right for dots
    // (it keeps sibling groups visibly apart), too much for boxes whose spacing
    // already includes the whole box plus a gap.
    layoutFn.separation((a, b) => (a.parent === b.parent ? 1 : 1.25));
  } else if (orientation === "tb" && expandedIds) {
    // A closed branch lays out like a leaf, only `SIBLING_GAP` from its row
    // neighbours — but a neighbour that is still OPEN centres its label under
    // its dot, running across into the closed branch's column. Wherever a
    // closed branch meets a centred label, space the pair by the label.
    // Trees with nothing closed keep d3's default spacing exactly.
    const crossHalf = (d: ReturnType<typeof describe>) =>
      d.labelPlacement === "branch" ? labelWidth(d.label) / 2 + LABEL_GAP / 2 : SIBLING_GAP / 2;
    layoutFn.separation((a, b) => {
      const base = a.parent === b.parent ? 1 : 2;
      if (a.data.pill || b.data.pill) return base;
      const da = describe(a);
      const db = describe(b);
      const closed = (d: typeof da) => d.isExpandable && !d.isExpanded;
      if (!closed(da) && !closed(db)) return base;
      return Math.max(base, (crossHalf(da) + crossHalf(db)) / SIBLING_GAP);
    });
  }
  const laidOut = layoutFn(root);

  const pointNodes = laidOut.descendants();
  let minCross = Infinity;
  let maxCross = -Infinity;
  let minGrowth = Infinity;
  let maxGrowth = -Infinity;
  for (const n of pointNodes) {
    minCross = Math.min(minCross, n.x);
    maxCross = Math.max(maxCross, n.x);
    minGrowth = Math.min(minGrowth, n.y);
    maxGrowth = Math.max(maxGrowth, n.y);
  }
  if (!Number.isFinite(minCross)) {
    minCross = maxCross = minGrowth = maxGrowth = 0;
  }

  const halfCross = nodeBox ? (orientation === "lr" ? nodeBox.height : nodeBox.width) / 2 : 0;
  const halfGrowth = nodeBox ? (orientation === "lr" ? nodeBox.width : nodeBox.height) / 2 : 0;
  const marginCross = nodeBox ? halfCross + BOX_MARGIN : MARGIN_CROSS;
  // A `"tb"` branch label is centred under its dot, so a narrow tree (two
  // closed branches under a long root name) can be narrower than one label.
  // Widen the side margins by exactly what overflows; a tree whose labels
  // already fit keeps its margins. A static (`collapsible={false}`) chart
  // keeps its long-standing size.
  let crossLead = marginCross;
  let crossTrail = marginCross;
  if (!nodeBox && orientation === "tb" && expandedIds) {
    for (const n of pointNodes) {
      if (n.data.pill) continue;
      const d = describe(n);
      if (d.labelPlacement !== "branch") continue;
      const half = labelWidth(d.label) / 2;
      crossLead = Math.max(crossLead, half - (n.x - minCross));
      crossTrail = Math.max(crossTrail, half - (maxCross - n.x));
    }
  }
  // `"tb"` puts nothing above the root (its label hangs below it), so the
  // leading growth margin only needs the cross margin's breathing room; the
  // freed height goes to the leaf labels at the bottom.
  const leadingGrowthMargin = nodeBox
    ? halfGrowth + BOX_MARGIN
    : orientation === "tb"
      ? MARGIN_CROSS
      : MARGIN_GROWTH;
  const toScreen = (n: { x: number; y: number }): [number, number] => {
    const cross = n.x - minCross + crossLead;
    const growth = n.y - minGrowth + leadingGrowthMargin;
    return orientation === "lr" ? [growth, cross] : [cross, growth];
  };

  const maxDepth = pointNodes.reduce((m, n) => Math.max(m, n.depth), 0);
  // The mono ramp is spread over the depths it has to tell apart. While
  // branches open and close, spread it over the WHOLE data's depth, so a
  // node's shade depends on its depth only, never on what else is open.
  const rampDepth = expandedIds
    ? resolved.preorder.reduce((m, n) => Math.max(m, n.depth), 0)
    : maxDepth;
  const depthColors = resolvePalette("mono", rampDepth + 1);
  const branchCount = laidOut.children?.length ?? 0;
  const branchColors =
    palette === "categorical" && branchCount > 0
      ? resolvePalette("categorical", branchCount, { explicit: true })
      : [];

  const colorFor = (n: HierarchyPointNode<TreeRenderNode<TData>>): string => {
    if (n.depth === 0) {
      return palette === "categorical" ? TREE_ROOT_COLOR : (depthColors[0] ?? TREE_ROOT_COLOR);
    }
    if (palette === "categorical") {
      return branchColors[n.data.node.branchIndex] ?? TREE_ROOT_COLOR;
    }
    return depthColors[n.depth] ?? (depthColors.at(-1) as string);
  };

  const screenOf = new Map<HierarchyPointNode<TreeRenderNode<TData>>, [number, number]>();
  const nodes: TreeLayoutNode<TData>[] = pointNodes.map((n) => {
    const [x, y] = toScreen(n);
    screenOf.set(n, [x, y]);
    const { node, pill } = n.data;
    if (pill) {
      return {
        id: `${node.id}:collapsed`,
        parentId: node.id,
        name: `+${pill.count}`,
        label: `+${pill.count}`,
        depth: n.depth,
        isLeaf: true,
        isPill: true,
        collapsedCount: pill.count,
        path: [...node.path, `+${pill.count}`],
        descendantLeafCount: pill.count,
        childCount: 0,
        isExpandable: false,
        isExpanded: false,
        rendersAsLeaf: true,
        labelPlacement: "leaf",
        siblingIndex: 0,
        siblingCount: 1,
        preorderIndex: node.preorderIndex,
        x,
        y,
        color: colorFor(n),
        hit: { x: x - 12, y: y - 12, width: 24, height: 24 },
        toggle: null,
        source: null,
      };
    }
    const { isExpandable, isExpanded, rendersAsLeaf, labelPlacement, label } = describe(n);
    const hit = nodeBox
      ? { x: x - nodeBox.width / 2, y: y - nodeBox.height / 2, ...nodeBox }
      : dotHitRect(x, y, label, labelPlacement, orientation, nodeRadius);
    let toggle: TreeRect | null = null;
    if (isExpandable) {
      if (nodeBox) {
        const width = togglePillWidth(node.childCount, isExpanded);
        const cx = orientation === "lr" ? x + nodeBox.width / 2 : x;
        const cy = orientation === "lr" ? y : y + nodeBox.height / 2;
        toggle = { x: cx - width / 2, y: cy - TOGGLE_SIZE / 2, width, height: TOGGLE_SIZE };
      } else {
        const half = MIN_DATAPOINT_TARGET_SIZE / 2;
        toggle = { x: x - half, y: y - half, width: half * 2, height: half * 2 };
      }
    }
    return {
      id: node.id,
      parentId: node.parentId,
      name: node.name,
      label,
      depth: n.depth,
      isLeaf: node.childCount === 0,
      isPill: false,
      collapsedCount: 0,
      path: node.path,
      descendantLeafCount: node.descendantLeafCount,
      childCount: node.childCount,
      isExpandable,
      isExpanded,
      rendersAsLeaf,
      labelPlacement,
      siblingIndex: node.siblingIndex,
      siblingCount: node.siblingCount,
      preorderIndex: node.preorderIndex,
      x,
      y,
      color: colorFor(n),
      hit,
      toggle,
      source: node.source,
    };
  });

  // Custom boxes attach links to their EDGES (lr: right-edge centre → left-edge
  // centre; tb: bottom-centre → top-centre); dots attach at the centre.
  const sourceOffset: [number, number] = nodeBox
    ? orientation === "lr"
      ? [nodeBox.width / 2, 0]
      : [0, nodeBox.height / 2]
    : [0, 0];
  const targetOffset: [number, number] = [-sourceOffset[0], -sourceOffset[1]];
  const linkGen =
    orientation === "lr"
      ? linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
      : linkVertical<{ source: [number, number]; target: [number, number] }, [number, number]>();
  const byPoint = new Map(pointNodes.map((n, i) => [n, nodes[i] as TreeLayoutNode<TData>]));
  const links: TreeLayoutLink[] = laidOut.links().map((l) => {
    const [sx, sy] = screenOf.get(l.source) ?? [0, 0];
    const [tx, ty] = screenOf.get(l.target) ?? [0, 0];
    const source: [number, number] = [sx + sourceOffset[0], sy + sourceOffset[1]];
    const target: [number, number] = [tx + targetOffset[0], ty + targetOffset[1]];
    const targetId = byPoint.get(l.target)?.id ?? "";
    return {
      id: `link:${targetId}`,
      sourceId: byPoint.get(l.source)?.id ?? "",
      targetId,
      depth: l.target.depth,
      d: linkGen({ source, target }) ?? "",
      source,
      target,
    };
  });

  const crossExtent = maxCross - minCross + crossLead + crossTrail;
  const trailingGrowthMargin = nodeBox
    ? halfGrowth + BOX_MARGIN + boxToggleOverhang(nodes, orientation, nodeBox)
    : dotTrailingMargin(
        nodes,
        orientation,
        nodeRadius,
        // The deepest row's SCREEN position, the frame `n.y` is measured in.
        orientation === "lr" ? 0 : maxGrowth - minGrowth + leadingGrowthMargin,
      );
  const growthExtent = maxGrowth - minGrowth + leadingGrowthMargin + trailingGrowthMargin;
  const width = orientation === "lr" ? growthExtent : crossExtent;
  const height = orientation === "lr" ? crossExtent : growthExtent;
  if (!nodeBox && orientation === "tb") clampRowHits(nodes, width);

  return {
    nodes,
    links,
    width: Math.max(width, nodeRadius * 2),
    height: Math.max(height, nodeRadius * 2),
    maxDepth,
    orientation,
    nodeBox: nodeBox ?? null,
  };
}

/**
 * Keeps a `"tb"` branch's centred label from claiming its row neighbours'
 * pixels. The label's share of the hit box stops halfway to the next node on
 * the same row (and at the canvas edge); the 24px square on the dot is never
 * cut, so a click on any dot or toggle lands on that node, never on the item
 * of a neighbour drawn after it.
 */
function clampRowHits(nodes: TreeLayoutNode[], width: number): void {
  const half = MIN_DATAPOINT_TARGET_SIZE / 2;
  const rows = new Map<number, TreeLayoutNode[]>();
  for (const n of nodes) {
    const row = rows.get(n.y);
    if (row) row.push(n);
    else rows.set(n.y, [n]);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    row.forEach((n, i) => {
      if (n.isPill || n.labelPlacement !== "branch") return;
      const prev = row[i - 1];
      const next = row[i + 1];
      const left = prev ? (prev.x + n.x) / 2 : 0;
      const right = next ? (n.x + next.x) / 2 : width;
      const x0 = Math.min(n.x - half, Math.max(n.hit.x, left));
      const x1 = Math.max(n.x + half, Math.min(n.hit.x + n.hit.width, right));
      n.hit = { ...n.hit, x: x0, width: x1 - x0 };
    });
  }
}

/**
 * The room a custom node's pill needs past the deepest box's growth edge.
 * The pill straddles the edge, so half of it overhangs.
 */
function boxToggleOverhang(
  nodes: TreeLayoutNode[],
  orientation: TreeOrientation,
  nodeBox: { width: number; height: number },
): number {
  let overhang = 0;
  for (const n of nodes) {
    if (!n.toggle) continue;
    overhang = Math.max(
      overhang,
      orientation === "lr"
        ? n.toggle.x + n.toggle.width - (n.x + nodeBox.width / 2)
        : n.toggle.y + n.toggle.height - (n.y + nodeBox.height / 2),
    );
  }
  return overhang;
}

/**
 * The trailing growth margin of a default-dot tree.
 *
 * `"tb"` leaf labels run DOWN from each leaf (see {@link labelOffset}), so the
 * bottom margin grows to fit the longest one instead of clipping it. A data
 * leaf is measured as if it sat on the deepest row — the long-standing rule,
 * kept so a fully expanded tree keeps its size — while a collapsed branch is
 * measured from its own row, since it can sit well above the deepest one and
 * its label carries the ` (n)` suffix.
 *
 * `"lr"` labels run sideways into the level gap, so the fixed margin covers
 * them — except a collapsed root, whose branch-side label is the only thing
 * after it.
 */
function dotTrailingMargin(
  nodes: TreeLayoutNode[],
  orientation: TreeOrientation,
  nodeRadius: number,
  maxGrowthScreen: number,
): number {
  let margin = MARGIN_GROWTH;
  const run = (label: string) => nodeRadius + LABEL_GAP + labelWidth(label) + 8;
  for (const n of nodes) {
    if (n.isPill || !n.rendersAsLeaf) continue;
    if (orientation === "lr") {
      if (n.depth === 0 && n.labelPlacement === "branch") margin = Math.max(margin, run(n.label));
    } else if (!n.isExpandable) {
      margin = Math.max(margin, run(n.label));
    } else {
      margin = Math.max(margin, n.y - maxGrowthScreen + run(n.label));
    }
  }
  return margin;
}
