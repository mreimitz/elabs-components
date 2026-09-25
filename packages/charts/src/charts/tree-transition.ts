/**
 * Expand/collapse motion for `TreeChart`, as plain math: no React, no DOM, no
 * timers. A layout becomes a {@link TreeFrame} (where every node sits, how
 * opaque it is, how big the canvas is). Two frames become a
 * {@link TreeTransitionPlan}, and {@link frameAt} reads the plan at any
 * progress `t` in `[0, 1]`. The component drives `t` with one tween; this
 * module decides what moves where.
 *
 * The rules, chosen so the tree reads as one object folding and unfolding:
 *
 * - An ENTERING node grows out of its nearest ancestor's position in the
 *   PREVIOUS frame, so children appear to leave their parent. It stays
 *   invisible for the first half of the flight and fades in over the second,
 *   so a whole level opening at once never shows as a pile of half-drawn
 *   copies on top of the parent.
 * - An EXITING node folds into its nearest surviving ancestor's position in
 *   the NEXT frame, so children return into the parent even while the parent
 *   itself is moving. It is gone by mid-flight, before the folding copies
 *   converge on the parent and overprint each other.
 * - Every other node moves in a straight line from its old to its new place.
 * - Links are never tweened as paths. Each one is rebuilt every frame from
 *   its two endpoint nodes, so a link can never detach from the nodes it
 *   joins, in any browser. An orientation switch blends the curve's control
 *   points from the horizontal to the vertical form.
 *
 * Interrupting a flight is a snapshot: {@link frameAt} at the current `t`
 * becomes the next plan's starting frame, exiting nodes and all.
 */

import type { TreeOrientation } from "./tree-chart";

// ── Frames ──────────────────────────────────────────────────────────────────

export interface TreeFrameNode {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  opacity: number;
}

export interface TreeFrameLink {
  /** A link is named by its child: one parent per node. */
  id: string;
  sourceId: string;
  targetId: string;
}

/** Where the drawn link meets each node, relative to the node's centre. */
export interface TreeLinkAnchor {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface TreeFrame {
  nodes: TreeFrameNode[];
  links: TreeFrameLink[];
  width: number;
  height: number;
  /** `0` = horizontal curve (`"lr"`), `1` = vertical curve (`"tb"`); fractional mid-switch. */
  linkForm: number;
  anchor: TreeLinkAnchor;
}

/** The subset of a tree layout a frame is built from (structurally a `TreeLayoutResult`). */
export interface TreeFrameSource {
  nodes: ReadonlyArray<{ id: string; parentId: string | null; x: number; y: number }>;
  links: ReadonlyArray<TreeFrameLink>;
  width: number;
  height: number;
  orientation: TreeOrientation;
  nodeBox: { width: number; height: number } | null;
}

/** The resting frame of a layout: every node where the layout put it, fully opaque. */
export function frameFromLayout(layout: TreeFrameSource): TreeFrame {
  const box = layout.nodeBox;
  const anchor: TreeLinkAnchor = !box
    ? { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 }
    : layout.orientation === "lr"
      ? { sourceX: box.width / 2, sourceY: 0, targetX: -box.width / 2, targetY: 0 }
      : { sourceX: 0, sourceY: box.height / 2, targetX: 0, targetY: -box.height / 2 };
  return {
    nodes: layout.nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      x: n.x,
      y: n.y,
      opacity: 1,
    })),
    links: layout.links.map((l) => ({ id: l.id, sourceId: l.sourceId, targetId: l.targetId })),
    width: layout.width,
    height: layout.height,
    linkForm: layout.orientation === "tb" ? 1 : 0,
    anchor,
  };
}

// ── Plans ───────────────────────────────────────────────────────────────────

export type TreeTransitionKind = "enter" | "exit" | "update";

interface NodeState {
  x: number;
  y: number;
  opacity: number;
}

export interface TreePlanNode {
  id: string;
  parentId: string | null;
  kind: TreeTransitionKind;
  from: NodeState;
  to: NodeState;
}

export interface TreePlanLink extends TreeFrameLink {
  kind: TreeTransitionKind;
}

interface FrameShape {
  width: number;
  height: number;
  linkForm: number;
  anchor: TreeLinkAnchor;
}

