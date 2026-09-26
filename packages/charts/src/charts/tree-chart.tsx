"use client";

/**
 * TreeChart — a hierarchy drawn left to right (or top to bottom): "who
 * belongs to whom", with no sizes.
 *
 * - **`TreeChart`**: every node carries the SAME visual weight. There is no
 *   `value` field on {@link TreeNode} at all, on purpose: a tree answers
 *   "what contains what", never "how big is each part".
 * - **`TreemapChart`**: every leaf's AREA is proportional to its `value`.
 *   Reach for it the moment the question becomes "how big is each part",
 *   even over the same underlying hierarchy.
 *
 * ## Expand and collapse
 *
 * Branches open and close by default. A closed branch shows how many direct
 * children it holds (`Platform (3)`) and a ring around its dot, so it reads
 * as closed without relying on colour. Click the dot (or a custom node's
 * pill) to toggle; with the keyboard, Tab into the tree and use the arrow
 * keys, Space and Enter like any tree view. Every change animates: nodes grow
 * out of the parent they belong to and fold back into it, and links stay
 * attached throughout. Opening a branch scrolls its new children into view.
 * With reduced motion (the app's preference or the operating system's) the
 * chart jumps straight to the new layout.
 *
 * State is yours to own or to leave alone: pass `expandedIds` +
 * `onExpandedChange` to control it, `defaultExpandedIds` or
 * `defaultExpandedDepth` to seed it. `collapsible={false}` restores a fully
 * static chart.
 *
 * ## Custom nodes
 *
 * `renderNode` swaps the dot and label for your own content in a fixed box
 * (`nodeWidth` × `nodeHeight`), such as a KPI card. Links attach to the box
 * edges and the chart adds its own expand/collapse pill, so the content you
 * render stays purely visual: it sits in an `aria-hidden` wrapper and must
 * hold nothing focusable. Restate what the card shows through
 * `datapointLabel` (for example `Revenue, $2.32M, up 4.8% month over month`)
 * so screen-reader users get the same facts. Custom nodes need the
 * collapsible chart; `collapsible={false}` draws default dots.
 *
 * ## Why the layout needs no `ResizeObserver`
 *
 * Unlike `TreemapChart`, which squarifies INTO whatever box it is measured
 * at, `TreeChart` lays out at a FIXED node and level spacing: it never
 * shrinks, it scrolls inside its container instead. So the canvas's pixel
 * size is a pure function of the data, the open branches and the props,
 * never of the container, and the layout (`tree-chart-layout.ts`) is plain,
 * unit-testable maths.
 *
 * ## Links
 *
 * `d3-shape`'s `linkHorizontal()` (`orientation: "lr"`) / `linkVertical()`
 * (`"tb"`) draw the smooth S-curve most D3 tree diagrams use. On first paint
 * they reveal one generation at a time.
 */

import { localPoint } from "@visx/event";
import { animate, motion, motionValue, useTransform, type MotionValue } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cn, Skeleton, useControllableState, useLocale } from "@elabs-ai/components-ui";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { CHART_STAGGER_BAR_MS, DrawPath, HaloText, stagger } from "../marks";
import { readChartMotionMs } from "./animation";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { useChartInteractionPolicy } from "./chart-config-context";
import type { ChartDatapoint, ChartInteractionProps } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import type { ChartPalette } from "./chart-context";
import { ChartLoadingLabel } from "./chart-loading-label";
import { DEFAULT_CHART_STATUS, type ChartStatus } from "./chart-phase";
import { useResolvedChartProps } from "./use-resolved-chart-props";
import { TREE_CHART } from "../definitions/tree-chart.definition";
import { ChartTooltipBox } from "./tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "./tooltip/tooltip-content";
import { ChartPlotRoot, type ChartPlotHeight, type Responsive } from "./chart-breakpoint";
import {
  computeTreeLayout,
  DEFAULT_NODE_BOX_HEIGHT,
  DEFAULT_NODE_BOX_WIDTH,
  DEFAULT_NODE_SIZE,
  labelOffset,
  resolveTree,
  type ResolvedTree,
  type TreeLayoutNode,
  type TreeLayoutResult,
} from "./tree-chart-layout";
import { TreeChartTreeLayer } from "./tree-chart-tree-layer";
import {
  TREE_PAN_KEEP,
  TREE_ZOOM_MAX,
  TREE_ZOOM_MIN,
  TreeChartMiniMap,
  TreeChartZoomControls,
  useTreeZoom,
} from "./tree-chart-viewport";
import {
  fadeInAt,
  fadeOutAt,
  flightScrollTarget,
  frameAt,
  frameFromLayout,
  framesEqual,
  linkAt,
  linkMidpointAt,
  nodeAt,
  planTreeTransition,
  sizeAt,
  type TreeScrollInput,
  type TreeTransitionPlan,
} from "./tree-transition";

export {
  computeTreeLayout,
  resolveTree,
  type ComputeTreeLayoutOptions,
  type TreeLayoutLink,
  type TreeLayoutNode,
  type TreeLayoutResult,
} from "./tree-chart-layout";

// ── Public data shape ────────────────────────────────────────────────────────

/** A membership node. No `value`, see the module docblock for why. */
export interface TreeNode<TData = unknown> {
  name: string;
  children?: TreeNode<TData>[];
  /**
   * Stable identity: what expand state, animation and drill-down key on.
   * Without one, a node is named by its position among its siblings (root
   * `"0"`, its second child `"0.1"`, and so on), which stays stable while
   * branches open and close but shifts when you insert a sibling before it.
   * Give nodes ids when the data changes shape at runtime. Ids must be
   * unique; a repeated id falls back to the position name (with a warning in
   * development).
   */
  id?: string;
  /**
   * Your payload, handed back to `renderNode` and (on the collapsible chart)
   * `datapointLabel` / `onDatapointClick`; the layout never reads it.
   */
  data?: TData;
}

/** `"lr"` (default): root on the left, growing right. `"tb"`: root on top, growing down. */
export type TreeOrientation = "lr" | "tb";

/**
 * - `"mono"` (default): shade encodes DEPTH on the neutral grey ladder
 *   (`--chart-mono-1…7`), so every node at the same depth reads the same
 *   shade, whichever branch it is under.
 * - `"categorical"`: shade encodes the top-level BRANCH (one hue per direct
 *   child of the root); the root itself stays neutral, since it belongs to no
 *   branch.
 */
export type TreePalette = Extract<ChartPalette, "mono" | "categorical">;

/** What `renderNode` receives for each node. */
export interface TreeChartNodeRenderProps<TData = unknown> {
  /** Your node, including its `data` payload. */
  node: TreeNode<TData>;
  /** The node's stable id (yours, or its position name). */
  id: string;
  name: string;
  /** `0` for the root. */
  depth: number;
  /** Ancestor names, root first, this node last. */
  path: string[];
  /** Has no children in the data. */
  isLeaf: boolean;
  /** Has children in the data, so it can open and close. */
  isExpandable: boolean;
  /** Its children are showing. */
  isExpanded: boolean;
  /** Direct children in the data: the number the collapsed pill shows. */
  childCount: number;
  /** Leaves anywhere under this node (`1` for a leaf). */
  descendantLeafCount: number;
  orientation: TreeOrientation;
  /** The node's palette colour, a CSS colour value (a `var(--chart-…)` token). */
  color: string;
  /** Holds the tree's keyboard tab stop (draw a hint if you like; the chart draws the focus ring). */
  isActive: boolean;
}

/** What `renderLink` receives for each drawn link (parent → child). */
export interface TreeChartLinkRenderProps<TData = unknown> {
  /** `link:<childId>` — a node has one parent, so the child names the link. */
  id: string;
  /** The parent node, including its `data` payload. */
  source: TreeNode<TData>;
  /** The child node, including its `data` payload. */
  target: TreeNode<TData>;
  sourceId: string;
  targetId: string;
  /** The CHILD's depth (`1` for a link out of the root). */
  depth: number;
  /** The child's position among its parent's children in the data, `0` first. */
  index: number;
  /** How many children the parent has in the data. */
  siblingCount: number;
  orientation: TreeOrientation;
}

