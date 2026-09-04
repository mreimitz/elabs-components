/**
 * treemap-layout.ts — the pure, jsdom-free layout engine behind `TreemapChart`
 * (RM-025).
 *
 * Deliberately React-free and `@visx`-free: `d3-hierarchy`'s `treemap` +
 * `treemapSquarify` do the actual rectangle math, and this module's own job is
 * everything the lieflat F13 hard-rule block asks for that `d3-hierarchy` does
 * not do on its own —
 *
 *   - validate the input tree (dev-only: a parent's explicit `value` must equal
 *     the sum of its children, every value is non-negative),
 *   - truncate an arbitrarily-deep tree to the requested render `depth` (1 or
 *     2), aggregating anything deeper into the last visible level,
 *   - merge a long tail of small leaves into a synthetic "Other" bucket, both
 *     on an explicit `otherThreshold` (share of the parent's total) and
 *     unconditionally past `TREEMAP_MAX_LEAVES` — the Finding's hard rule,
 *   - assign colour per the `TreemapPalette` contract (mono / sequential /
 *     categorical) — grey encodes LEVEL only, never a random per-leaf shade.
 *
 * Kept separate from `treemap-chart.tsx` on purpose: the real chart measures
 * its container with `ResizeObserver`, which reports 0×0 under jsdom (see
 * `funnel-chart.test.tsx`'s header comment for the precedent), so the ONLY way
 * to unit-test "area ∝ value within 0.5%" is to call this module directly with
 * an explicit `width`/`height`.
 */

import {
  hierarchy,
  type HierarchyRectangularNode,
  treemap as d3Treemap,
  treemapSquarify,
} from "d3-hierarchy";
import { chartSequentialRamp, resolvePalette } from "../chart-context";

// ── Public data shape ────────────────────────────────────────────────────────

export interface TreemapNode {
  name: string;
  /** Required on a leaf (no children). On a parent it is optional, but when
   * given must equal the sum of its children's values (dev-validated). */
  value?: number;
  children?: TreemapNode[];
}

/**
 * - `"mono"` (default) — every leaf shares ONE neutral shade; groups are
 *   separated only by the title band + gap. Readable with colour removed.
 * - `"sequential"` — leaf shade encodes the leaf's own value (the heatmap
 *   read): the biggest leaves are the most intense.
 * - `"categorical"` — one hue per top-level group, ≤ 4 groups. Past four (or
 *   at `depth: 1`, where there are no groups to hue) it falls back to `"mono"`.
 */
export type TreemapPalette = "mono" | "sequential" | "categorical";

// ── Public layout result ─────────────────────────────────────────────────────

export interface TreemapRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TreemapLeafDatum extends TreemapRect {
  /** Stable, unique-within-the-layout id. */
  id: string;
  name: string;
  value: number;
  /** Share of the GRAND total (0..1). */
  share: number;
  /** Full path from the top-level group (or the root, at `depth: 1`) to this leaf. */
  path: string[];
  /** Index of the top-level group this leaf belongs to. `0` at `depth: 1`. */
  groupIndex: number;
  /** `null` at `depth: 1` (no groups). */
  groupName: string | null;
  /** `true` when this is the synthetic long-tail bucket. */
  isOther: boolean;
  color: string;
}

export interface TreemapGroupDatum extends TreemapRect {
  id: string;
  name: string;
  value: number;
  /** Share of the GRAND total (0..1). */
  share: number;
  color: string;
  /** Height, in px, of the reserved title-band strip at the top of the group. */
  bandHeight: number;
}

export interface TreemapLayoutResult {
  leaves: TreemapLeafDatum[];
  /** Empty at `depth: 1` — there is no group level to band. */
  groups: TreemapGroupDatum[];
  /** The grand total value the whole layout represents. */
  total: number;
}

export interface TreemapLayoutOptions {
  width: number;
  height: number;
  depth: 1 | 2;
  gap: number;
  palette: TreemapPalette;
  /** Share (0..1) of a parent's total below which a leaf merges into "Other". `0` = off. */
  otherThreshold: number;
  otherLabel?: string;
}

// ── Tunables (the Finding's hard rules, named) ───────────────────────────────

/** Reserved title-band height (px) at the top of each top-level group, `depth: 2` only. */
export const TREEMAP_TITLE_BAND_HEIGHT = 22;

/**
 * Past this many leaves IN ONE GROUP (or, at `depth: 1`, in the whole chart),
 * the smallest tail is merged into "Other" regardless of `otherThreshold` — the
 * lieflat F13 hard rule ("> 30 leaves → merge long tail into Other").
 */
export const TREEMAP_MAX_LEAVES = 30;

/** `palette: "categorical"` only hues groups up to this count; past it, mono. */
export const TREEMAP_CATEGORICAL_GROUP_CAP = 4;

/** The one shade every leaf shares under `palette: "mono"` (and as the fallback). */
export const TREEMAP_MONO_LEAF_COLOR = "var(--chart-mono-4)";

