/**
 * doubles.tsx — the jsdom-safe chart components behind `@elabs-ai/components-charts/test`
 * (issue #364).
 *
 * WHY THIS EXISTS: `@visx/*` (SVG measurement — `ParentSize`/`ResizeObserver`,
 * `getTotalLength()`, …) does not render meaningfully under jsdom, so consumers
 * were mocking the whole `@elabs-ai/components-charts` barrel as a no-op — which hid real
 * chart-prop bugs from their quality gate (a fully green suite shipped the
 * item-8 `RangeError: Invalid time value` crash). Each double here is a FRESH,
 * dependency-free React implementation (never the real `@visx`-backed
 * component) that:
 *
 *   1. Runs `assertChartContract` (see `./contract.ts`) BEFORE rendering, so a
 *      test using the double still FAILS on a missing/invalid required prop —
 *      the assertion that proves this is not a no-op stub.
 *   2. Renders a single `data-slot="chart-test-double"` element carrying the
 *      real `useChartA11yContainerProps` a11y wiring (so a consumer's a11y
 *      assertions stay honest) plus a `data-chart-props` JSON summary a
 *      consumer's test can read back via `readChartDoubleProps`.
 *
 * Deliberately does NOT mount `children` into the DOM — it only INSPECTS them
 * (via `React.Children`) to validate declared series `dataKey`s. That is a
 * RENDERING property only: it does NOT mean a consumer can go without stand-ins
 * for the composition primitives. The documented wiring is a `vi.mock` factory,
 * and Vitest's proxy over a factory result THROWS on any omitted export the
 * moment the consumer's module reads the binding (`[vitest] No "Line" export is
 * defined on the … mock`) — before React ever sees the element. `./primitives.tsx`
 * supplies those inert stand-ins; see its header. If your test asserts on the
 * actual rendered markup of a series/axis/legend part, the double cannot help —
 * that is what the Storybook interaction/a11y suite
 * (`pnpm --filter @elabs-ai/components-docs test-storybook`) is for.
 *
 * ENGINE ISOLATION (enforced by `pnpm charts:test-double:check`): every
 * cross-module import from `../charts/**`/`../gantt/**`/`../auto-chart/**` in
 * this file MUST be `import type` — the one exception is `../charts/chart-a11y`
 * (react-only, zero visx) and `../charts/chart-phase` (zero imports at all).
 * Never import a barrel (`../charts`, `../gantt`, `../index`) — those pull
 * every `@visx/*`-backed chart.
 */
"use client";

import { Children, forwardRef, isValidElement, type CSSProperties, type ReactNode } from "react";
import { ChartA11yLabel, useChartA11yContainerProps } from "../charts/chart-a11y";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import {
  assertChartContract,
  assertChartSpecContract,
  buildChartDoublePayload,
  ChartContractError,
  type ChartContractSpec,
} from "./contract";

// Real, already-jsdom-safe components (verified: their import graphs touch only
// `react`, `lucide-react` and `@elabs-ai/components-ui` — zero `@visx`/`d3`/`motion`). Re-exporting
// the REAL implementation here means zero drift risk for these five — there is
// nothing to fake.
export { MetricCard, type MetricCardProps } from "@elabs-ai/components-ui";
export { MetricGrid } from "../metric-grid/metric-grid";
export type { MetricGridProps } from "../metric-grid/metric-grid";
export { ChartCard } from "../chart-card/chart-card";
export type { ChartCardProps } from "../chart-card/chart-card";
export { ChartFrame } from "../chart-frame/chart-frame";
export type { ChartFrameProps } from "../chart-frame/chart-frame";
export { Sparkline } from "../sparkline/sparkline";
export type { SparklineLabels, SparklineProps } from "../sparkline/sparkline";

// ── The per-family contract specs (the flat, auditable list) ────────────────

const dateXKey = (defaultKey: string, requireDate: boolean) => ({
  prop: "xDataKey",
  default: defaultKey,
  requireDate,
});

/** The finite key set — keeps indexed access typed as `ChartContractSpec`, never `| undefined`. */
export type ChartFamilyName =
  | "AreaChart"
  | "BarChart"
  | "LineChart"
  | "ComposedChart"
  | "ScatterChart"
  | "CandlestickChart"
  | "LiveLineChart"
  | "PieChart"
  | "RingChart"
  | "FunnelChart"
  | "RadarChart"
  | "ChoroplethChart"
  | "SankeyChart"
  | "Gantt"
  | "DumbbellChart"
  | "BulletChart"
  // Heatmap — RM-021
  | "HeatmapChart"
  | "UnitChart"
  // Treemap — RM-025
  | "TreemapChart"
  // DistributionChart — RM-026
  | "DistributionChart"
  // Waterfall — RM-022
  | "WaterfallChart"
  // Bump — RM-033
  | "BumpChart"
  // ParallelCoordinates — RM-034
  | "ParallelCoordinatesChart"
  // Tree — RM-035
  | "TreeChart"
  // Network — RM-036
  | "NetworkChart";

