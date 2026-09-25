/**
 * The one place the built-in edges' paint defaults are declared.
 *
 * Every built-in edge draws through `FlowEdgePath`, which reads these values when an edge
 * passes no `stroke`/`strokeWidth` of its own and whenever it is `selected`. Before this
 * table existed, the resting width was a literal `1.5` in five edge files and only two of
 * the six edges showed selection at all.
 *
 * Deliberately React-free (no `@xyflow/react`, no JSX) so the pure modules that need a
 * value — the weight scale, the token halo — can import it without pulling in the engine.
 */
export interface FlowEdgeDefaults {
  /** Resting stroke paint — the `--flow-edge` token. */
  readonly stroke: string;
  /**
   * Resting stroke width, in px. The floor of `DEFAULT_EDGE_WIDTH_RANGE` is this value, so
   * a weighted edge with no `weight` draws exactly like a plain edge.
   */
  readonly strokeWidth: number;
  /**
   * Stroke paint of a selected edge — `--ring`, the same token `FlowNodeCard`'s selection
   * ring uses. Selection is not the focus indicator: `FlowEdgePath` draws focus on its own
   * two layers, so a selected edge that is also focused shows both.
   */
  readonly selectedStroke: string;
  /** How much wider, in px, a selected edge is than its resting width. */
  readonly selectedWidthIncrease: number;
}

/** The built-in edges' paint defaults — see {@link FlowEdgeDefaults}. */
export const FLOW_EDGE_DEFAULTS: FlowEdgeDefaults = Object.freeze({
  stroke: "var(--flow-edge)",
  strokeWidth: 1.5,
  selectedStroke: "var(--ring)",
  selectedWidthIncrease: 1.5,
});