/** The neutral title-band fill — level is grey, never per-group hue, even under `"categorical"`. */
export const TREEMAP_BAND_COLOR = "var(--chart-mono-2)";

// ── Validation (dev-only) ────────────────────────────────────────────────────

function leafTotal(node: TreemapNode): number {
  if (!node.children || node.children.length === 0) {
    return Math.max(0, node.value ?? 0);
  }
  return node.children.reduce((acc, child) => acc + leafTotal(child), 0);
}

/**
 * Dev-only structural validation of the raw, caller-supplied tree: every value
 * is non-negative, every leaf has a value, and a parent's explicit `value`
 * (when given) equals the sum of its children. Throws — this is a programmer
 * error (bad data shape), not a runtime condition to render around.
 *
 * A no-op in production, same convention as the rest of the package's
 * dev-only invariant checks.
 */
export function validateTreemapData(node: TreemapNode, path: string[] = [node.name]): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const label = path.join(" › ");
  if (node.value != null && (!Number.isFinite(node.value) || node.value < 0)) {
    throw new Error(
      `TreemapChart: node "${label}" has value ${node.value}, but every value must be a ` +
        "non-negative finite number.",
    );
  }
  const children = node.children ?? [];
  if (children.length > 0) {
    for (const child of children) {
      if (child.value == null && (!child.children || child.children.length === 0)) {
        throw new Error(
          `TreemapChart: node "${[...path, child.name].join(" › ")}" has neither a "value" ` +
            'nor "children" — every leaf needs a value.',
        );
      }
    }
    if (node.value != null) {
      const sum = children.reduce((acc, child) => acc + leafTotal(child), 0);
      const tolerance = Math.max(1e-6, sum * 1e-6);
      if (Math.abs(node.value - sum) > tolerance) {
        throw new Error(
          `TreemapChart: node "${label}" has value ${node.value}, but its children sum to ` +
            `${sum}. A parent's explicit "value" must equal the sum of its children.`,
        );
      }
    }
    for (const child of children) {
      validateTreemapData(child, [...path, child.name]);
    }
  } else if (node.value == null) {
    throw new Error(`TreemapChart: leaf "${label}" must have a non-negative "value".`);
  }
}

// ── Truncation to render depth ───────────────────────────────────────────────

interface FlatNode {
  name: string;
  value: number;
  children?: FlatNode[];
  isOther?: boolean;
}

/**
 * Collapse `node` to at most `maxDepth` levels below it, aggregating anything
 * deeper into the value of the node at the cut. `level` is the depth of `node`
 * itself (root = 0), so `maxDepth: 1` keeps only the root's direct children
 * (as leaves) and `maxDepth: 2` also keeps THEIR children (as leaves).
 */
function truncateToDepth(node: TreemapNode, level: number, maxDepth: number): FlatNode {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const value = leafTotal(node);
  if (level >= maxDepth || !hasChildren) {
    return { name: node.name, value };
  }
  return {
    name: node.name,
    value,
    children: (node.children as TreemapNode[]).map((child) =>
      truncateToDepth(child, level + 1, maxDepth),
    ),
  };
}

// ── Long-tail merge (otherThreshold + the unconditional 30-leaf cap) ────────

/**
 * Merge `children`'s long tail into a synthetic "Other" bucket: first by
 * `otherThreshold` (share of THIS list's own total; a no-op below the min of
 * 2 qualifying leaves — merging one leaf into "Other" renames it for nothing),
 * then, unconditionally, past {@link TREEMAP_MAX_LEAVES}.
 */
function mergeLongTail(
  children: FlatNode[],
  otherThreshold: number,
  otherLabel: string,
): FlatNode[] {
  if (children.length === 0) {
    return children;
  }
  const total = children.reduce((acc, child) => acc + child.value, 0);
  let kept = children;
  let mergedValue = 0;
  let mergedCount = 0;

  if (otherThreshold > 0 && total > 0) {
    const above: FlatNode[] = [];
    const below: FlatNode[] = [];
    for (const child of children) {
      if (child.value / total < otherThreshold) {
        below.push(child);
      } else {
        above.push(child);
      }
    }
    if (below.length >= 2) {
      kept = above;
      mergedValue += below.reduce((acc, child) => acc + child.value, 0);
      mergedCount += below.length;
    }
  }

  if (kept.length > TREEMAP_MAX_LEAVES) {
    const sorted = [...kept].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, TREEMAP_MAX_LEAVES - 1);
    const tail = sorted.slice(TREEMAP_MAX_LEAVES - 1);
    kept = head;
    mergedValue += tail.reduce((acc, child) => acc + child.value, 0);
    mergedCount += tail.length;
  }

  if (mergedCount === 0) {
    return kept;
  }
  return [...kept, { name: otherLabel, value: mergedValue, isOther: true }];
}

// ── Colour assignment ────────────────────────────────────────────────────────