export const CHART_CONTRACT_SPECS: Record<ChartFamilyName, ChartContractSpec> = {
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
  TreeChart: {
    dataKind: "hierarchy",
    requiredProps: ["data"],
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

// ── The container factory ────────────────────────────────────────────────────

interface DoubleOwnProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  accessibleLabel?: string;
  accessibleDescription?: string;
}

/**
 * Build a contract-validated, jsdom-safe stand-in for a chart container.
 * `P` is the REAL component's props type (imported `type`-only in this file's
 * callers below) so the double stays a structural supertype of it — a
 * compile-time assignability check (`packages/charts/src/test/contract.test.ts`)
 * asserts `React.ComponentType<RealProps>` still accepts the double.
 */
function createChartContainerDouble<P extends DoubleOwnProps>(
  name: string,
  spec: ChartContractSpec,
) {
  const Double = forwardRef<HTMLDivElement, P>(function ChartTestDouble(props, ref) {
    const record = props as unknown as Record<string, unknown>;
    assertChartContract(name, record, spec);
    // Axes — RM-108
    assertAxisChildrenContract(props.children);
    // Labels — RM-110
    assertLabelChildrenContract(props.children);
    const a11y = useChartA11yContainerProps(props.accessibleLabel, props.accessibleDescription);
    const payload = buildChartDoublePayload(name, record, spec);
    return (
      <div
        ref={ref}
        data-slot="chart-test-double"
        data-chart={name}
        data-chart-props={JSON.stringify(payload)}
        data-chart-data-length={
          payload.dataLength !== undefined ? String(payload.dataLength) : undefined
        }
        data-chart-status={payload.status ?? DEFAULT_CHART_STATUS}
        className={props.className}
        style={props.style}
        role={a11y.role}
        aria-label={a11y["aria-label"]}
        aria-describedby={a11y["aria-describedby"]}
        tabIndex={a11y.tabIndex}
      >
        <ChartA11yLabel descId={a11y.descId} description={props.accessibleDescription} />
      </div>
    );
  });
  Double.displayName = name;
  return Double;
}

// ── Typed exports (one per real container; type parity is asserted in
//    contract.test.ts) ──────────────────────────────────────────────────────

import type { AreaChartProps } from "../charts/area-chart";
import type { BarChartProps } from "../charts/bar-chart";
import type { LineChartProps } from "../charts/line-chart";
import type { ComposedChartProps } from "../charts/composed-chart";
import type { ScatterChartProps } from "../charts/scatter-chart";
import type { CandlestickChartProps } from "../charts/candlestick-chart";
import type { LiveLineChartProps } from "../charts/live-line-chart";
import type { PieChartProps } from "../charts/pie-chart";
import type { RingChartProps } from "../charts/ring-chart";
import type { FunnelChartProps } from "../charts/funnel-chart";
import type { RadarChartProps } from "../charts/radar-chart";
import type { ChoroplethChartProps } from "../charts/choropleth/choropleth-chart";
import type { SankeyChartProps } from "../charts/sankey/sankey-chart";
import type { GanttProps } from "../gantt/gantt";
// Heatmap — RM-021
import type { HeatmapChartProps } from "../charts/heatmap/heatmap-chart";
import type { UnitChartProps } from "../charts/unit-chart";
// Treemap — RM-025
import type { TreemapChartProps } from "../charts/treemap/treemap-chart";
// DistributionChart — RM-026
import type { DistributionChartProps } from "../charts/distribution/distribution-chart";
// Waterfall — RM-022
import type { WaterfallChartProps } from "../charts/waterfall-chart";
// Tree — RM-035
import type { TreeChartProps } from "../charts/tree-chart";
// Network — RM-036
import type { NetworkChartProps } from "../charts/network/network-chart";

export const AreaChart = createChartContainerDouble<AreaChartProps>(
  "AreaChart",
  CHART_CONTRACT_SPECS.AreaChart,
);
const BarChartBaseDouble = createChartContainerDouble<BarChartProps>(
  "BarChart",
  CHART_CONTRACT_SPECS.BarChart,
);
// BarChart — RM-113: the richness props are validated before the base contract.
export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(
  function BarChartTestDouble(props, ref) {
    assertBarRichnessContract("BarChart", props as unknown as Record<string, unknown>);
    return <BarChartBaseDouble {...props} ref={ref} />;
  },
);
BarChart.displayName = "BarChart";
export const LineChart = createChartContainerDouble<LineChartProps>(
  "LineChart",
  CHART_CONTRACT_SPECS.LineChart,
);
export const ComposedChart = createChartContainerDouble<ComposedChartProps>(
  "ComposedChart",
  CHART_CONTRACT_SPECS.ComposedChart,
);
export const ScatterChart = createChartContainerDouble<ScatterChartProps>(
  "ScatterChart",
  CHART_CONTRACT_SPECS.ScatterChart,
);
export const CandlestickChart = createChartContainerDouble<CandlestickChartProps>(
  "CandlestickChart",
  CHART_CONTRACT_SPECS.CandlestickChart,
);
export const LiveLineChart = createChartContainerDouble<LiveLineChartProps>(
  "LiveLineChart",
  CHART_CONTRACT_SPECS.LiveLineChart,
);
export const PieChart = createChartContainerDouble<PieChartProps>(
  "PieChart",
  CHART_CONTRACT_SPECS.PieChart,
);
export const RingChart = createChartContainerDouble<RingChartProps>(
  "RingChart",
  CHART_CONTRACT_SPECS.RingChart,
);
export const FunnelChart = createChartContainerDouble<FunnelChartProps>(
  "FunnelChart",
  CHART_CONTRACT_SPECS.FunnelChart,
);
export const RadarChart = createChartContainerDouble<RadarChartProps>(
  "RadarChart",
  CHART_CONTRACT_SPECS.RadarChart,
);
export const ChoroplethChart = createChartContainerDouble<ChoroplethChartProps>(
  "ChoroplethChart",
  CHART_CONTRACT_SPECS.ChoroplethChart,
);
export const SankeyChart = createChartContainerDouble<SankeyChartProps>(
  "SankeyChart",
  CHART_CONTRACT_SPECS.SankeyChart,
);
export const Gantt = createChartContainerDouble<GanttProps>("Gantt", CHART_CONTRACT_SPECS.Gantt);
// Heatmap — RM-021
export const HeatmapChart = createChartContainerDouble<HeatmapChartProps>(
  "HeatmapChart",
  CHART_CONTRACT_SPECS.HeatmapChart,
);

// ── DumbbellChart — RM-023 ───────────────────────────────────────────────────

import type { DumbbellChartProps } from "../charts/dumbbell-chart";

export const DumbbellChart = createChartContainerDouble<DumbbellChartProps>(
  "DumbbellChart",
  CHART_CONTRACT_SPECS.DumbbellChart,
);

// ── BulletChart — RM-061 ─────────────────────────────────────────────────────

import type { BulletChartProps } from "../charts/bullet-chart";

export const BulletChart = createChartContainerDouble<BulletChartProps>(
  "BulletChart",
  CHART_CONTRACT_SPECS.BulletChart,
);

export const UnitChart = createChartContainerDouble<UnitChartProps>(
  "UnitChart",
  CHART_CONTRACT_SPECS.UnitChart,
);

// Treemap — RM-025
export const TreemapChart = createChartContainerDouble<TreemapChartProps>(
  "TreemapChart",
  CHART_CONTRACT_SPECS.TreemapChart,
);

// DistributionChart — RM-026
export const DistributionChart = createChartContainerDouble<DistributionChartProps>(
  "DistributionChart",
  CHART_CONTRACT_SPECS.DistributionChart,
);

// Waterfall — RM-022
export const WaterfallChart = createChartContainerDouble<WaterfallChartProps>(
  "WaterfallChart",
  CHART_CONTRACT_SPECS.WaterfallChart,
);

// Bump — RM-033
import type { BumpChartProps } from "../charts/bump-chart";

export const BumpChart = createChartContainerDouble<BumpChartProps>(
  "BumpChart",
  CHART_CONTRACT_SPECS.BumpChart,
);

// ParallelCoordinates — RM-034
import type { ParallelCoordinatesChartProps } from "../charts/parallel-coordinates/parallel-coordinates-chart";

export const ParallelCoordinatesChart = createChartContainerDouble<ParallelCoordinatesChartProps>(
  "ParallelCoordinatesChart",
  CHART_CONTRACT_SPECS.ParallelCoordinatesChart,
);

// Tree — RM-035
export const TreeChart = createChartContainerDouble<TreeChartProps>(
  "TreeChart",
  CHART_CONTRACT_SPECS.TreeChart,
);

// Network — RM-036
export const NetworkChart = createChartContainerDouble<NetworkChartProps>(
  "NetworkChart",
  CHART_CONTRACT_SPECS.NetworkChart,
);

// ── AutoChart (a special shape: `spec`, not `data`) ──────────────────────────

import type { AutoChartProps } from "../auto-chart/auto-chart";

export const AutoChart = forwardRef<HTMLDivElement, AutoChartProps>(
  function AutoChartTestDouble(props, ref) {
    const record = props as unknown as Record<string, unknown>;
    assertChartContract("AutoChart", record, { dataKind: "none", requiredProps: ["spec"] });
    // The spec's own value-contract (RM-038) — the type union, the declared
    // columns, and the per-family requirements the real component silently
    // falls back on. Lives in `contract.ts` beside the other value rules.
    assertChartSpecContract(props.spec);
    // Axes — RM-108
    assertAxisSpecContract((props.spec as { axes?: unknown } | undefined)?.axes);
    // Labels — RM-110
    assertLabelsSpecContract((props.spec as { labels?: unknown } | undefined)?.labels);
    // Annotations — RM-111
    assertAnnotationSpecContract(
      (props.spec as { annotations?: unknown } | undefined)?.annotations,
    );
    return (
      <div
        ref={ref}
        data-slot="chart-test-double"
        data-chart="AutoChart"
        data-chart-props={JSON.stringify({
          component: "AutoChart",
          loading: Boolean(props.loading),
        })}
        className={props.className}
        role={props.loading ? "status" : undefined}
        aria-live={props.loading ? "polite" : undefined}
      />
    );
  },
);
AutoChart.displayName = "AutoChart";

// Axes — RM-108
//
// The axis props (`domain`, `scale`, `ticks`, `tickCount`, placements,
// `orientation`, `Grid mode`, `BarXAxis fit`) and `ChartSpec.axes`. The REAL
// axis silently ignores a malformed value — a `domain` of `["50", 100]` pins
// nothing, a `scale` of `"logarithmic"` draws linear — so the double names it.
// A request the real axis refuses ON PURPOSE (log on data containing 0, a
// non-zero lower bound on bars) is data-dependent and only warns there, so it
// is NOT a violation here.
//
// These throw `ChartContractError` directly: `contract.ts`'s reporter (which
// honours `configureChartTestDouble({ onViolation: "warn" })`) is not exported.

const AXIS_SCALES = ["linear", "log", "sqrt"] as const;
const AXIS_PLACEMENTS = ["inside", "outside"] as const;
const GRID_MODES = ["lines", "ticks", "off"] as const;
const BAR_X_AXIS_FITS = ["auto", "wrap", "tilt", "off"] as const;
const AXIS_COMPONENT_NAMES = ["XAxis", "YAxis", "Grid", "BarXAxis"] as const;

function axisViolation(component: string, prop: string, received: unknown, reason: string): never {
  throw new ChartContractError(component, prop, received, reason);
}

function checkOneOf(
  component: string,
  prop: string,
  value: unknown,
  allowed: readonly string[],
): void {
  if (value !== undefined && !allowed.includes(value as string)) {
    axisViolation(component, prop, value, `"${prop}" must be one of ${allowed.join(" | ")}`);
  }
}

function checkDomain(component: string, prop: string, value: unknown): void {
  if (value === undefined) return;
  const isBound = (bound: unknown) =>
    bound === "auto" || (typeof bound === "number" && Number.isFinite(bound));
  if (!(Array.isArray(value) && value.length === 2 && value.every(isBound))) {
    axisViolation(
      component,
      prop,
      value,
      `"${prop}" must be [lower, upper], each a finite number or "auto"`,
    );
  }
  const [lo, hi] = value as [unknown, unknown];
  if (typeof lo === "number" && typeof hi === "number" && !(lo < hi)) {
    axisViolation(component, prop, value, `"${prop}" lower bound must be below the upper bound`);
  }
}

function checkTicks(
  component: string,
  prop: string,
  value: unknown,
  accept: (tick: unknown) => boolean,
  what: string,
): void {
  if (value === undefined) return;
  if (!(Array.isArray(value) && value.every(accept))) {
    axisViolation(component, prop, value, `"${prop}" must be an array of ${what}`);
  }
}

const isFiniteNumber = (tick: unknown) => typeof tick === "number" && Number.isFinite(tick);
const isValidDate = (tick: unknown) => tick instanceof Date && !Number.isNaN(tick.getTime());

/** Validate one axis part's props (RM-108). Exported for the contract test. */
export function assertAxisPropsContract(name: string, props: Record<string, unknown>): void {
  if (name === "Grid") {
    checkOneOf(name, "mode", props.mode, GRID_MODES);
    return;
  }
  if (name === "BarXAxis") {
    checkOneOf(name, "fit", props.fit, BAR_X_AXIS_FITS);
    return;
  }
  checkDomain(name, "domain", props.domain);
  checkOneOf(name, "scale", props.scale, AXIS_SCALES);
  checkOneOf(name, "titlePlacement", props.titlePlacement, AXIS_PLACEMENTS);
  const tickCount = props.tickCount;
  if (
    tickCount !== undefined &&
    tickCount !== "auto" &&
    !(isFiniteNumber(tickCount) && (tickCount as number) >= 1)
  ) {
    axisViolation(name, "tickCount", tickCount, `"tickCount" must be "auto" or a number ≥ 1`);
  }
  if (name === "YAxis") {
    checkOneOf(name, "labelPlacement", props.labelPlacement, AXIS_PLACEMENTS);
    checkOneOf(name, "orientation", props.orientation, ["left", "right"]);
    checkTicks(name, "ticks", props.ticks, isFiniteNumber, "finite numbers");
  } else {
    checkOneOf(name, "orientation", props.orientation, ["top", "bottom"]);
    checkTicks(
      name,
      "ticks",
      props.ticks,
      (tick) => isValidDate(tick) || isFiniteNumber(tick),
      "valid Dates (time x) or finite numbers (numeric x)",
    );
  }
}

function assertAxisChildrenContract(children: ReactNode): void {
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "function") return;
    const type = child.type as { displayName?: string; name?: string };
    const name = type.displayName || type.name || "";
    if ((AXIS_COMPONENT_NAMES as readonly string[]).includes(name)) {
      assertAxisPropsContract(name, child.props as Record<string, unknown>);
    }
  });
}

