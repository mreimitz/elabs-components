/**
 * edge-aria — pure, framework-free "edge data → accessible name" naming seam
 * for `FlowWeightedEdge`, mirroring `weight-scale.ts`'s shape (no React, no
 * DOM, trivially unit-testable).
 *
 * `FlowWeightedEdge` encodes `data.weight` as stroke width and, optionally,
 * `data.value` as stroke colour — both purely visual. React Flow's own
 * `EdgeWrapper` sources an edge's accessible name from `edge.ariaLabel`
 * (`edge` object, not the edge COMPONENT — see issue #285), so the component
 * has no channel to set it. This module is the seam a caller runs their
 * `edges` array through instead.
 *
 * Naming contract (a decision, not an accident):
 *  1. An explicit `edge.ariaLabel` always wins — never overwritten.
 *  2. Otherwise compose `"Edge from <source> to <target>, weight <n>"`,
 *     appending `", <valueLabel> <n>"` when `data.value` is set and the pill
 *     text (`data.label`/`data.secondaryLabel`, space-joined) when either is
 *     present.
 *  3. When an edge carries none of `weight`/`value`/`label`/`secondaryLabel`,
 *     return `undefined` so React Flow's own default
 *     ("Edge from <source> to <target>") survives untouched.
 */

import type { BrandFlowWeightedEdge } from "./flow-weighted-edge";

export interface WeightedEdgeAriaOptions {
  /** Word used for the width measure in the composed name. @default "weight" */
  weightLabel?: string;
  /** Word used for the colour measure in the composed name. @default "value" */
  valueLabel?: string;
  /**
   * Map a node id to its display name, so the composed name says
   * "Edge from Order placed to Picked" rather than "Edge from n1 to n2". The
   * caller owns node display names (this module never reaches into a `nodes`
   * array), so it is a hook, not an automatic lookup.
   */
  nameOf?: (nodeId: string) => string;
  /** Format a numeric measure for display. @default String(n) */
  formatNumber?: (n: number) => string;
}

const DEFAULT_WEIGHT_LABEL = "weight";
const DEFAULT_VALUE_LABEL = "value";

function defaultNameOf(nodeId: string): string {
  return nodeId;
}

function defaultFormatNumber(n: number): string {
  return String(n);
}

/**
 * Derive one edge's accessible name from its weight/value/labels. Pure — no
 * React, no DOM. Returns:
 *  - the edge's own `ariaLabel`, unchanged, when the caller already set one;
 *  - a composed string when the edge carries `weight`, `value`, `label` or
 *    `secondaryLabel`;
 *  - `undefined` when there is nothing to add (so the default announcement
 *    from React Flow's `EdgeWrapper` survives untouched).
 */
export function buildWeightedEdgeAriaLabel(
  edge: BrandFlowWeightedEdge,
  opts: WeightedEdgeAriaOptions = {},
): string | undefined {
  if (edge.ariaLabel) return edge.ariaLabel;

  const { weight, value, label, secondaryLabel } = edge.data ?? {};
  if (weight === undefined && value === undefined && !label && !secondaryLabel) {
    return undefined;
  }

  const {
    weightLabel = DEFAULT_WEIGHT_LABEL,
    valueLabel = DEFAULT_VALUE_LABEL,
    nameOf = defaultNameOf,
    formatNumber = defaultFormatNumber,
  } = opts;

  const parts = [`Edge from ${nameOf(edge.source)} to ${nameOf(edge.target)}`];
  if (weight !== undefined) parts.push(`${weightLabel} ${formatNumber(weight)}`);
  if (value !== undefined) parts.push(`${valueLabel} ${formatNumber(value)}`);

  const pillText = [label, secondaryLabel].filter(Boolean).join(" ");
  if (pillText) parts.push(pillText);

  return parts.join(", ");
}

/**
 * Stamp `ariaLabel` onto every weighted edge that has none, per
 * `buildWeightedEdgeAriaLabel`'s naming contract. An edge that already
 * carries an `ariaLabel` is returned unchanged (never overwritten); an edge
 * with nothing to add is also returned unchanged, so an unrelated edge type
 * sharing this array keeps its identity.
 *
 * Returns a NEW array — memoize the call when used inline in render (e.g.
 * `useMemo(() => withWeightedEdgeAria(edges), [edges])`), or a consumer hands
 * React Flow a new `edges` identity every frame.
 */
export function withWeightedEdgeAria<E extends BrandFlowWeightedEdge>(
  edges: E[],
  opts?: WeightedEdgeAriaOptions,
): E[] {
  return edges.map((edge) => {
    if (edge.ariaLabel) return edge;
    const ariaLabel = buildWeightedEdgeAriaLabel(edge, opts);
    return ariaLabel === undefined ? edge : { ...edge, ariaLabel };
  });
}
