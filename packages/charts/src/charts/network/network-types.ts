/**
 * network-types — the vocabulary shared by `NetworkChart`, its three layout
 * modules and its marks (RM-036).
 *
 * Kept in its own module (rather than in `network-layout.ts`) so a layout under
 * `./layouts/` can name the shapes it produces without importing the
 * orchestrator that imports it back.
 */

/** One node of the graph. `id` is the identity every link references. */
export interface NetworkNodeDatum {
  /** Unique within the graph. Links reference this. */
  id: string;
  /** Display name. Falls back to `id`. */
  label?: string;
  /** The node's own weight. Absent → the node's DEGREE is used (see `resolveNodeWeight`). */
  value?: number;
  /** Category the node belongs to. Drives colour, and the two columns of `layout="arc"`. */
  group?: string;
}

/** One edge. `source`/`target` are node `id`s, never indices. */
export interface NetworkLinkDatum {
  source: string;
  target: string;
  /** Edge weight. Drives stroke width. */
  value?: number;
}

/**
 * - `force` — a settled force-directed cloud (G11, B2).
 * - `circular` — every node on one ring, chords bundled toward the centre (G6, B1).
 * - `arc` — bipartite: two columns joined by hairline béziers (L12 ownership).
 */
export type NetworkLayout = "force" | "circular" | "arc";

/** A point in the chart's own pixel space. */
export interface NetworkPoint {
  x: number;
  y: number;
}

/** Which column an `arc` node sits in. `undefined` for the other two layouts. */
export type NetworkSide = "left" | "right";

/** A node after layout: the datum plus everything the marks need to draw it. */
export interface NetworkNodeLayout extends NetworkNodeDatum {
  /** Position in the input `nodes` array — also the keyboard traversal order. */
  index: number;
  x: number;
  y: number;
  /** Drawn radius, in px. */
  r: number;
  /** Number of incident links. */
  degree: number;
  /** The number that drove `r` and `labelThreshold`: `value ?? degree`. */
  weight: number;
  /** A `var(--chart-…)` reference — never a literal. */
  color: string;
  /** Index into the resolved group list; `-1` when the node has no group. */
  groupIndex: number;
  /** Only meaningful for `layout="arc"`. */
  side?: NetworkSide;
  /**
   * Which side of the node its label hangs off — `"start"` draws to the right,
   * `"end"` to the left. Computed by the layout (radially outward on a ring,
   * away from the gap in a colonnade) so a label never crosses its own drawing.
   */
  labelAnchor: "start" | "end";
}

/** A link after layout: endpoints resolved, path built. */
export interface NetworkLinkLayout extends NetworkLinkDatum {
  /** Stable key: `"<source>→<target>#<i>"` (parallel edges keep distinct keys). */
  id: string;
  index: number;
  sourceIndex: number;
  targetIndex: number;
  /** SVG path `d` — a quadratic (circular), a cubic (arc) or a straight line (force). */
  path: string;
  /** Drawn stroke width, in px. */
  width: number;
}