/** Validate `ChartSpec.axes` (RM-108). Exported for the contract test. */
export function assertAxisSpecContract(axes: unknown): void {
  if (axes === undefined) return;
  if (typeof axes !== "object" || axes === null) {
    axisViolation("AutoChart", "spec.axes", axes, `"axes" must be { x?, y?, y2? }`);
  }
  for (const [key, axis] of Object.entries(axes as Record<string, unknown>)) {
    const prop = `spec.axes.${key}`;
    if (!["x", "y", "y2"].includes(key)) {
      axisViolation("AutoChart", prop, axis, `"axes" only has x, y and y2`);
    }
    if (axis === undefined) continue;
    if (typeof axis !== "object" || axis === null) {
      axisViolation("AutoChart", prop, axis, `"${prop}" must be an AxisSpec object`);
    }
    const a = axis as Record<string, unknown>;
    checkDomain("AutoChart", `${prop}.domain`, a.domain);
    checkOneOf("AutoChart", `${prop}.scale`, a.scale, AXIS_SCALES);
    checkOneOf("AutoChart", `${prop}.titlePlacement`, a.titlePlacement, AXIS_PLACEMENTS);
    checkOneOf("AutoChart", `${prop}.gridMode`, a.gridMode, GRID_MODES);
    checkOneOf(
      "AutoChart",
      `${prop}.position`,
      a.position,
      key === "x" ? ["top", "bottom"] : ["left", "right"],
    );
    if (a.title !== undefined && typeof a.title !== "string") {
      axisViolation("AutoChart", `${prop}.title`, a.title, `"title" must be a string`);
    }
    checkTicks(
      "AutoChart",
      `${prop}.ticks`,
      a.ticks,
      (tick) =>
        isFiniteNumber(tick) ||
        (typeof tick === "string" && !Number.isNaN(new Date(tick).getTime())),
      "finite numbers or ISO date strings",
    );
  }
}