function sequentialColorFor(value: number, maxLeafValue: number): string {
  if (maxLeafValue <= 0) {
    return chartSequentialRamp[0];
  }
  const ratio = Math.min(1, Math.max(0, value / maxLeafValue));
  const step = Math.round(ratio * (chartSequentialRamp.length - 1));
  return chartSequentialRamp[step] as string;
}

// ── The layout ────────────────────────────────────────────────────────────────

/**
 * Lay out `root` into `options.width` × `options.height`. Returns leaves +
 * (at `depth: 2`) groups, each with the exact rectangle `d3-hierarchy`'s
 * squarified tiling computed — so leaf area is proportional to `value` by
 * construction, not by any approximation this module makes.
 */
export function computeTreemapLayout(
  root: TreemapNode,
  options: TreemapLayoutOptions,
): TreemapLayoutResult {
  const { width, height, depth, gap, palette, otherThreshold, otherLabel = "Other" } = options;
  if (width <= 0 || height <= 0) {
    return { leaves: [], groups: [], total: 0 };
  }

  const truncated = truncateToDepth(root, 0, depth);
  const prepared: FlatNode =
    depth === 1
      ? {
          ...truncated,
          children: truncated.children
            ? mergeLongTail(truncated.children, otherThreshold, otherLabel)
            : undefined,
        }
      : {
          ...truncated,
          children: truncated.children?.map((group) => ({
            ...group,
            children: group.children
              ? mergeLongTail(group.children, otherThreshold, otherLabel)
              : undefined,
          })),
        };

  const h = hierarchy<FlatNode>(prepared, (d) => d.children)
    .sum((d) => (d.children && d.children.length > 0 ? 0 : Math.max(0, d.value)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const total = h.value ?? 0;
  if (total <= 0) {
    return { leaves: [], groups: [], total: 0 };
  }

  const layoutFn = d3Treemap<FlatNode>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(gap)
    .paddingOuter(0)
    .round(false);

  if (depth === 2) {
    // Reserve title-band space inside every group node (depth 1 in the
    // hierarchy). d3-hierarchy applies paddingTop only to nodes with children,
    // so leaves (depth 2) are unaffected.
    layoutFn.paddingTop((node) => (node.depth === 1 ? TREEMAP_TITLE_BAND_HEIGHT : 0));
  }

  const rectRoot = layoutFn(h);

  const allLeafNodes = rectRoot.leaves();
  const maxLeafValue = allLeafNodes.reduce((m, n) => Math.max(m, n.value ?? 0), 0);

  const groupNodes = depth === 2 ? (rectRoot.children ?? []) : [];
  const groupCount = groupNodes.length;
  const useCategorical =
    palette === "categorical" &&
    depth === 2 &&
    groupCount > 0 &&
    groupCount <= TREEMAP_CATEGORICAL_GROUP_CAP;
  const categoricalColors = useCategorical
    ? resolvePalette("categorical", groupCount, { explicit: true })
    : [];

  const leafColorFor = (groupIndex: number, value: number): string => {
    if (palette === "sequential") {
      return sequentialColorFor(value, maxLeafValue);
    }
    if (useCategorical) {
      return categoricalColors[groupIndex] ?? TREEMAP_MONO_LEAF_COLOR;
    }
    return TREEMAP_MONO_LEAF_COLOR;
  };

  const groups: TreemapGroupDatum[] = [];
  const leaves: TreemapLeafDatum[] = [];

  const emitLeaf = (
    node: HierarchyRectangularNode<FlatNode>,
    groupIndex: number,
    groupName: string | null,
    leafIndex: number,
  ) => {
    const value = node.value ?? 0;
    leaves.push({
      id: `leaf:${groupIndex}:${leafIndex}`,
      name: node.data.name,
      value,
      share: total > 0 ? value / total : 0,
      path: groupName ? [groupName, node.data.name] : [node.data.name],
      groupIndex,
      groupName,
      isOther: node.data.isOther === true,
      x0: node.x0,
      y0: node.y0,
      x1: node.x1,
      y1: node.y1,
      color: leafColorFor(groupIndex, value),
    });
  };

  if (depth === 2) {
    groupNodes.forEach((groupNode, groupIndex) => {
      const value = groupNode.value ?? 0;
      groups.push({
        id: `group:${groupIndex}`,
        name: groupNode.data.name,
        x0: groupNode.x0,
        y0: groupNode.y0,
        x1: groupNode.x1,
        y1: groupNode.y1,
        value,
        share: total > 0 ? value / total : 0,
        color: useCategorical
          ? (categoricalColors[groupIndex] ?? TREEMAP_BAND_COLOR)
          : TREEMAP_BAND_COLOR,
        bandHeight: TREEMAP_TITLE_BAND_HEIGHT,
      });
      (groupNode.children ?? []).forEach((leafNode, leafIndex) => {
        emitLeaf(leafNode, groupIndex, groupNode.data.name, leafIndex);
      });
    });
  } else {
    allLeafNodes.forEach((leafNode, leafIndex) => {
      emitLeaf(leafNode, 0, null, leafIndex);
    });
  }

  return { leaves, groups, total };
}