export interface TreeTransitionPlan {
  /** Every node of either frame — entering, exiting and moving. */
  nodes: TreePlanNode[];
  byId: ReadonlyMap<string, TreePlanNode>;
  links: TreePlanLink[];
  from: FrameShape;
  to: FrameShape;
  /** The frame the plan lands on at `t = 1` (exits removed). */
  target: TreeFrame;
}

/** Below this, a coordinate or size change is invisible and not worth a flight. */
const EPSILON = 0.5;
/** Below this, a node is treated as already gone. */
const OPACITY_EPSILON = 0.01;

function close(a: number, b: number, eps = EPSILON): boolean {
  return Math.abs(a - b) <= eps;
}

function anchorsEqual(a: TreeLinkAnchor, b: TreeLinkAnchor): boolean {
  return (
    close(a.sourceX, b.sourceX) &&
    close(a.sourceY, b.sourceY) &&
    close(a.targetX, b.targetX) &&
    close(a.targetY, b.targetY)
  );
}

/** Two frames that would paint the same picture (within half a pixel). */
export function framesEqual(a: TreeFrame, b: TreeFrame): boolean {
  if (
    !close(a.width, b.width) ||
    !close(a.height, b.height) ||
    !close(a.linkForm, b.linkForm, 0.001) ||
    !anchorsEqual(a.anchor, b.anchor) ||
    a.nodes.length !== b.nodes.length ||
    a.links.length !== b.links.length
  ) {
    return false;
  }
  const byId = new Map(b.nodes.map((n) => [n.id, n]));
  for (const n of a.nodes) {
    const m = byId.get(n.id);
    if (!m || !close(n.x, m.x) || !close(n.y, m.y) || !close(n.opacity, m.opacity, 0.01)) {
      return false;
    }
  }
  const linkIds = new Set(b.links.map((l) => l.id));
  return a.links.every((l) => linkIds.has(l.id));
}

function shapeOf(frame: TreeFrame): FrameShape {
  return {
    width: frame.width,
    height: frame.height,
    linkForm: frame.linkForm,
    anchor: frame.anchor,
  };
}

/**
 * Plans the flight from `prev` (a resting frame, or a mid-flight snapshot) to
 * `next`. Returns `null` when there is nothing to animate: no previous frame
 * (first paint) or two frames that already look the same.
 */