export interface TreeChartProps<TData = unknown> extends ChartInteractionProps {
  /** The hierarchy. Nodes need no `value`: membership only. */
  data: TreeNode<TData>;
  /** `"lr"` (default) or `"tb"`. Both work with default and custom nodes. */
  orientation?: TreeOrientation;
  /** Node dot diameter, in px. Default `7`. Ignored with `renderNode`. */
  nodeSize?: number;
  /** Which colour family shades a node. Default `"mono"`. */
  palette?: TreePalette;
  /**
   * Branches open and close. Default `true`. `false` draws a static chart
   * with every branch open (or cut by `collapseDepth`), no toggles and no
   * tree keyboard model; with `onDatapointClick`, nodes are plain data-point
   * buttons as on the other charts. The static chart always draws default
   * dots: `renderNode` needs `collapsible`.
   */
  collapsible?: boolean;
  /** Open branches, by node id (controlled). Pair with `onExpandedChange`. */
  expandedIds?: string[];
  /** Open branches on first render (uncontrolled). Wins over `defaultExpandedDepth`. */
  defaultExpandedIds?: string[];
  /** Fires with the full list of open branch ids, in depth-first order, after every open or close. */
  onExpandedChange?: (ids: string[]) => void;
  /**
   * Uncontrolled start: branches shallower than this depth start open
   * (root = depth `0`, so `1` shows the root's children closed). Default:
   * every branch open. Branches that appear later, when `data` changes,
   * follow the same rule.
   */
  defaultExpandedDepth?: number;
  /**
   * @deprecated Use `defaultExpandedDepth`. While the chart is collapsible it
   * means exactly that: nodes AT this depth start closed, showing `(n)`. With
   * `collapsible={false}` it keeps its old behaviour, replacing everything
   * deeper with a single "+k" pill (k = hidden leaves).
   */
  collapseDepth?: number;
  /**
   * Draws each node yourself, inside a fixed `nodeWidth` × `nodeHeight` box.
   * The output is presentational only: it sits in an `aria-hidden` wrapper,
   * so put nothing focusable in it, and restate its facts through
   * `datapointLabel`. The chart adds the expand/collapse pill. Needs the
   * collapsible chart: with `collapsible={false}` it is ignored (with a
   * warning in development) and default dots are drawn.
   */
  renderNode?: (node: TreeChartNodeRenderProps<TData>) => ReactNode;
  /**
   * Draws something at the midpoint of each link, centred on the line — the
   * operator a child contributes with (`+`, `−`, `×`), a weight, a role. The
   * output is presentational only: it sits in an `aria-hidden` wrapper, so
   * put nothing focusable in it, and restate what it says through
   * `datapointLabel` / `accessibleDescription`. Rides along when branches
   * open, close or reorient. Works with default dots and with `renderNode`.
   */
  renderLink?: (link: TreeChartLinkRenderProps<TData>) => ReactNode;
  /**
   * A canvas viewport, as on `CanvasShell`: the wheel zooms around the
   * pointer, dragging pans (from the empty canvas or from a node; a click
   * still opens a node), the tree can be dragged around even when it fits,
   * a trackpad pinch zooms, and zoom in / out / fit controls sit in the
   * corner. Default `false`: the chart scrolls inside its box at its
   * natural size.
   */
  zoomable?: boolean;
  /** The zoom range with `zoomable`. Default `[0.5, 2]` (React Flow's). */
  zoomRange?: [min: number, max: number];
  /** The zoom on first render with `zoomable`. Default `1`. */
  defaultZoom?: number;
  /** Fires after every zoom change (buttons, wheel, pinch, fit). */
  onZoomChange?: (zoom: number) => void;
  /**
   * A minimap in the corner: every node as a box, the part of the tree in
   * view as a window; click or drag on it to move the view. Default `false`.
   */
  minimap?: boolean;
  /** Custom node box width, px. Default `160`. Only used with `renderNode`. */
  nodeWidth?: number;
  /** Custom node box height, px. Default `72`. Only used with `renderNode`. */
  nodeHeight?: number;
  /**
   * `"start"` (default): the tree sits at the top-left of its container.
   * `"center"`: centred in a larger container. A tree bigger than its
   * container scrolls (it is never clipped) and opens centred on its root;
   * changes that no one toggled, such as "Expand all" or an orientation
   * switch, keep it centred there.
   */
  align?: "start" | "center";
  className?: string;
  /**
   * A fixed plot height (or responsive per-tier value), so the chart sizes
   * itself instead of relying on a wrapping element's CSS height. Unset: the
   * chart takes its container's natural size and scrolls inside it — its
   * long-standing default (see the module docblock).
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /** Accessible name for the chart region (and its tree). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /** Show the loading skeleton until the data is ready (ADR 0042 §9). Default `"ready"`. */
  status?: ChartStatus;
}

/**
 * The one link stroke, whatever the palette: links are furniture, not data —
 * but they are STRUCTURE, not gridlines. A `--chart-grid` hairline is drawn to
 * disappear behind marks, which on a dark theme made the links vanish
 * altogether (2.9:1 flat, ~2:1 at 0.65px). Links take the design system's edge
 * token (`--flow-edge`, what a flow diagram's connectors use) at a full pixel,
 * so a tree and a canvas draw their connections the same way in every theme.
 */
const TREE_LINK_COLOR = "var(--flow-edge)";
const TREE_LINK_WIDTH = 1;
/** The legacy "+k" pill (`collapsible={false}` + `collapseDepth`). */
const PILL_HEIGHT = 16;
const PILL_CHAR_WIDTH = 6.5;
const PILL_PADDING_X = 8;
const MIN_PILL_WIDTH = 24;
/** The collapsed-branch ring sits this far outside the dot. */
const RING_GAP = 3;
/**
 * The ring's ink: the neutral muted-foreground rung (≥ 4.5:1), never the
 * node's hue, which in a pale categorical colour barely shows against the
 * background.
 */
const TREE_RING_COLOR = "var(--chart-foreground-muted)";
const RING_WIDTH = 1.5;
/** Fallback length of an expand/collapse flight, ms (the `--duration-slow` token). */
const FLIGHT_FALLBACK_MS = 380;
/** Motion's cubic-bezier for the flight, the same curve as the `ease-standard` token. */
const FLIGHT_EASE = [0.2, 0, 0, 1] as const;

function pillWidth(label: string): number {
  return Math.max(MIN_PILL_WIDTH, label.length * PILL_CHAR_WIDTH + PILL_PADDING_X * 2);
}

// ── Accessible datapoint label ───────────────────────────────────────────────

/** The datum every `TreeChart` node hands to `onDatapointClick` and `datapointLabel`. */
export interface TreeDatapointDatum<TData = unknown> {
  name: string;
  depth: number;
  /** No children in the data. */
  isLeaf: boolean;
  /** Full ancestor path, root first, this node last. */
  path: string[];
  descendantLeafCount: number;
  /** The node's stable id. Absent on a `collapsible={false}` chart. */
  id?: string;
  /** Direct children in the data. Absent on a `collapsible={false}` chart. */
  childCount?: number;
  /** Absent on a `collapsible={false}` chart. */
  isExpanded?: boolean;
  /** Absent on a `collapsible={false}` chart. */
  isExpandable?: boolean;
  /** The node's `data` payload. Absent on a `collapsible={false}` chart. */
  data?: TData;
}

function countNoun(n: number, one: string, other: string): string {
  return `${n} ${n === 1 ? one : other}`;
}

/**
 * The default accessible name of a node.
 *
 * Tree nodes have no `value`, so the shared data-point default
 * (`"<category>: <value>"`) would say nothing useful. This restates what a
 * sighted reader sees: where the node sits and, for a branch, the child count
 * a closed branch displays, plus its leaf count when that differs:
 *
 * - leaf: `CI, in Engineering › Platform`
 * - branch: `Platform, in Engineering, 3 children`;
 *   `Engineering, 2 children, 5 members`
 *
 * Whether the branch is open is announced by the tree itself (`aria-expanded`),
 * not repeated in the name.
 */
export function defaultTreeDatapointLabel(
  point: Omit<ChartDatapoint<TreeDatapointDatum>, "source">,
): string {
  const { name, path, isLeaf, descendantLeafCount, childCount } = point.datum;
  const parts = [name];
  if (path.length > 1) {
    // Ancestors only: the full path would repeat the leading name.
    parts.push(`in ${path.slice(0, -1).join(" › ")}`);
  }
  if (isLeaf) return parts.join(", ");
  if (childCount == null) {
    parts.push(countNoun(descendantLeafCount, "member", "members"));
    return parts.join(", ");
  }
  parts.push(countNoun(childCount, "child", "children"));
  if (descendantLeafCount !== childCount) {
    parts.push(countNoun(descendantLeafCount, "member", "members"));
  }
  return parts.join(", ");
}