// Labels — RM-110
//
// `seriesLabel`, `valueLabels`, Scatter `labels`, Bar `showValues` objects and
// `ChartSpec.labels`. The REAL engine silently paints nothing for an unknown
// mode or placement, so the double names it.

const SERIES_LABEL_MODES = ["end", "key", "none"] as const;
const SERIES_LABEL_TIERS = ["base", "medium", "narrow"] as const;
const VALUE_LABEL_PLACEMENTS = ["first", "last", "all", "peaks"] as const;
const POINT_LABEL_MODES = ["auto", "all"] as const;

function checkSeriesLabel(component: string, prop: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value === "object" && value !== null && "base" in value) {
    for (const [tier, mode] of Object.entries(value as Record<string, unknown>)) {
      checkOneOf(component, `${prop} tier`, tier, SERIES_LABEL_TIERS);
      checkOneOf(component, `${prop}.${tier}`, mode, SERIES_LABEL_MODES);
    }
    return;
  }
  checkOneOf(component, prop, value, SERIES_LABEL_MODES);
}

function checkValueLabels(component: string, prop: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null) {
    axisViolation(component, prop, value, `"${prop}" must be { placement, count?, … }`);
  }
  const v = value as Record<string, unknown>;
  if (v.placement === undefined) {
    axisViolation(component, `${prop}.placement`, v.placement, `"placement" is required`);
  }
  checkOneOf(component, `${prop}.placement`, v.placement, VALUE_LABEL_PLACEMENTS);
  if (v.count !== undefined && !(isFiniteNumber(v.count) && (v.count as number) >= 0)) {
    axisViolation(component, `${prop}.count`, v.count, `"count" must be a number ≥ 0`);
  }
}