export function planTreeTransition(
  prev: TreeFrame | null,
  next: TreeFrame,
): TreeTransitionPlan | null {
  if (!prev) return null;
  // A node that had already faded out of the previous flight is gone; it
  // must not re-enter the plan as a zero-opacity exit.
  const nextIds = new Set(next.nodes.map((n) => n.id));
  const prevNodes = prev.nodes.filter((n) => n.opacity > OPACITY_EPSILON || nextIds.has(n.id));
  const prevFrame: TreeFrame = { ...prev, nodes: prevNodes };
  const target: TreeFrame = { ...next, nodes: next.nodes.map((n) => ({ ...n, opacity: 1 })) };
  if (framesEqual(prevFrame, target)) return null;

  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  const nextById = new Map(target.nodes.map((n) => [n.id, n]));

  const nodes: TreePlanNode[] = [];
  for (const n of target.nodes) {
    const before = prevById.get(n.id);
    if (before) {
      nodes.push({
        id: n.id,
        parentId: n.parentId,
        kind: "update",
        from: { x: before.x, y: before.y, opacity: before.opacity },
        to: { x: n.x, y: n.y, opacity: 1 },
      });
      continue;
    }
    // ENTER: out of the nearest ancestor that was on screen before.
    let origin: TreeFrameNode | undefined;
    for (let pid = n.parentId; pid != null && !origin; pid = nextById.get(pid)?.parentId ?? null) {
      origin = prevById.get(pid);
    }
    nodes.push({
      id: n.id,
      parentId: n.parentId,
      kind: "enter",
      from: { x: origin?.x ?? n.x, y: origin?.y ?? n.y, opacity: 0 },
      to: { x: n.x, y: n.y, opacity: 1 },
    });
  }
  for (const n of prevNodes) {
    if (nextById.has(n.id)) continue;
    // EXIT: into the nearest ancestor that stays, at its NEW position.
    let sink: TreeFrameNode | undefined;
    for (let pid = n.parentId; pid != null && !sink; pid = prevById.get(pid)?.parentId ?? null) {
      sink = nextById.get(pid);
    }
    nodes.push({
      id: n.id,
      parentId: n.parentId,
      kind: "exit",
      from: { x: n.x, y: n.y, opacity: n.opacity },
      to: { x: sink?.x ?? n.x, y: sink?.y ?? n.y, opacity: 0 },
    });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const links: TreePlanLink[] = [];
  const seen = new Set<string>();
  for (const l of target.links) {
    seen.add(l.id);
    links.push({ ...l, kind: byId.get(l.targetId)?.kind ?? "update" });
  }
  for (const l of prev.links) {
    if (seen.has(l.id) || !byId.has(l.targetId) || !byId.has(l.sourceId)) continue;
    links.push({ ...l, kind: "exit" });
  }

  return { nodes, byId, links, from: shapeOf(prevFrame), to: shapeOf(target), target };
}

// ── Reading a plan ──────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * The share of a flight's progress over which a leaving node fades out, and
 * after which an arriving one starts fading in. Progress is already eased, so
 * half the progress is well under half the time: leaving copies are gone
 * before they bunch up on their parent, and arriving ones show as they settle.
 */
const FADE_SPLIT = 0.5;

/** Opacity of something LEAVING at progress `t`: `1` at the start, `0` from mid-flight on. */
export function fadeOutAt(t: number): number {
  return 1 - clamp01(t / FADE_SPLIT);
}

/** Opacity of something ARRIVING at progress `t`: `0` until mid-flight, then up to `1`. */
export function fadeInAt(t: number): number {
  return clamp01((t - FADE_SPLIT) / (1 - FADE_SPLIT));
}

/** One node's position and opacity at progress `t`. */
export function nodeAt(node: TreePlanNode, t: number): NodeState {
  const opacity =
    node.kind === "exit"
      ? node.from.opacity * fadeOutAt(t)
      : node.kind === "enter"
        ? lerp(node.from.opacity, node.to.opacity, fadeInAt(t))
        : lerp(node.from.opacity, node.to.opacity, t);
  return {
    x: lerp(node.from.x, node.to.x, t),
    y: lerp(node.from.y, node.to.y, t),
    opacity,
  };
}

/** Canvas size, link curve form and link anchors at progress `t`. */
export function sizeAt(plan: TreeTransitionPlan, t: number): FrameShape {
  const { from, to } = plan;
  return {
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    linkForm: lerp(from.linkForm, to.linkForm, t),
    anchor: {
      sourceX: lerp(from.anchor.sourceX, to.anchor.sourceX, t),
      sourceY: lerp(from.anchor.sourceY, to.anchor.sourceY, t),
      targetX: lerp(from.anchor.targetX, to.anchor.targetX, t),
      targetY: lerp(from.anchor.targetY, to.anchor.targetY, t),
    },
  };
}

/**
 * The link curve between two points: `form = 0` is d3's `linkHorizontal`
 * (`M s C mx,sy mx,ty t`), `form = 1` its `linkVertical`
 * (`M s C sx,my tx,my t`); anything between blends the control points.
 */
export function linkPath(sx: number, sy: number, tx: number, ty: number, form: number): string {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const c1x = lerp(mx, sx, form);
  const c1y = lerp(sy, my, form);
  const c2x = lerp(mx, tx, form);
  const c2y = lerp(ty, my, form);
  return `M${sx},${sy}C${c1x},${c1y},${c2x},${c2y},${tx},${ty}`;
}

/** One link's path and opacity at `t`: rebuilt from its endpoints, faded with its child. */
export function linkAt(
  plan: TreeTransitionPlan,
  link: TreeFrameLink,
  t: number,
): { d: string; opacity: number } {
  const source = plan.byId.get(link.sourceId);
  const target = plan.byId.get(link.targetId);
  if (!source || !target) return { d: "", opacity: 0 };
  const s = nodeAt(source, t);
  const e = nodeAt(target, t);
  const { anchor, linkForm } = sizeAt(plan, t);
  return {
    d: linkPath(
      s.x + anchor.sourceX,
      s.y + anchor.sourceY,
      e.x + anchor.targetX,
      e.y + anchor.targetY,
      linkForm,
    ),
    opacity: e.opacity,
  };
}

/** The whole picture at `t`, exiting nodes included — the snapshot an interruption starts from. */
export function frameAt(plan: TreeTransitionPlan, t: number): TreeFrame {
  if (t >= 1) return plan.target;
  const shape = sizeAt(plan, t);
  return {
    nodes: plan.nodes.map((n) => ({ id: n.id, parentId: n.parentId, ...nodeAt(n, t) })),
    links: plan.links.map(({ id, sourceId, targetId }) => ({ id, sourceId, targetId })),
    ...shape,
  };
}

// ── Where the scroller lands ────────────────────────────────────────────────

interface ScrollRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The subset of a tree layout the scroll target reads (structurally a `TreeLayoutResult`). */
export interface TreeScrollLayout {
  width: number;
  height: number;
  orientation: TreeOrientation;
  nodes: ReadonlyArray<{
    id: string;
    parentId: string | null;
    x: number;
    y: number;
    isExpanded: boolean;
    hit: ScrollRect;
    toggle: ScrollRect | null;
  }>;
}

export interface TreeScrollInput {
  /** The scroller's offsets and visible size when the change begins. */
  viewport: { left: number; top: number; width: number; height: number };
  /** The layout the change lands on. */
  layout: TreeScrollLayout;
  /** The node the reader opened or closed, and where it was drawn when the change began. */
  anchor?: { id: string; x: number; y: number } | null;
  /** Where the root was drawn when the change began; with `align: "center"` the view follows it. */
  root?: { x: number; y: number } | null;
  align: "start" | "center";
}

/**
 * Room kept between revealed nodes and the scroller's edge: clear of the
 * scroll-edge fade (20px) and the same as the items' `scroll-m-6`.
 */
export const REVEAL_PADDING = 24;

/** One axis of a "nearest" reveal; a box too big for the view is started or centred instead. */
function revealAxis(
  scroll: number,
  view: number,
  start: number,
  end: number,
  tooBig: "start" | "center",
): number {
  if (end - start > view) return tooBig === "start" ? start : (start + end - view) / 2;
  if (start < scroll) return start;
  if (end > scroll + view) return end - view;
  return scroll;
}

/**
 * Where the scroller should end up once a layout change lands.
 *
 * - With an anchor (the node the reader toggled), the view first keeps that
 *   node where it was on screen. If the toggle OPENED it, the view then moves
 *   the least it can to show the node together with its new children —
 *   opening a branch must reveal something — starting the view at the node
 *   along the growth axis and centring it across, when the family is bigger
 *   than the view.
 * - Without one, `align: "center"` keeps the root centred across the tree
 *   (and where it was along the growth axis): an "Expand all" or an
 *   orientation switch stays centred on the root instead of drifting.
 * - Otherwise the view stays put.
 *
 * The result is clamped to the final scroll range. Node positions move
 * linearly in the flight's progress, so the scroller can move linearly
 * between its start and this target and stay locked to the anchor.
 */
export function flightScrollTarget({ viewport, layout, anchor, root, align }: TreeScrollInput): {
  left: number;
  top: number;
} {
  let left = viewport.left;
  let top = viewport.top;
  const lr = layout.orientation === "lr";
  const anchorEnd = anchor ? layout.nodes.find((n) => n.id === anchor.id) : undefined;
  if (anchor && anchorEnd) {
    left += anchorEnd.x - anchor.x;
    top += anchorEnd.y - anchor.y;
    if (anchorEnd.isExpanded) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const n of layout.nodes) {
        if (n.id !== anchorEnd.id && n.parentId !== anchorEnd.id) continue;
        for (const r of n.toggle ? [n.hit, n.toggle] : [n.hit]) {
          x0 = Math.min(x0, r.x);
          y0 = Math.min(y0, r.y);
          x1 = Math.max(x1, r.x + r.width);
          y1 = Math.max(y1, r.y + r.height);
        }
      }
      const pad = REVEAL_PADDING;
      left = revealAxis(left, viewport.width, x0 - pad, x1 + pad, lr ? "start" : "center");
      top = revealAxis(top, viewport.height, y0 - pad, y1 + pad, lr ? "center" : "start");
    }
  } else if (!anchor && align === "center" && root) {
    const rootEnd = layout.nodes.find((n) => n.parentId === null);
    if (rootEnd) {
      if (lr) {
        left += rootEnd.x - root.x;
        top = rootEnd.y - viewport.height / 2;
      } else {
        left = rootEnd.x - viewport.width / 2;
        top += rootEnd.y - root.y;
      }
    }
  }
  const maxLeft = Math.max(0, layout.width - viewport.width);
  const maxTop = Math.max(0, layout.height - viewport.height);
  return {
    left: Math.min(maxLeft, Math.max(0, left)),
    top: Math.min(maxTop, Math.max(0, top)),
  };
}