function datumFor(node: TreeLayoutNode<unknown>, withState: boolean): TreeDatapointDatum {
  const base: TreeDatapointDatum = {
    name: node.name,
    depth: node.depth,
    isLeaf: node.isLeaf,
    path: node.path,
    descendantLeafCount: node.descendantLeafCount,
  };
  if (!withState) return base;
  return {
    ...base,
    id: node.id,
    childCount: node.childCount,
    isExpanded: node.isExpanded,
    isExpandable: node.isExpandable,
    data: node.source?.data,
  };
}

// ── Scroll-edge fade ─────────────────────────────────────────────────────────
//
// The root scrolls by design: a tree that outgrows its box scrolls, it does
// not squeeze. With overlay scrollbars (the macOS default) nothing at rest
// tells a reader the tree continues past the fold, so a `mask-image` computed
// from MEASURED overflow fades exactly the edges that hide more content; a
// tree that fits gets no mask at all.

/** How wide the fade band is, in px. */
const SCROLL_FADE_SIZE = 20;

interface ScrollEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

const NO_SCROLL_EDGES: ScrollEdges = { top: false, bottom: false, left: false, right: false };

/**
 * One axis's fade stops. With neither end fading this degenerates to a fully
 * opaque layer, which lets two axes be intersected unconditionally.
 */
function axisMaskStops(
  direction: "to bottom" | "to right",
  fadeStart: boolean,
  fadeEnd: boolean,
): string {
  const stops: string[] = [fadeStart ? "transparent 0px" : "black 0px"];
  if (fadeStart) stops.push(`black ${SCROLL_FADE_SIZE}px`);
  if (fadeEnd) stops.push(`black calc(100% - ${SCROLL_FADE_SIZE}px)`);
  stops.push(fadeEnd ? "transparent 100%" : "black 100%");
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

/** The two axis masks, intersected; `undefined` when nothing overflows. */
function buildScrollMask(edges: ScrollEdges): string | undefined {
  if (!edges.top && !edges.bottom && !edges.left && !edges.right) {
    return undefined;
  }
  const vertical = axisMaskStops("to bottom", edges.top, edges.bottom);
  const horizontal = axisMaskStops("to right", edges.left, edges.right);
  return `${vertical}, ${horizontal}`;
}

// ── Expand state ────────────────────────────────────────────────────────────

interface TreeExpansionOptions {
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  defaultExpandedDepth?: number;
  collapseDepth?: number;
}

function branchIdsOf(resolved: ResolvedTree<unknown>): ReadonlySet<string> {
  return new Set(resolved.preorder.filter((n) => n.childCount > 0).map((n) => n.id));
}

/**
 * The open-branch set. Uncontrolled, a branch the chart has never seen (new
 * `data`) gets the default depth rule; controlled, `expandedIds` is the whole
 * truth. Ids that no longer name a branch are ignored.
 */
function useTreeExpansion(
  resolved: ResolvedTree<unknown>,
  {
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    defaultExpandedDepth,
    collapseDepth,
  }: TreeExpansionOptions,
): [ReadonlySet<string>, (ids: string[]) => void] {
  const depthLimit = defaultExpandedDepth ?? collapseDepth ?? Infinity;
  const [initial] = useState<string[]>(
    () =>
      defaultExpandedIds ??
      resolved.preorder.filter((n) => n.childCount > 0 && n.depth < depthLimit).map((n) => n.id),
  );
  const [isControlled] = useState(() => expandedIds !== undefined);
  // Every BRANCH the stored value was chosen against. A branch outside it is
  // new — including a node that was a leaf then and has children now
  // (streamed or placeholder data), which must follow the default rule too.
  const [known, setKnown] = useState<ReadonlySet<string>>(() => branchIdsOf(resolved));
  const [value, setValue] = useControllableState<string[]>(expandedIds, initial, onExpandedChange);

  const expanded = useMemo(() => {
    const chosen = new Set(value);
    const out = new Set<string>();
    for (const n of resolved.preorder) {
      if (n.childCount === 0) continue;
      if (chosen.has(n.id) || (!isControlled && !known.has(n.id) && n.depth < depthLimit)) {
        out.add(n.id);
      }
    }
    return out;
  }, [value, resolved, isControlled, known, depthLimit]);

  const setExpanded = useCallback(
    (ids: string[]) => {
      if (!isControlled) setKnown(branchIdsOf(resolved));
      setValue(ids);
    },
    [isControlled, resolved, setValue],
  );

  return [expanded, setExpanded];
}

// ── Motion ─────────────────────────────────────────────────────────────────

/** Where the scroller goes when a change lands: everything but the live viewport. */
type ScrollIntent = Omit<TreeScrollInput, "viewport">;

/** How every node was drawn before a change, for crossfading what switched. */
interface DrawnBefore {
  nodes: ReadonlyMap<string, TreeLayoutNode<unknown>>;
  orientation: TreeOrientation;
}

interface Flight {
  /** The layout this flight lands on. */
  layout: TreeLayoutResult<unknown>;
  plan: TreeTransitionPlan | null;
  progress: MotionValue<number>;
  /** Nodes leaving the tree, kept drawn (never focusable) until the flight ends. */
  ghosts: TreeLayoutNode<unknown>[];
  /** The nodes as drawn before this flight (`null` at rest): labels, rings and pills fade from these. */
  before: DrawnBefore | null;
  /** `0` until the layout first changes; the first-paint link reveal runs only then. */
  generation: number;
  /** Where the scroller lands (the toggled node, or the centred root); `null` = stays put. */
  scroll: ScrollIntent | null;
}

/** The reader's last open/close request: the node acted on and the open set it asked for. */
interface ExpandRequest {
  id: string;
  ids: readonly string[];
}

const EMPTY_GHOSTS: TreeLayoutNode<unknown>[] = [];

function sameIds(ids: readonly string[], set: ReadonlySet<string>): boolean {
  const unique = new Set(ids);
  if (unique.size !== set.size) return false;
  for (const id of unique) if (!set.has(id)) return false;
  return true;
}

/** The link at rest, or rebuilt from its two moving endpoints in flight. */
function TreeLink({
  d,
  link,
  plan,
  progress,
}: {
  d: string;
  link: { id: string; sourceId: string; targetId: string };
  plan: TreeTransitionPlan | null;
  progress: MotionValue<number>;
}) {
  const flightD = useTransform(progress, (t) => (plan ? linkAt(plan, link, t).d : d));
  const opacity = useTransform(progress, (t) => (plan ? linkAt(plan, link, t).opacity : 1));
  return (
    <motion.path
      d={plan ? flightD : d}
      data-slot="tree-link"
      fill="none"
      stroke={TREE_LINK_COLOR}
      strokeWidth={TREE_LINK_WIDTH}
      style={plan ? { opacity } : undefined}
    />
  );
}

/** A `renderLink` decoration, centred on its link's midpoint — at rest, or riding the flight. */
function TreeLinkDecoration({
  link,
  rest,
  plan,
  progress,
  children,
}: {
  link: { id: string; sourceId: string; targetId: string };
  /** The resting midpoint (from the layout), or `null` for a link that only exists in flight. */
  rest: { x: number; y: number } | null;
  plan: TreeTransitionPlan | null;
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  const x = useTransform(progress, (t) =>
    plan ? linkMidpointAt(plan, link, t).x : (rest?.x ?? 0),
  );
  const y = useTransform(progress, (t) =>
    plan ? linkMidpointAt(plan, link, t).y : (rest?.y ?? 0),
  );
  const opacity = useTransform(progress, (t) => (plan ? linkMidpointAt(plan, link, t).opacity : 1));
  if (!plan && !rest) return null;
  return (
    <motion.div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      data-link-id={link.id}
      data-slot="tree-chart-link-decoration"
      style={plan ? { left: x, top: y, opacity } : { left: rest?.x, top: rest?.y }}
    >
      {children}
    </motion.div>
  );
}

/** Offsets that carry a node drawn at its resting place along its flight path. */
function useFlightOffset(
  node: { id: string; x: number; y: number },
  plan: TreeTransitionPlan | null,
  progress: MotionValue<number>,
) {
  const entry = plan?.byId.get(node.id);
  const x = useTransform(progress, (t) => (entry ? nodeAt(entry, t).x - node.x : 0));
  const y = useTransform(progress, (t) => (entry ? nodeAt(entry, t).y - node.y : 0));
  const opacity = useTransform(progress, (t) => (entry ? nodeAt(entry, t).opacity : 1));
  return entry ? { entry, style: { x, y, opacity } } : { entry, style: undefined };
}

/**
 * How a node that stays in the tree looked before this flight, when its
 * furniture (label side, ring, pill edge) changed. Those parts are not
 * tweened: the old ones fade out in the flight's first half and the new ones
 * fade in during the second, so nothing jumps while the node is still moving.
 */
function useCrossfade(
  node: TreeLayoutNode<unknown>,
  plan: TreeTransitionPlan | null,
  progress: MotionValue<number>,
  before: DrawnBefore | null,
) {
  const fadeOut = useTransform(progress, fadeOutAt);
  const fadeIn = useTransform(progress, fadeInAt);
  const entry = plan?.byId.get(node.id);
  const prev = entry?.kind === "update" ? before?.nodes.get(node.id) : undefined;
  return { prev, fadeOut, fadeIn };
}

function isCollapsedBranch(node: TreeLayoutNode<unknown>): boolean {
  return node.isExpandable && !node.isExpanded;
}

/** The collapsed-branch ring: neutral ink, so it holds 3:1 whatever the node's hue. */
function TreeDotRing({ node, nodeRadius }: { node: TreeLayoutNode<unknown>; nodeRadius: number }) {
  return (
    <circle
      cx={node.x}
      cy={node.y}
      data-slot="tree-node-ring"
      fill="none"
      r={nodeRadius + RING_GAP}
      stroke={TREE_RING_COLOR}
      strokeWidth={RING_WIDTH}
    />
  );
}

/** A dot's label, placed for `shape` (the node as laid out now or before) at the node's current rest point. */
function TreeDotLabel({
  node,
  shape,
  orientation,
  nodeRadius,
  slot = true,
}: {
  node: TreeLayoutNode<unknown>;
  shape: TreeLayoutNode<unknown>;
  orientation: TreeOrientation;
  nodeRadius: number;
  slot?: boolean;
}) {
  const offset = labelOffset(orientation, shape.labelPlacement, nodeRadius);
  return (
    <HaloText
      className="text-chart-value"
      // The outgoing copy of a crossfade keeps HaloText's own slot, so the
      // label slot always names exactly one label per node.
      {...(slot ? { "data-slot": "tree-node-label" } : null)}
      dominantBaseline={offset.dominantBaseline}
      textAnchor={offset.textAnchor}
      transform={
        offset.rotate
          ? `rotate(${offset.rotate} ${node.x + offset.dx} ${node.y + offset.dy})`
          : undefined
      }
      x={node.x + offset.dx}
      y={node.y + offset.dy}
    >
      {shape.label}
    </HaloText>
  );
}

function TreeDotNode({
  node,
  orientation,
  nodeRadius,
  plan,
  progress,
  exiting,
  before,
}: {
  node: TreeLayoutNode<unknown>;
  orientation: TreeOrientation;
  nodeRadius: number;
  plan: TreeTransitionPlan | null;
  progress: MotionValue<number>;
  exiting: boolean;
  before: DrawnBefore | null;
}) {
  const { style } = useFlightOffset(node, plan, progress);
  const { prev, fadeOut, fadeIn } = useCrossfade(node, plan, progress, before);
  const collapsed = isCollapsedBranch(node);
  const ringChanged = prev != null && isCollapsedBranch(prev) !== collapsed;
  const labelMoved =
    prev != null &&
    (prev.labelPlacement !== node.labelPlacement || before?.orientation !== orientation);
  return (
    <motion.g
      className={cn(exiting && "pointer-events-none")}
      data-slot="tree-node"
      data-tree-node-id={node.id}
      style={style}
    >
      {ringChanged && prev && isCollapsedBranch(prev) && (
        <motion.g style={{ opacity: fadeOut }}>
          <TreeDotRing node={node} nodeRadius={nodeRadius} />
        </motion.g>
      )}
      {collapsed &&
        // A closed branch differs by SHAPE (a ring), not only by its label.
        (ringChanged ? (
          <motion.g style={{ opacity: fadeIn }}>
            <TreeDotRing node={node} nodeRadius={nodeRadius} />
          </motion.g>
        ) : (
          <TreeDotRing node={node} nodeRadius={nodeRadius} />
        ))}
      <circle cx={node.x} cy={node.y} fill={node.color} r={nodeRadius} />
      {labelMoved && prev && before ? (
        <>
          <motion.g style={{ opacity: fadeOut }}>
            <TreeDotLabel
              node={node}
              nodeRadius={nodeRadius}
              orientation={before.orientation}
              shape={prev}
              slot={false}
            />
          </motion.g>
          <motion.g style={{ opacity: fadeIn }}>
            <TreeDotLabel
              node={node}
              nodeRadius={nodeRadius}
              orientation={orientation}
              shape={node}
            />
          </motion.g>
        </>
      ) : (
        <TreeDotLabel node={node} nodeRadius={nodeRadius} orientation={orientation} shape={node} />
      )}
    </motion.g>
  );
}

/** The expand/collapse pill on a custom node's growth-side edge (drawn only; the tree layer takes the click). */
function TreeCardPill({
  node,
  orientation,
  opacity,
}: {
  node: TreeLayoutNode<unknown>;
  orientation: TreeOrientation;
  opacity?: MotionValue<number>;
}) {
  const { hit, toggle } = node;
  if (!toggle) return null;
  const Chevron = orientation === "lr" ? ChevronRight : ChevronDown;
  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        // Above the tree layer's focus ring, so the ring passes under the
        // pill instead of striking through its count; the border is the
        // pill's only edge against the card, so it takes the strong rung.
        "absolute z-10 flex items-center justify-center gap-0.5 rounded-full border border-border-strong bg-card text-meta tabular-nums text-muted-foreground shadow-xs",
        node.isExpanded ? "px-0" : "px-1.5",
      )}
      data-slot="tree-chart-node-toggle"
      style={{
        left: toggle.x - hit.x,
        top: toggle.y - hit.y,
        width: toggle.width,
        height: toggle.height,
        ...(opacity ? { opacity } : null),
      }}
    >
      <Chevron
        aria-hidden="true"
        className={cn(
          "shrink-0 transition-transform duration-fast ease-standard motion-reduce:transition-none",
          node.isExpanded && "rotate-180",
        )}
        size={14}
      />
      {!node.isExpanded && <span>{`(${node.childCount})`}</span>}
    </motion.div>
  );
}