function checkPointLabels(component: string, prop: string, value: unknown, field: string): void {
  if (value === undefined) return;
  const p = value as Record<string, unknown> | null;
  if (typeof p !== "object" || p === null || typeof p[field] !== "string") {
    axisViolation(component, prop, value, `"${prop}" must be { ${field}: string, mode?, … }`);
  }
  if (typeof p.mode === "string") checkOneOf(component, `${prop}.mode`, p.mode, POINT_LABEL_MODES);
}

/** Validate the label props of `Line` / `Area` / `Scatter` / `Bar` children (RM-110). */
export function assertLabelChildrenContract(children: ReactNode): void {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const type = child.type as { displayName?: string; name?: string };
    const name = typeof child.type === "string" ? "" : (type.displayName ?? type.name ?? "");
    const props = child.props as Record<string, unknown>;
    if (name === "Line" || name === "Area") {
      checkSeriesLabel(name, "seriesLabel", props.seriesLabel);
      checkValueLabels(name, "valueLabels", props.valueLabels);
    } else if (name === "Scatter") {
      checkPointLabels(name, "labels", props.labels, "key");
    } else if (name === "Bar" && typeof props.showValues === "object" && props.showValues) {
      const sv = props.showValues as Record<string, unknown>;
      checkOneOf(name, "showValues.placement", sv.placement, ["inside", "outside", "auto"]);
      checkOneOf(name, "showValues.visibility", sv.visibility, ["always", "hover"]);
    }
    const nested = props.children as ReactNode;
    if (nested) assertLabelChildrenContract(nested);
  });
}

