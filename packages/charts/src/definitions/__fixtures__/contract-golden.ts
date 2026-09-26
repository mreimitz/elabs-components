/**
 * contract-golden.ts — the frozen, hand-authored per-family contract values (RM-177 review,
 * major finding).
 *
 * `CHART_CONTRACT_SPECS` (`../../test/doubles.ts`) is now DERIVED from `CHART_DEFINITIONS`
 * (`contractSpecsFromDefinitions`), so `CHART_DEFINITIONS[id].contract` and
 * `CHART_CONTRACT_SPECS[id]` are the SAME object — comparing them (as the old "golden contract"
 * suite did) is a tautology, not a test. This file is what that suite compares against instead:
 * the exact object literal `test/doubles.tsx` hand-kept before RM-177 (base commit d72c6506,
 * lines 92–363), moved here VERBATIM, including the `dateXKey` helper and every per-family
 * comment.
 *
 * This is the one place a chart family's runtime value-contract is pinned by VALUE rather than
 * by identity. A rename item (wave 4, e.g. HeatmapChart's `x` → `xDataKey`) that changes a
 * `contract` field on a definition is EXPECTED to also update this file — deliberately, in the
 * same PR, never as a drive-by. `definitions.test.ts`'s golden suite fails until it does.
 *
 * Test-only: never imported by shipped code. `charts-definitions-pure`'s root walk skips
 * `__fixtures__/**` (RM-175), so this file is exempt from the definitions tree's runtime-purity
 * requirement the same way every other fixture under this directory is.
 */

import type { ChartContractSpec } from "../contract-types";
import type { ChartDefinitionId } from "../registry";

const dateXKey = (defaultKey: string, requireDate: boolean) => ({
  prop: "xDataKey",
  default: defaultKey,
  requireDate,
});