function TreeCardNode({
  node,
  children,
  orientation,
  plan,
  progress,
  exiting,
  before,
}: {
  node: TreeLayoutNode<unknown>;
  children: ReactNode;
  orientation: TreeOrientation;
  plan: TreeTransitionPlan | null;
  progress: MotionValue<number>;
  exiting: boolean;
  before: DrawnBefore | null;
}) {
  const { entry, style } = useFlightOffset(node, plan, progress);
  const { prev, fadeOut, fadeIn } = useCrossfade(node, plan, progress, before);
  const { hit } = node;
  // An orientation switch moves the pill to another edge: fade it across
  // instead of jumping there while the card is still in flight.
  const pillMoved = prev != null && before != null && before.orientation !== orientation;
  return (
    <motion.div
      className={cn("absolute", exiting && "pointer-events-none")}
      data-node-id={node.id}
      data-slot="tree-chart-node"
      style={{
        left: hit.x,
        top: hit.y,
        width: hit.width,
        height: hit.height,
        // In flight, entering and leaving cards pass UNDER the ones that stay.
        ...(style && entry ? { ...style, zIndex: entry.kind === "update" ? 1 : 0 } : null),
      }}
    >
      <div aria-hidden="true" className="h-full w-full" data-slot="tree-chart-node-content" inert>
        {children}
      </div>
      {pillMoved && prev && before ? (
        <>
          <TreeCardPill node={prev} opacity={fadeOut} orientation={before.orientation} />
          <TreeCardPill node={node} opacity={fadeIn} orientation={orientation} />
        </>
      ) : (
        <TreeCardPill node={node} orientation={orientation} />
      )}
    </motion.div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

interface TooltipState {
  node: TreeLayoutNode<unknown>;
  x: number;
  y: number;
}

const EMPTY_TREE_TARGETS: ChartDatapointTarget[] = [];

/** The visible node that holds the tab stop: the chosen one, else its nearest visible ancestor. */
function resolveActiveId(
  activeId: string | null,
  layout: TreeLayoutResult<unknown>,
  resolved: ResolvedTree<unknown>,
): string | null {
  const visible = new Set(layout.nodes.map((n) => n.id));
  for (let id = activeId; id != null; id = resolved.byId.get(id)?.parentId ?? null) {
    if (visible.has(id)) return id;
  }
  return layout.nodes[0]?.id ?? null;
}

const TreeChartBody = forwardRef<HTMLDivElement, TreeChartProps>(function TreeChartBody(
  {
    data,
    orientation = "lr",
    nodeSize = DEFAULT_NODE_SIZE,
    collapseDepth,
    palette = "mono",
    collapsible = true,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    defaultExpandedDepth,
    renderNode,
    renderLink,
    zoomable = false,
    zoomRange,
    defaultZoom = 1,
    onZoomChange,
    minimap = false,
    nodeWidth = DEFAULT_NODE_BOX_WIDTH,
    nodeHeight = DEFAULT_NODE_BOX_HEIGHT,
    align = "start",
    className,
    plotHeight,
    accessibleLabel,
    accessibleDescription,
    status = DEFAULT_CHART_STATUS,
    onDatapointClick,
    copyValueOnActivate: _copyValueOnActivate,
    datapointLabel,
    maxInteractiveDatapoints: _maxInteractiveDatapoints,
  }: TreeChartProps,
  forwardedRef,
) {
  const nodeRadius = nodeSize / 2;
  const { t } = useLocale();
  const interactions = useChartInteractionPolicy();
  const reducedMotion = useReducedMotion();

  const outerRef = useRef<HTMLDivElement | null>(null);
  const setOuterRef = useCallback(
    (node: HTMLDivElement | null) => {
      outerRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // ── Viewport (zoom + minimap) ────────────────────────────────────────
  // Zoom is a `scale()` on the canvas inside the scroll box: pan IS scroll,
  // so everything that scrolls the box (flights, centring, the keyboard
  // model) keeps working, in scroll pixels = tree pixels × zoom + origin.
  //
  // A free canvas: with `zoomable` the stage leaves room around the tree —
  // the box's size less `TREE_PAN_KEEP` on every side — so the tree can be
  // dragged around even when it fits, and never quite out of view. That
  // room moves the tree's top-left corner to `panOrigin` in scroll pixels.
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const zoomGestures = zoomable && interactions.active;
  const panRoomX = zoomable && box ? Math.max(0, box.width - TREE_PAN_KEEP) : 0;
  const panRoomY = zoomable && box ? Math.max(0, box.height - TREE_PAN_KEEP) : 0;
  const panOrigin = useRef({ x: panRoomX, y: panRoomY });
  panOrigin.current =
    panOrigin.current.x === panRoomX && panOrigin.current.y === panRoomY
      ? panOrigin.current
      : { x: panRoomX, y: panRoomY };
  const {
    zoom,
    zoomIn,
    zoomOut,
    fitView,
    min: zoomMin,
    max: zoomMax,
  } = useTreeZoom({
    scroller: outerRef,
    // RM-167: wheel zoom and drag-pan are the host's `active` layer. Off, the
    // canvas keeps its room and its zoom; only the gestures and controls go.
    enabled: zoomGestures,
    min: zoomRange?.[0] ?? TREE_ZOOM_MIN,
    max: zoomRange?.[1] ?? TREE_ZOOM_MAX,
    defaultZoom,
    onZoomChange,
    origin: panOrigin,
  });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** A scroll target computed in tree pixels, in the box's scroll pixels. */
  const scrollTargetAt = useCallback(
    (el: HTMLElement, input: Omit<TreeScrollInput, "viewport">) => {
      const k = zoomRef.current;
      const o = panOrigin.current;
      const target = flightScrollTarget({
        ...input,
        viewport: {
          left: (el.scrollLeft - o.x) / k,
          top: (el.scrollTop - o.y) / k,
          width: el.clientWidth / k,
          height: el.clientHeight / k,
        },
        slack: { x: o.x / k, y: o.y / k },
      });
      return { left: target.left * k + o.x, top: target.top * k + o.y };
    },
    [],
  );

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  const resolved = useMemo(() => resolveTree(data), [data]);
  const [expanded, setExpanded] = useTreeExpansion(resolved, {
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    defaultExpandedDepth,
    collapseDepth,
  });

  // Custom nodes need the collapsible chart: its tree layer is what makes a
  // card focusable and clickable. The static chart ignores `renderNode`.
  const hasCustomNodes = renderNode != null && collapsible;
  const ignoredRenderNode = renderNode != null && !collapsible;
  useEffect(() => {
    if (ignoredRenderNode && process.env.NODE_ENV !== "production") {
      console.warn(
        "[TreeChart] `renderNode` needs the collapsible chart and is ignored with " +
          "`collapsible={false}`; the chart draws its default dots instead.",
      );
    }
  }, [ignoredRenderNode]);
  const layout = useMemo(
    () =>
      computeTreeLayout(
        data,
        {
          orientation,
          palette,
          nodeRadius,
          collapseDepth: collapsible ? undefined : collapseDepth,
          expandedIds: collapsible ? expanded : undefined,
          nodeBox: hasCustomNodes ? { width: nodeWidth, height: nodeHeight } : undefined,
        },
        resolved,
      ),
    [
      data,
      resolved,
      orientation,
      palette,
      nodeRadius,
      collapsible,
      collapseDepth,
      expanded,
      hasCustomNodes,
      nodeWidth,
      nodeHeight,
    ],
  );

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // ── Flight: every layout change after first paint animates ────────────
  // The reader's last open/close request. It steers the scroll only when the
  // layout that follows is the one it asked for (a controlled parent may
  // ignore or change it), and the next layout change always clears it.
  const requestRef = useRef<ExpandRequest | null>(null);
  const [storedFlight, setFlight] = useState<Flight>(() => ({
    layout,
    plan: null,
    progress: motionValue(1),
    ghosts: EMPTY_GHOSTS,
    before: null,
    generation: 0,
    scroll: null,
  }));
  let flight = storedFlight;
  if (flight.layout !== layout) {
    // Adjusting state while rendering (React's "store information from
    // previous renders" pattern): the plan must exist in the SAME commit as
    // the new layout, or one frame would paint the end state first.
    const nextFrame = frameFromLayout(layout);
    const changed = !framesEqual(frameFromLayout(flight.layout), nextFrame);
    const animated = collapsible && !reducedMotion;
    const reuse = animated && flight.plan != null && framesEqual(flight.plan.target, nextFrame);
    const from = flight.plan
      ? frameAt(flight.plan, flight.progress.get())
      : frameFromLayout(flight.layout);
    let plan: TreeTransitionPlan | null = null;
    let progress = motionValue(0);
    if (reuse) {
      // Same destination (a re-render with an equal layout): keep flying,
      // with the scroll it already had.
      plan = flight.plan;
      progress = flight.progress;
    } else if (animated) {
      plan = planTreeTransition(from, nextFrame);
    }
    let ghosts = EMPTY_GHOSTS;
    let before: DrawnBefore | null = null;
    if (plan) {
      const drawn = new Map<string, TreeLayoutNode<unknown>>();
      for (const n of flight.ghosts) drawn.set(n.id, n);
      for (const n of flight.layout.nodes) drawn.set(n.id, n);
      ghosts = plan.nodes
        .filter((n) => n.kind === "exit")
        .map((n) => drawn.get(n.id))
        .filter((n): n is TreeLayoutNode<unknown> => n != null);
      before = reuse ? flight.before : { nodes: drawn, orientation: flight.layout.orientation };
    }
    let scroll: ScrollIntent | null = null;
    if (reuse) {
      scroll = flight.scroll;
    } else if (changed) {
      const request = requestRef.current;
      const anchorId = request && sameIds(request.ids, expanded) ? request.id : null;
      const anchor = anchorId ? from.nodes.find((n) => n.id === anchorId) : undefined;
      const root = from.nodes.find((n) => n.parentId === null);
      if (anchor) {
        scroll = { layout, anchor: { id: anchor.id, x: anchor.x, y: anchor.y }, root: null, align };
      } else if (align === "center" && root) {
        scroll = { layout, anchor: null, root: { x: root.x, y: root.y }, align };
      }
    }
    flight = {
      layout,
      plan,
      progress,
      ghosts,
      before,
      generation: changed ? flight.generation + 1 : flight.generation,
      scroll,
    };
    setFlight(flight);
    if (changed && tooltip) setTooltip(null);
  }
  const { plan, progress, scroll: flightScroll } = flight;

  useLayoutEffect(() => {
    // The request has been answered (or ignored) by the layout now drawn.
    requestRef.current = null;
  }, [layout]);

  // `align="center"`: a tree bigger than its box opens centred on its root
  // across the growth axis, not scrolled to one side of it.
  useLayoutEffect(() => {
    const el = outerRef.current;
    // A free canvas places its first view once its pan room is measured (below).
    if (!el || zoomable || align !== "center" || (el.clientWidth === 0 && el.clientHeight === 0))
      return;
    const root = layout.nodes.find((n) => n.parentId === null);
    if (!root) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
    const target = scrollTargetAt(el, {
      layout,
      anchor: null,
      root: { x: root.x, y: root.y },
      align,
    });
    el.scrollLeft = target.left;
    el.scrollTop = target.top;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only: later changes carry their own scroll intent
  }, []);

  // The free canvas's pan room follows the box. The first measured room
  // places the view — the tree's top-left corner where it would sit with no
  // room, or with `align="center"` centred on the tree (a tree that fits)
  // or on its root (one that does not); after that a resize shifts the
  // scroll by the room's change, so the tree stays put on screen.
  const placedOrigin = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el || !zoomable) {
      placedOrigin.current = null;
      return;
    }
    if (!box || (box.width === 0 && box.height === 0)) return;
    const o = panOrigin.current;
    const prev = placedOrigin.current;
    placedOrigin.current = o;
    if (prev) {
      el.scrollLeft += o.x - prev.x;
      el.scrollTop += o.y - prev.y;
      return;
    }
    el.scrollLeft = o.x;
    el.scrollTop = o.y;
    const root = layout.nodes.find((n) => n.parentId === null);
    if (align !== "center" || !root) return;
    const target = scrollTargetAt(el, {
      layout,
      anchor: null,
      root: { x: root.x, y: root.y },
      align,
    });
    const k = zoomRef.current;
    const w = layout.width * k;
    const h = layout.height * k;
    el.scrollLeft = w <= el.clientWidth ? o.x + (w - el.clientWidth) / 2 : target.left;
    el.scrollTop = h <= el.clientHeight ? o.y + (h - el.clientHeight) / 2 : target.top;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on the room; the layout at that moment is the one to place
  }, [zoomable, box, panRoomX, panRoomY, align, scrollTargetAt]);

  useLayoutEffect(() => {
    const el = outerRef.current;
    const measured = el != null && (el.clientWidth > 0 || el.clientHeight > 0);
    const target = el && measured && flightScroll ? scrollTargetAt(el, flightScroll) : null;
    if (!plan) {
      // No flight (reduced motion): jump straight to where the change lands.
      if (el && target) {
        el.scrollLeft = target.left;
        el.scrollTop = target.top;
      }
      return;
    }
    const scrollLeft = el?.scrollLeft ?? 0;
    const scrollTop = el?.scrollTop ?? 0;
    const controls = animate(0, 1, {
      duration: readChartMotionMs("--duration-slow", FLIGHT_FALLBACK_MS, el) / 1000,
      ease: [...FLIGHT_EASE],
      onUpdate: (value) => {
        progress.set(value);
        // Nodes move linearly in `value`, so a scroll that does too keeps
        // the toggled node locked on screen while it heads for the target.
        if (el && target) {
          el.scrollLeft = scrollLeft + (target.left - scrollLeft) * value;
          el.scrollTop = scrollTop + (target.top - scrollTop) * value;
        }
      },
      onComplete: () => {
        progress.set(1);
        setFlight((current) =>
          current.plan === plan
            ? { ...current, plan: null, ghosts: EMPTY_GHOSTS, before: null, scroll: null }
            : current,
        );
        const focused = typeof document === "undefined" ? null : document.activeElement;
        if (focused instanceof HTMLElement && el?.contains(focused)) {
          focused.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        }
      },
    });
    return () => controls.stop();
  }, [plan, progress, flightScroll, scrollTargetAt]);

  const flightWidth = useTransform(progress, (v) => (plan ? sizeAt(plan, v).width : layout.width));
  const flightHeight = useTransform(progress, (v) =>
    plan ? sizeAt(plan, v).height : layout.height,
  );
  // The stage is the scaled footprint the scroll box lays out; the canvas
  // inside it draws at zoom 1 and is scaled visually.
  const stageWidth = useTransform(flightWidth, (w) => w * zoom + 2 * panRoomX);
  const stageHeight = useTransform(flightHeight, (h) => h * zoom + 2 * panRoomY);
  const svgWidth = plan ? Math.max(plan.from.width, plan.to.width) : layout.width;
  const svgHeight = plan ? Math.max(plan.from.height, plan.to.height) : layout.height;

  // ── Scroll-edge fade ──────────────────────────────────────────────────
  const [scrollEdges, setScrollEdges] = useState<ScrollEdges>(NO_SCROLL_EDGES);
  const [viewRect, setViewRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const updateScrollAffordance = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const o = panOrigin.current;
    if (minimap) {
      const k = zoomRef.current;
      const rect = {
        x: (el.scrollLeft - o.x) / k,
        y: (el.scrollTop - o.y) / k,
        width: el.clientWidth / k,
        height: el.clientHeight / k,
      };
      setViewRect((prev) =>
        prev.x === rect.x &&
        prev.y === rect.y &&
        prev.width === rect.width &&
        prev.height === rect.height
          ? prev
          : rect,
      );
    }
    // An edge fades while the TREE runs on past it (not the pan room around
    // it). 1px tolerance absorbs sub-pixel layout rounding.
    const next = {
      top: el.scrollTop > o.y + 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - o.y - 1,
      left: el.scrollLeft > o.x + 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - o.x - 1,
    };
    setScrollEdges((prev) =>
      prev.top === next.top &&
      prev.bottom === next.bottom &&
      prev.left === next.left &&
      prev.right === next.right
        ? prev
        : next,
    );
  }, [minimap]);
  useLayoutEffect(() => {
    const el = outerRef.current;
    // The box's size sets the free canvas's pan room.
    const measure = () => {
      if (!el || !zoomable) return;
      const width = el.clientWidth;
      const height = el.clientHeight;
      setBox((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    measure();
    updateScrollAffordance();
    const content = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Observe the scroller (viewport changes) and the canvas inside it (the
    // tree's own size changes without the scroller resizing).
    const observer = new ResizeObserver(() => {
      measure();
      updateScrollAffordance();
    });
    observer.observe(el);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [updateScrollAffordance, zoomable, layout.width, layout.height, zoom, panRoomX, panRoomY]);
  const scrollMask = useMemo(() => buildScrollMask(scrollEdges), [scrollEdges]);
  const scrollOverflowAttr = scrollMask
    ? (["top", "bottom", "left", "right"] as const).filter((edge) => scrollEdges[edge]).join(" ")
    : undefined;

  // ── Interaction ─────────────────────────────────────────────────────
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const treeActive = collapsible && interactions.active !== false;
  const canActivate =
    treeActive && Boolean(onDatapointClick) && interactions.select !== false && !!activateDatapoint;
  const showTooltip = interactions.passive !== false;

  const targetFor = useCallback(
    (node: TreeLayoutNode<unknown>, withState: boolean): ChartDatapointTarget => ({
      id: node.id,
      // `collapsible={false}` keeps the payload it always had: `index` is the depth.
      index: withState ? node.preorderIndex : node.depth,
      seriesIndex: node.depth,
      datum: datumFor(node, withState) as unknown as Record<string, unknown>,
      value: undefined,
      category: node.name,
      rect: withState
        ? node.hit
        : padDatapointRect({
            x: node.x - nodeRadius,
            y: node.y - nodeRadius,
            width: nodeRadius * 2,
            height: nodeRadius * 2,
          }),
    }),
    [nodeRadius],
  );

  // `collapsible={false}`: nodes are the shared data-point layer's buttons.
  const legacyTargets = useMemo(() => {
    if (collapsible || !datapointsEnabled) {
      return EMPTY_TREE_TARGETS;
    }
    return layout.nodes.filter((n) => !n.isPill).map((n) => targetFor(n, false));
  }, [collapsible, layout.nodes, datapointsEnabled, targetFor]);
  useRegisterDatapointTargets("nodes", legacyTargets);

  const nameOf = useCallback(
    (node: TreeLayoutNode<unknown>) => {
      const { id: _id, rect: _rect, seriesIndex: _seriesIndex, ...point } = targetFor(node, true);
      const custom = datapointLabel?.(point)?.trim();
      return (
        custom ||
        defaultTreeDatapointLabel(
          point as unknown as Omit<ChartDatapoint<TreeDatapointDatum>, "source">,
        )
      );
    },
    [datapointLabel, targetFor],
  );

  const handleExpandedChange = useCallback(
    (ids: string[], anchorId: string) => {
      requestRef.current = { id: anchorId, ids };
      setExpanded(ids);
    },
    [setExpanded],
  );

  const [chosenActiveId, setChosenActiveId] = useState<string | null>(null);
  const activeId = treeActive ? resolveActiveId(chosenActiveId, layout, resolved) : null;

  const pointerTooltip = useCallback((node: TreeLayoutNode<unknown>, event: React.MouseEvent) => {
    const point = canvasRef.current ? localPoint(canvasRef.current, event) : localPoint(event);
    // `localPoint` measures in scaled screen pixels; the tooltip lives on the canvas.
    const k = zoomRef.current;
    setTooltip({ node, x: point ? point.x / k : node.x, y: point ? point.y / k : node.y });
  }, []);
  const clearTooltip = useCallback(() => setTooltip(null), []);
  const dotTooltips = showTooltip && !hasCustomNodes;

  // `collapsible={false}` keeps its pointer handlers on the drawing itself.
  const handleEnter = useCallback((node: TreeLayoutNode<unknown>, event: React.MouseEvent) => {
    const point = localPoint(event);
    const k = zoomRef.current;
    setTooltip({ node, x: (point?.x ?? 0) / k, y: (point?.y ?? 0) / k });
  }, []);

  const renderProps = (node: TreeLayoutNode<unknown>): TreeChartNodeRenderProps => ({
    node: node.source ?? { name: node.name },
    id: node.id,
    name: node.name,
    depth: node.depth,
    path: node.path,
    isLeaf: node.isLeaf,
    isExpandable: node.isExpandable,
    isExpanded: node.isExpanded,
    childCount: node.childCount,
    descendantLeafCount: node.descendantLeafCount,
    orientation,
    color: node.color,
    isActive: node.id === activeId,
  });

  const drawnNodes: { node: TreeLayoutNode<unknown>; exiting: boolean }[] = [
    ...layout.nodes.map((node) => ({ node, exiting: false })),
    ...(plan ? flight.ghosts.map((node) => ({ node, exiting: true })) : []),
  ];
  const restingLinkD = new Map(layout.links.map((l) => [l.id, l.d]));
  const firstReveal = flight.generation === 0 && !plan;

  // `renderLink`: the data node behind each link end and the child's place
  // among its siblings come from the RESOLVED data (not the layout), so a
  // link whose node is flying out — no longer laid out — still resolves.
  const restingLinkMid = new Map(
    layout.links.map((l) => [
      l.id,
      { x: (l.source[0] + l.target[0]) / 2, y: (l.source[1] + l.target[1]) / 2 },
    ]),
  );
  const linkRenderProps = (link: { id: string; sourceId: string; targetId: string }) => {
    const target = resolved.byId.get(link.targetId);
    const source = resolved.byId.get(link.sourceId);
    if (!target || !source) return null;
    return {
      id: link.id,
      source: source.source,
      target: target.source,
      sourceId: link.sourceId,
      targetId: link.targetId,
      depth: target.depth,
      index: target.siblingIndex,
      siblingCount: target.siblingCount,
      orientation,
    } satisfies TreeChartLinkRenderProps;
  };

  const hasViewport = zoomable || minimap;
  const centerViewOn = (x: number, y: number) => {
    const el = outerRef.current;
    if (!el) return;
    el.scrollLeft = panRoomX + x * zoom - el.clientWidth / 2;
    el.scrollTop = panRoomY + y * zoom - el.clientHeight / 2;
  };

  const chart = (
    <ChartPlotRoot
      // Unset `plotHeight`: no `plotBox` at all — the chart keeps its
      // long-standing natural-size-and-scroll default (module docblock),
      // never registering with an enclosing frame. Only a caller-set
      // `plotHeight` opts into a sized, frame-aware plot box.
      plotBox={plotHeight !== undefined ? { plotHeight, defaultPlotHeight: "auto" } : undefined}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn(
        "relative h-full w-full select-none overflow-auto",
        align === "center" && "flex",
        // A canvas has no scrollbars: the pan room would make them lie
        // about how much there is to see. The minimap is the overview.
        // RM-167: with the host's `active` off, native wheel / trackpad / touch
        // scrolling is pan too, so the box stops scrolling for the user; the
        // current offset stays, and the chart's own scrolls still set it.
        zoomable &&
          (zoomGestures
            ? "cursor-grab [scrollbar-width:none] data-[panning=true]:cursor-grabbing [&::-webkit-scrollbar]:hidden [&[data-panning=true]_*]:cursor-grabbing"
            : "overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"),
        // With a viewport the frame carries the caller's className.
        !hasViewport && className,
      )}
      data-zoom={zoomable ? zoom.toFixed(2) : undefined}
      data-scroll-overflow={scrollOverflowAttr}
      data-slot="tree-chart"
      onScroll={updateScrollAffordance}
      ref={setOuterRef}
      role={role}
      style={
        scrollMask
          ? { WebkitMaskImage: scrollMask, maskComposite: "intersect", maskImage: scrollMask }
          : undefined
      }
      tabIndex={tabIndex}
    >
      <ChartA11yLabel description={accessibleDescription} descId={descId} />
      {status === "loading" ? (
        <>
          <Skeleton className="absolute inset-0 size-full" />
          <ChartLoadingLabel />
        </>
      ) : (
        <>
          {/* The stage is the canvas's scaled footprint — what the box scrolls over. */}
          <motion.div
            className={cn("relative", align === "center" && "m-auto shrink-0")}
            data-slot="tree-chart-stage"
            style={{
              width: plan ? stageWidth : layout.width * zoom + 2 * panRoomX,
              height: plan ? stageHeight : layout.height * zoom + 2 * panRoomY,
            }}
          >
            <motion.div
              className={cn("relative origin-top-left", plan && "bg-chart-background")}
              data-slot="tree-chart-canvas"
              ref={canvasRef}
              style={{
                width: plan ? flightWidth : layout.width,
                height: plan ? flightHeight : layout.height,
                transform: zoom === 1 ? undefined : `scale(${zoom})`,
                // The free canvas's pan room, before the tree.
                left: panRoomX || undefined,
                top: panRoomY || undefined,
              }}
            >
              <svg
                aria-hidden="true"
                className="absolute inset-0"
                height={svgHeight}
                role="presentation"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                width={svgWidth}
              >
                {/*
            At rest the surface is this rect. In flight the svg spans the
            union of both sizes, so the canvas (whose size tweens) paints the
            surface instead and the background never pops to the union box.
          */}
                {!plan && (
                  <rect
                    fill="var(--chart-background)"
                    height={svgHeight}
                    width={svgWidth}
                    x={0}
                    y={0}
                  />
                )}
                {firstReveal
                  ? layout.links.map((link) => (
                      <DrawPath
                        d={link.d}
                        data-slot="tree-link"
                        delay={stagger(Math.max(0, link.depth - 1), 0, CHART_STAGGER_BAR_MS)}
                        key={link.id}
                        stroke={TREE_LINK_COLOR}
                        strokeWidth={TREE_LINK_WIDTH}
                      />
                    ))
                  : (plan ? plan.links : layout.links).map((link) => (
                      <TreeLink
                        d={restingLinkD.get(link.id) ?? ""}
                        key={link.id}
                        link={link}
                        plan={plan}
                        progress={progress}
                      />
                    ))}
                {!hasCustomNodes &&
                  drawnNodes.map(({ node, exiting }) => {
                    if (node.isPill) {
                      const label = node.name;
                      const w = pillWidth(label);
                      return (
                        <g
                          data-slot="tree-collapsed"
                          key={node.id}
                          onMouseEnter={(event) => handleEnter(node, event)}
                          onMouseLeave={clearTooltip}
                          onMouseMove={(event) => handleEnter(node, event)}
                        >
                          <rect
                            className="cursor-default"
                            fill="var(--chart-mono-3)"
                            height={PILL_HEIGHT}
                            rx={PILL_HEIGHT / 2}
                            ry={PILL_HEIGHT / 2}
                            width={w}
                            x={node.x - w / 2}
                            y={node.y - PILL_HEIGHT / 2}
                          />
                          <HaloText
                            className="text-chart-value tabular-nums"
                            data-slot="tree-collapsed-label"
                            dominantBaseline="middle"
                            fill="var(--chart-foreground)"
                            halo="var(--chart-mono-3)"
                            textAnchor="middle"
                            x={node.x}
                            y={node.y}
                          >
                            {label}
                          </HaloText>
                        </g>
                      );
                    }
                    if (!collapsible) {
                      // The static chart: today's markup, pointer handlers on the drawing.
                      const offset = labelOffset(orientation, node.labelPlacement, nodeRadius);
                      const target = datapointsEnabled
                        ? legacyTargets.find((t) => t.id === node.id)
                        : undefined;
                      return (
                        <g
                          className={cn(datapointsEnabled && "cursor-pointer")}
                          data-slot="tree-node"
                          data-tree-node-id={node.id}
                          key={node.id}
                          onClick={
                            target
                              ? (event) => activateDatapoint?.(target, event, "pointer")
                              : undefined
                          }
                          onMouseEnter={(event) => handleEnter(node, event)}
                          onMouseLeave={clearTooltip}
                          onMouseMove={(event) => handleEnter(node, event)}
                        >
                          <circle cx={node.x} cy={node.y} fill={node.color} r={nodeRadius} />
                          <HaloText
                            className="text-chart-value"
                            data-slot="tree-node-label"
                            dominantBaseline={offset.dominantBaseline}
                            textAnchor={offset.textAnchor}
                            transform={
                              offset.rotate
                                ? `rotate(${offset.rotate} ${node.x + offset.dx} ${node.y + offset.dy})`
                                : undefined
                            }
                            x={node.x + offset.dx}
                            y={node.y + offset.dy}
                          >
                            {node.name}
                          </HaloText>
                        </g>
                      );
                    }
                    return (
                      <TreeDotNode
                        before={flight.before}
                        exiting={exiting}
                        key={node.id}
                        node={node}
                        nodeRadius={nodeRadius}
                        orientation={orientation}
                        plan={plan}
                        progress={progress}
                      />
                    );
                  })}
              </svg>

              {renderLink && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  data-slot="tree-chart-links"
                  inert
                >
                  {(plan ? plan.links : layout.links).map((link) => {
                    const props = linkRenderProps(link);
                    if (!props) return null;
                    return (
                      <TreeLinkDecoration
                        key={link.id}
                        link={link}
                        plan={plan}
                        progress={progress}
                        rest={restingLinkMid.get(link.id) ?? null}
                      >
                        {(renderLink as (props: TreeChartLinkRenderProps) => ReactNode)(props)}
                      </TreeLinkDecoration>
                    );
                  })}
                </div>
              )}

              {hasCustomNodes && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  data-slot="tree-chart-nodes"
                  inert
                >
                  {drawnNodes
                    .filter(({ node }) => !node.isPill)
                    .map(({ node, exiting }) => (
                      <TreeCardNode
                        before={flight.before}
                        exiting={exiting}
                        key={node.id}
                        node={node}
                        orientation={orientation}
                        plan={plan}
                        progress={progress}
                      >
                        {(renderNode as (props: TreeChartNodeRenderProps) => ReactNode)(
                          renderProps(node),
                        )}
                      </TreeCardNode>
                    ))}
                </div>
              )}

              {tooltip && (
                <ChartTooltipBox
                  avoid={tooltip.node.hit}
                  containerHeight={layout.height}
                  containerRef={canvasRef}
                  containerWidth={layout.width}
                  visible
                  x={tooltip.x}
                  y={tooltip.y}
                >
                  <ChartTooltipContent
                    rows={
                      [
                        {
                          color: tooltip.node.color,
                          label: "Path",
                          value: tooltip.node.path.join(" › "),
                        },
                        ...(tooltip.node.isLeaf && !tooltip.node.isPill
                          ? []
                          : [
                              {
                                color: tooltip.node.color,
                                label: tooltip.node.isPill ? "Hidden leaves" : "Members",
                                value: tooltip.node.descendantLeafCount,
                              },
                            ]),
                      ] satisfies TooltipRow[]
                    }
                    title={
                      tooltip.node.isPill
                        ? tooltip.node.path.slice(0, -1).join(" › ")
                        : tooltip.node.name
                    }
                  />
                </ChartTooltipBox>
              )}

              {collapsible ? (
                treeActive && (
                  <TreeChartTreeLayer
                    activeId={activeId}
                    canActivate={canActivate}
                    expanded={expanded}
                    label={accessibleLabel || t("charts.datapointLayer.label")}
                    layout={layout}
                    nameOf={nameOf}
                    onActivate={(node, event, source) =>
                      activateDatapoint?.(targetFor(node, true), event, source)
                    }
                    onActiveChange={setChosenActiveId}
                    onEscape={clearTooltip}
                    onExpandedChange={handleExpandedChange}
                    onItemFocus={
                      dotTooltips ? (node) => setTooltip({ node, x: node.x, y: node.y }) : undefined
                    }
                    onItemLeave={dotTooltips ? clearTooltip : undefined}
                    onItemPointer={dotTooltips ? pointerTooltip : undefined}
                    onTreeBlur={clearTooltip}
                    resolved={resolved}
                    shape={hasCustomNodes ? "box" : "dot"}
                  />
                )
              ) : (
                <ChartDatapointLayer />
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </ChartPlotRoot>
  );

  if (!hasViewport) return chart;

  // The frame holds the chart and the corner panels, which stay put while the
  // chart scrolls under them — the shape of `CanvasShell` and its `Panel`s.
  // A zoomable chart is a canvas: the whole box is the chart's surface, so a
  // pan moves the tree across it rather than a patch of surface across the page.
  return (
    <div
      className={cn("relative h-full w-full", zoomable && "bg-chart-background", className)}
      data-slot="tree-chart-frame"
    >
      {chart}
      {status !== "loading" && (
        // Keyboard-reachable zoom/fit controls and the minimap both act on the tree's
        // measured layout, so they stay out of the DOM while `status: "loading"` hides
        // it behind the skeleton — otherwise a keyboard user could tab into a control
        // that operates on a chart they cannot see yet (RM-184 review).
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-end justify-end gap-2 p-3"
          data-slot="tree-chart-viewport"
        >
          {minimap && (
            <TreeChartMiniMap
              height={layout.height}
              interactive={interactions.active}
              nodes={layout.nodes.filter((n) => !n.isPill).map((n) => ({ id: n.id, ...n.hit }))}
              onCenter={centerViewOn}
              viewport={viewRect}
              width={layout.width}
            />
          )}
          {zoomGestures && (
            <TreeChartZoomControls
              max={zoomMax}
              min={zoomMin}
              onFitView={() => fitView(layout.width, layout.height)}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              zoom={zoom}
            />
          )}
        </div>
      )}
    </div>
  );
});

/**
 * `TreeChart`: a fixed-spacing hierarchy diagram, left to right or top to
 * bottom. Every node carries the same visual weight (no `value`, no area),
 * so it answers "who belongs to whom", never "how big is each part" (that is
 * `TreemapChart`'s question). Branches open and close with an animated
 * transition, by pointer or keyboard; nodes can be your own components
 * (`renderNode`). Token-driven and theme-safe.
 *
 * @dataShape a hierarchy read as a branching tree rather than as sized rectangles
 * @dataShape a metric decomposed into driver metrics — a KPI or driver tree
 * @avoidWhen size, not structure, is the point — use a treemap
 */
export const TreeChart = forwardRef<HTMLDivElement, TreeChartProps>(function TreeChart(props, ref) {
  const resolved = useResolvedChartProps(TREE_CHART, props);
  const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } =
    resolved;
  // ALWAYS the same element tree: adding or dropping a handler must not
  // remount the body (and lose its open branches, focus and flight). Without
  // one the provider is `disabled`: no context, no layer, no extra DOM.
  return (
    <ChartDatapointProvider
      copyValueOnActivate={copyValueOnActivate}
      disabled={!onDatapointClick && !copyValueOnActivate}
      datapointLabel={
        (datapointLabel ?? defaultTreeDatapointLabel) as unknown as ChartDatapointProviderLabel
      }
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      onDatapointClick={onDatapointClick}
    >
      <TreeChartBody {...resolved} ref={ref} />
    </ChartDatapointProvider>
  );
}) as (<TData = unknown>(
  props: TreeChartProps<TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null) & { displayName?: string };

/**
 * The provider's `datapointLabel` is typed against the DEFAULT datum
 * (`Record<string, unknown>`), while `defaultTreeDatapointLabel` is typed
 * against the narrower `TreeDatapointDatum`. The cast through `unknown` is
 * that one variance step, named here rather than hidden at the call site:
 * the runtime shape is exactly what `targetFor` builds.
 */
type ChartDatapointProviderLabel = React.ComponentProps<
  typeof ChartDatapointProvider
>["datapointLabel"];

TreeChart.displayName = "TreeChart";

export default TreeChart;
