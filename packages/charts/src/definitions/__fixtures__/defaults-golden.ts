/**
 * defaults-golden.ts — the frozen, hand-authored default VALUES for every chart whose body
 * calls `useResolvedChartProps` (RM-183 review, major finding).
 *
 * The "defaults parity" suite in `definitions.test.ts` renders a fixture bare, then renders it
 * again with `resolveProps(definition, fixture.props)` (every default filled in explicitly), and
 * compares the DOM. Both renders go through the SAME component, which reads its defaults from
 * the SAME `CHART_DEFINITIONS[id].defaults` object — so mutating a definition's default (e.g.
 * `FUNNEL_CHART.defaults.grid` from `false` to `true`) moves BOTH renders together and the parity
 * suite stays green. Proven by the review: flipping `FunnelChart`'s `grid` default and `PieChart`'s
 * `hoverOffset` default left every "defaults parity" case passing, even though each family's
 * actual rendered markup changed.
 *
 * This file is the independent ground truth `contract-golden.ts` already established for
 * `contract`: literal values HAND-COPIED from each component's own destructuring defaults
 * (`charts/<name>-chart.tsx`, at 6f45a1478695631eb088b9b16266ec2a11a1faff — the six families'
 * `useResolvedChartProps` adoption), never imported from the definition being checked. A
 * definition's `defaults` no longer matching its row here is real drift, caught by a plain
 * `toStrictEqual`, independent of any render.
 *
 * Scope: only the families that adopt `useResolvedChartProps` as of RM-183 (the six radial/
 * part-to-whole families). The cartesian families adopt the hook in a later, disjoint lane; this
 * file's completeness check only requires a row for every chart component file that actually
 * calls the hook, so it grows with future adoption rather than needing every family up front.
 *
 * Test-only: never imported by shipped code. `charts-definitions-pure`'s root walk skips
 * `__fixtures__/**` (RM-175), so this file is exempt from the definitions tree's runtime-purity
 * requirement the same way every other fixture under this directory is.
 */

import type { ChartDefinitionId } from "../registry";

/** `PieChart` — `charts/pie-chart.tsx`'s own destructuring defaults. */
const PIE_CHART_GOLDEN = {
  innerRadius: 0,
  padAngle: 0,
  cornerRadius: 0,
  startAngle: -Math.PI / 2,
  endAngle: (3 * Math.PI) / 2,
  className: "",
  hoverOffset: 10,
  enterStaggerScale: 1,
  geometryScrubbing: false,
  seams: 0,
  half: false,
  align: "start",
};

/** `RingChart` — `charts/ring-chart.tsx`'s own destructuring defaults. */
const RING_CHART_GOLDEN = {
  strokeWidth: 12,
  ringGap: 6,
  baseInnerRadius: 60,
  className: "",
  startAngle: -Math.PI / 2,
  endAngle: (3 * Math.PI) / 2,
  animationDuration: 1100,
  enterStaggerScale: 1,
  geometryScrubbing: false,
};

/** `FunnelChart` — `charts/funnel-chart.tsx`'s own destructuring defaults. */
const FUNNEL_CHART_GOLDEN = {
  orientation: "horizontal",
  color: "var(--chart-1)",
  layers: 3,
  showPercentage: true,
  showValues: true,
  showLabels: true,
  staggerDelay: 0.12,
  gap: 4,
  edges: "curved",
  labelLayout: "spread",
  labelAlign: "center",
  showConversion: false,
  // Wave-2 review fix: `FunnelChartBody` destructures `grid: gridProp = false`.
  grid: false,
};

/** `RadarChart` — `charts/radar-chart.tsx`'s own destructuring defaults. */
const RADAR_CHART_GOLDEN = {
  levels: 5,
  // F33: still a plain number (the kind default), never a `Margin` object.
  margin: 60,
  animate: true,
  enterDurationMs: 1100,
  staggerScale: 1,
  motionReplayKey: "",
  className: "",
};

/** `UnitChart` — `charts/unit-chart.tsx`'s own destructuring defaults. */
const UNIT_CHART_GOLDEN = {
  total: 100,
  unit: 1,
  columns: 10,
  mark: "dot",
  showArithmetic: true,
  sort: "none",
  tooltip: true,
};

/** `BulletChart` — `charts/bullet-chart.tsx`'s own destructuring defaults. */
const BULLET_CHART_GOLDEN = {
  orientation: "horizontal",
  size: "sm",
  higherIsBetter: true,
};

export const DEFAULTS_GOLDEN: Readonly<
  Partial<Record<ChartDefinitionId, Record<string, unknown>>>
> = {
  PieChart: PIE_CHART_GOLDEN,
  RingChart: RING_CHART_GOLDEN,
  FunnelChart: FUNNEL_CHART_GOLDEN,
  RadarChart: RADAR_CHART_GOLDEN,
  UnitChart: UNIT_CHART_GOLDEN,
  BulletChart: BULLET_CHART_GOLDEN,
};