export const CONTRACT_GOLDEN: Record<ChartDefinitionId, ChartContractSpec> = {
  AreaChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: dateXKey("date", true),
    numericProps: ["animationDuration", "yDomainTweenDuration"],
    seriesFromChildren: true,
  },
  BarChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: dateXKey("name", false),
    numericProps: ["animationDuration", "barGap", "barWidth", "stackGap"],
    seriesFromChildren: true,
  },
  LineChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: dateXKey("date", true),
    numericProps: ["animationDuration", "yDomainTweenDuration"],
    seriesFromChildren: true,
  },
  ComposedChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: dateXKey("date", true),
    numericProps: ["animationDuration"],
    seriesFromChildren: true,
  },
  ScatterChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: false,
    xKey: dateXKey("date", false),
    numericProps: ["animationDuration"],
    seriesFromChildren: true,
  },
  CandlestickChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: false,
    xKey: dateXKey("date", true),
    numericProps: ["animationDuration"],
  },
  LiveLineChart: {
    dataKind: "array",
    requiredProps: ["data", "children", "value"],
    hasStatus: false,
    itemRequiredKeys: ["time", "value"],
    itemNumericKeys: ["time", "value"],
  },
  PieChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: false,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
  },
  RingChart: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: false,
    itemRequiredKeys: ["label", "value", "maxValue"],
    itemNumericKeys: ["value", "maxValue"],
  },
  FunnelChart: {
    dataKind: "array",
    requiredProps: ["data"],
    hasStatus: false,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
  },
  RadarChart: {
    dataKind: "array",
    requiredProps: ["data", "metrics", "children"],
    hasStatus: false,
    itemRequiredKeys: ["label", "values"],
  },
  ChoroplethChart: {
    dataKind: "feature-collection",
    requiredProps: ["data", "children"],
  },
  SankeyChart: {
    dataKind: "sankey",
    requiredProps: ["data", "children"],
  },
  // DensityScatterChart: `data` is columnar ({ x, y }) past ~50k and rows
  // below — neither shape is "array of rows with named keys", so the double
  // asserts the prop is present and leaves the shape to the chart's converter.
  DensityScatterChart: {
    dataKind: "none",
    requiredProps: ["data"],
  },
  // Heatmap — RM-021. The three grid keys are all caller-named, and only the
  // calendar variant reads `x` as a date — see `propNamedKeys`.
  HeatmapChart: {
    dataKind: "array",
    requiredProps: ["data", "x", "y", "valueKey"],
    propNamedKeys: [
      { prop: "x" },
      { prop: "y", onlyWhen: { prop: "variant", equals: "matrix" } },
      { prop: "valueKey" },
      { prop: "x", onlyWhen: { prop: "variant", equals: "calendar" }, requireDate: true },
    ],
  },
  Gantt: {
    dataProp: "tasks",
    dataKind: "array",
    requiredProps: ["tasks"],
    itemRequiredKeys: ["id", "name", "start", "end"],
    dateItemKeys: ["start", "end"],
  },
  // Dumbbell — RM-023. `groupBy` — RM-116: optional, so a caller who never
  // groups their rows checks nothing extra; a caller who does gets the same
  // "does this column exist" floor every other nominated column gets.
  DumbbellChart: {
    dataKind: "array",
    requiredProps: ["data", "category", "startKey", "endKey"],
    hasStatus: false,
    dynamicKeys: [
      { prop: "category" },
      { prop: "startKey", numeric: true },
      { prop: "endKey", numeric: true },
    ],
    keyProps: [{ prop: "groupBy", numeric: false }],
  },
  // Bullet — RM-061. A single scalar KPI value, not a data array — `dataKind:
  // "none"` skips every array/row check, so the one thing a mocked test can
  // still fail on is a missing `value` and a non-finite `target`/`comparative`.
  BulletChart: {
    dataKind: "none",
    requiredProps: ["value"],
    numericProps: ["target", "comparative", "min", "max"],
  },
  UnitChart: {
    dataKind: "array",
    requiredProps: ["data", "layout"],
  },
  // Waterfall — RM-022
  WaterfallChart: {
    dataKind: "array",
    requiredProps: ["data"],
    hasStatus: false,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
  },
  // Treemap — RM-025
  TreemapChart: {
    dataKind: "hierarchy",
    requiredProps: ["data"],
  },
  // DistributionChart — RM-026
  // The real container reads exactly two columns off every row and puts one of
  // them on a NUMERIC scale, so those are the two things a mocked test must
  // still fail on: a `valueKey` whose column is missing (`itemRequiredKeys`) or
  // non-numeric (`itemNumericKeys`), and a declared `groupKey` whose column is
  // absent. Both are driven by PROP-NAMED keys, which is why they use the
  // `keyProps` form rather than a fixed key list — see `contract.ts`.
  // Deliberately NOT `hasStatus`: this family has no `status` prop, so an empty
  // `data` array is a violation here rather than a legitimate loading state.
  DistributionChart: {
    dataKind: "array",
    requiredProps: ["data", "valueKey", "kind"],
    keyProps: [
      { prop: "valueKey", numeric: true },
      { prop: "groupKey", numeric: false },
    ],
  },
  // Bump — RM-033
  // `period` and `entity` name the two columns every row must own (the
  // DumbbellChart `dynamicKeys` shape, not a fixed key list — the caller picks
  // the column names). `valueKey`/`rankKey` are both optional `keyProps`: the
  // real component derives rank from `valueKey` whenever `rankKey` is absent,
  // so neither one alone is required — only that whichever IS passed names a
  // real, numeric column.
  BumpChart: {
    dataKind: "array",
    requiredProps: ["data", "period", "entity"],
    hasStatus: false,
    dynamicKeys: [{ prop: "period" }, { prop: "entity" }],
    keyProps: [
      { prop: "valueKey", numeric: true },
      { prop: "rankKey", numeric: true },
    ],
  },
  // ParallelCoordinates — RM-034
  // `entity` names a single column (the existing single-key `dynamicKeys`
  // form); `dimensions` is an ARRAY OF OBJECTS, each naming one more numeric
  // column via its `key` field (the `arrayOf` generalization of the same
  // field — see `contract.ts`). 3–6 axes, every one numeric on every row.
  ParallelCoordinatesChart: {
    dataKind: "array",
    requiredProps: ["data", "entity", "dimensions"],
    dynamicKeys: [
      { prop: "entity" },
      { prop: "dimensions", numeric: true, arrayOf: { field: "key", min: 3, max: 6 } },
    ],
  },
  // Tree — RM-035
  // A tree node has no `value` (membership only), so it gets its own shape
  // check rather than the treemap's `"hierarchy"` one. `defaultExpandedDepth`
  // is left out of `numericProps`: `Infinity` ("every branch open") is valid.
  TreeChart: {
    dataKind: "tree",
    requiredProps: ["data"],
    numericProps: ["nodeSize", "nodeWidth", "nodeHeight", "collapseDepth"],
  },
  // Network — RM-036
  // A graph is TWO arrays that reference each other, so the primary data prop
  // is `nodes` and the edge list gets the relational check (`edgeProp`) — an
  // edge naming a node that is not in `nodes` is the failure a mocked test
  // would otherwise never see. Deliberately NOT `hasStatus`: this family has no
  // `status` prop, so an empty `nodes` array is a violation, not a loading
  // state.
  NetworkChart: {
    dataProp: "nodes",
    dataKind: "array",
    requiredProps: ["nodes", "links", "layout"],
    itemRequiredKeys: ["id"],
    itemNumericKeys: ["value"],
    numericProps: ["labelThreshold", "maxNodes", "seed"],
    edgeProp: { prop: "links" },
  },
};