/** Validate `ChartSpec.labels` (RM-110). Exported for the contract test. */
export function assertLabelsSpecContract(labels: unknown): void {
  if (labels === undefined) return;
  if (typeof labels !== "object" || labels === null) {
    axisViolation(
      "AutoChart",
      "spec.labels",
      labels,
      `"labels" must be { series?, values?, points?, comparison? }`,
    );
  }
  const l = labels as Record<string, unknown>;
  for (const field of Object.keys(l)) {
    checkOneOf("AutoChart", "spec.labels field", field, [
      "series",
      "values",
      "points",
      // BarChart — RM-113
      "comparison",
    ]);
  }
  checkSeriesLabel("AutoChart", "spec.labels.series", l.series);
  checkValueLabels("AutoChart", "spec.labels.values", l.values);
  checkPointLabels("AutoChart", "spec.labels.points", l.points, "key");
  // BarChart — RM-113
  checkOneOf("AutoChart", "spec.labels.comparison", l.comparison, BAR_COMPARISON_LABELS);
}

// BarChart — RM-113
const BAR_STACKED_VALUES: readonly unknown[] = [true, false, "percent", "diverging"];
const BAR_SORT_DIRECTIONS: readonly unknown[] = ["asc", "desc"];
const BAR_COLOR_BY_SCALES: readonly unknown[] = ["categorical", "sequential", "diverging"];
const BAR_COMPARISON_LABELS = ["value", "difference", "none"] as const;

/**
 * `stacked` / `divergingCenter` / `sort` / `groupBy` / `colorBy` / `overlays` /
 * `comparison` (RM-113) must be well-formed, and a named `divergingCenter` must
 * be one of the chart's own `Bar` series — the real chart silently falls back
 * to a half split otherwise, which the double makes loud.
 */
export function assertBarRichnessContract(component: string, props: Record<string, unknown>): void {
  const { stacked, divergingCenter, sort, groupBy, colorBy, overlays, comparison } = props;
  if (stacked !== undefined && !BAR_STACKED_VALUES.includes(stacked)) {
    axisViolation(component, "stacked", stacked, 'must be a boolean, "percent" or "diverging"');
  }
  if (divergingCenter !== undefined) {
    if (typeof divergingCenter !== "string") {
      axisViolation(component, "divergingCenter", divergingCenter, "must be a series key");
    }
    const keys: string[] = [];
    Children.forEach(props.children as ReactNode, (child) => {
      if (isValidElement(child)) {
        const key = (child.props as { dataKey?: unknown }).dataKey;
        if (typeof key === "string") keys.push(key);
      }
    });
    if (keys.length > 0 && !keys.includes(divergingCenter)) {
      axisViolation(
        component,
        "divergingCenter",
        divergingCenter,
        `must name a Bar series (${keys.join(", ")})`,
      );
    }
  }
  if (
    sort !== undefined &&
    sort !== "none" &&
    !BAR_SORT_DIRECTIONS.includes(sort) &&
    !(
      typeof sort === "object" &&
      sort !== null &&
      typeof (sort as { by?: unknown }).by === "string" &&
      BAR_SORT_DIRECTIONS.includes((sort as { dir?: unknown }).dir)
    )
  ) {
    axisViolation(component, "sort", sort, 'must be "none", "asc", "desc" or { by, dir }');
  }
  if (groupBy !== undefined && typeof groupBy !== "string") {
    axisViolation(component, "groupBy", groupBy, "must be a column key");
  }
  if (colorBy !== undefined) {
    const c = colorBy as { key?: unknown; scale?: unknown; steps?: unknown } | null;
    if (
      typeof c !== "object" ||
      c === null ||
      typeof c.key !== "string" ||
      (c.scale !== undefined && !BAR_COLOR_BY_SCALES.includes(c.scale)) ||
      (c.steps !== undefined && !isFiniteNumber(c.steps))
    ) {
      axisViolation(component, "colorBy", colorBy, "must be { key, scale?, steps? }");
    }
  }
  if (overlays !== undefined) {
    if (!Array.isArray(overlays)) {
      axisViolation(component, "overlays", overlays, "must be an array");
    }
    overlays.forEach((overlay: unknown, i: number) => {
      const o = overlay as Record<string, unknown> | null;
      const ok =
        o !== null &&
        typeof o === "object" &&
        ((o.kind === "value" && typeof o.key === "string") ||
          (o.kind === "range" && typeof o.lowKey === "string" && typeof o.highKey === "string"));
      if (!ok) {
        axisViolation(
          component,
          `overlays[${i}]`,
          overlay,
          'must be { kind: "value", key } or { kind: "range", lowKey, highKey }',
        );
      }
    });
  }
  if (
    comparison !== undefined &&
    (typeof comparison !== "object" ||
      comparison === null ||
      typeof (comparison as { key?: unknown }).key !== "string")
  ) {
    axisViolation(component, "comparison", comparison, "must be { key, label? }");
  }
}

// Annotations — RM-111
const ANNOTATION_KINDS = ["text", "range", "line", "row"] as const;
const ANNOTATION_ANCHOR_VALUES = ["n", "ne", "e", "se", "s", "sw", "w", "nw", "center"];

function isAnnotationPosition(value: unknown): boolean {
  return isFiniteNumber(value) || (typeof value === "string" && value.length > 0);
}

/**
 * Validate `ChartSpec.annotations` (RM-111): the kind union, and the fields each
 * kind cannot render without — the real layer silently skips an annotation it
 * cannot place, which would hide the mistake. Exported for the contract test.
 */
export function assertAnnotationSpecContract(annotations: unknown): void {
  if (annotations === undefined) return;
  if (!Array.isArray(annotations)) {
    axisViolation("AutoChart", "spec.annotations", annotations, `"annotations" must be an array`);
    return;
  }
  annotations.forEach((item, i) => {
    const prop = `spec.annotations[${i}]`;
    if (typeof item !== "object" || item === null) {
      axisViolation("AutoChart", prop, item, `"${prop}" must be an annotation object`);
      return;
    }
    const a = item as Record<string, unknown>;
    checkOneOf("AutoChart", `${prop}.kind`, a.kind, ANNOTATION_KINDS);
    const requirePosition = (key: string) => {
      if (!isAnnotationPosition(a[key])) {
        axisViolation(
          "AutoChart",
          `${prop}.${key}`,
          a[key],
          `"${key}" must be a number or a string (an ISO date or a category)`,
        );
      }
    };
    const requireText = (key: string) => {
      if (typeof a[key] !== "string" || (a[key] as string).trim() === "") {
        axisViolation("AutoChart", `${prop}.${key}`, a[key], `"${key}" must be a non-empty string`);
      }
    };
    if (a.kind === "text") {
      requirePosition("x");
      requirePosition("y");
      requireText("text");
      checkOneOf("AutoChart", `${prop}.anchor`, a.anchor, ANNOTATION_ANCHOR_VALUES);
    } else if (a.kind === "range") {
      if (a.x1 !== undefined || a.x2 !== undefined) {
        requirePosition("x1");
        requirePosition("x2");
      } else {
        requirePosition("y1");
        requirePosition("y2");
      }
      checkOneOf("AutoChart", `${prop}.pattern`, a.pattern, ["solid", "stripes"]);
    } else if (a.kind === "line") {
      requirePosition(a.x !== undefined ? "x" : "y");
      checkOneOf("AutoChart", `${prop}.style`, a.style, ["solid", "dashed", "dotted"]);
      if (a.width !== undefined && ![1, 2, 3].includes(a.width as number)) {
        axisViolation("AutoChart", `${prop}.width`, a.width, `"width" must be 1, 2 or 3`);
      }
    } else if (a.kind === "row") {
      requireText("category");
      requireText("text");
    }
  });
}

/**
 * `ChartAnnotations` stand-in: inert like every composition primitive (it paints
 * nothing a test can assert on), but it still validates the annotation union.
 */
export function ChartAnnotations(props: { annotations: readonly unknown[] }): null {
  assertAnnotationSpecContract(props.annotations);
  return null;
}
ChartAnnotations.displayName = "ChartAnnotations";

/** `AnnotationKey` stand-in: the empty, `aria-hidden` list the real key renders at wide. */
export const AnnotationKey = forwardRef<HTMLOListElement, { annotations: readonly unknown[] }>(
  function AnnotationKeyTestDouble({ annotations }, ref) {
    assertAnnotationSpecContract(annotations);
    return <ol aria-hidden="true" data-count={0} data-slot="annotation-key" ref={ref} />;
  },
);
AnnotationKey.displayName = "AnnotationKey";

// ChartMultiples — RM-120
import type { ChartMultiplesProps } from "../multiples/chart-multiples";
import { splitFacetRows } from "../multiples/facet-layout";
import { facetPanelStats, sortFacetPanels } from "../multiples/facet-sort";

/**
 * `ChartMultiples` double: validates `xDataKey` / `dataKeys` / `by`, splits and
 * sorts the panels with the real pure helpers and calls `children(panel)` once
 * per panel in a plain grid — no measuring, no scales, no synced hover. A
 * `showAt` rule resolves at the wide tier (its `base`).
 */
export const ChartMultiples = forwardRef<HTMLDivElement, ChartMultiplesProps>(
  function ChartMultiplesTestDouble(
    {
      data,
      by,
      panels,
      xDataKey,
      dataKeys,
      sort = "data",
      reverse = false,
      showAt,
      children,
      // Accepted and ignored by the double (layout / scales / hover only).
      columns: _columns,
      minPanelWidth: _minPanelWidth,
      panelHeight: _panelHeight,
      scales: _scales,
      baseline: _baseline,
      syncHover: _syncHover,
      panelTitle: _panelTitle,
      annotations: _annotations,
      ...props
    },
    ref,
  ) {
    if (typeof xDataKey !== "string" || xDataKey === "") {
      axisViolation("ChartMultiples", "xDataKey", xDataKey, "a row key is required");
    }
    if (!Array.isArray(dataKeys) || dataKeys.length === 0) {
      axisViolation("ChartMultiples", "dataKeys", dataKeys, "at least one value key is required");
    }
    if (!panels && !(Array.isArray(data) && by !== undefined)) {
      axisViolation("ChartMultiples", "by", by, "pass `panels`, or `data` with `by`");
    }
    const bySeries = typeof by === "object" && by !== null;
    const inputs =
      panels ??
      (bySeries
        ? dataKeys.map((key) => ({ key, data: data ?? [], showAt: undefined }))
        : splitFacetRows(data ?? [], by as string).map((g) => ({
            key: g.key,
            data: g.rows,
            showAt: undefined,
          })));
    const built = inputs.map((input) => ({
      input,
      key: input.key,
      title: ("title" in input && input.title) || input.key,
      data: input.data,
      stats: facetPanelStats(input.data, bySeries && !panels ? input.key : dataKeys[0]),
    }));
    const visible = sortFacetPanels(built, sort, reverse).filter((entry, index) => {
      const rule = entry.input.showAt ?? showAt?.({ ...entry, index, annotations: [] }) ?? true;
      return typeof rule === "object" ? rule.base : rule;
    });
    return (
      <div className="grid" data-columns={1} data-slot="chart-multiples" ref={ref} {...props}>
        {visible.map((entry, index) => (
          <div
            data-panel-key={entry.key}
            data-slot="chart-multiples-panel"
            key={entry.key}
            role="group"
            aria-label={entry.title}
          >
            {children({
              key: entry.key,
              title: entry.title,
              data: entry.data,
              stats: entry.stats,
              index,
              annotations: [],
            })}
          </div>
        ))}
      </div>
    );
  },
);
ChartMultiples.displayName = "ChartMultiples";
