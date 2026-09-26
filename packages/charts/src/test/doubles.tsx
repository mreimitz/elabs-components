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
 * `../definitions/**` is a further, VALUE-import exception (RM-177): the whole
 * tree is React/visx/d3/motion-free at runtime (`pnpm check --rule
 * charts-definitions-pure`, ADR 0042 §11), so `CHART_CONTRACT_SPECS` below reads
 * `CHART_DEFINITIONS` off `../definitions/registry` instead of hand-keeping a
 * second copy of every family's contract, and each double reads its own
 * `aliases` off the same entry.
 * Never import a barrel (`../charts`, `../gantt`, `../index`) — those pull
 * every `@visx/*`-backed chart.
 */
"use client";

import { Children, forwardRef, isValidElement, type CSSProperties, type ReactNode } from "react";
import type { AliasInput } from "@elabs-ai/components-ui/definition";
import { ChartA11yLabel, useChartA11yContainerProps } from "../charts/chart-a11y";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
// The registry (RM-177): pure at runtime (`charts-definitions-pure`), never a
// charts barrel — see the header's ENGINE ISOLATION note.
import { CHART_DEFINITIONS } from "../definitions/registry";
import {
  assertChartContract,
  assertChartSpecContract,
  assertSelectionSpecContract,
  buildChartDoublePayload,
  ChartContractError,
  resolveChartDoubleProps,
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
// Legend engine — RM-118. `RampLegend`/`SizeLegend` touch only react,
// `@elabs-ai/components-ui`, `chart-formatters` and (`SizeLegend`) the pure
// `areaRadius` helper — zero `@visx`/`d3`/`motion` at runtime, so re-exporting
// the real implementation is zero drift risk, same as the five above.
//
// `ChartLegend`/`useContainerLegend` are NOT re-exported here: `ChartLegend`
// reaches `series-pattern.tsx`/`use-high-decoration.ts`, both of which import
// `chart-context.tsx`'s `DEFAULT_Y_AXIS_ID`/`useChartStable` AS VALUES, and
// `chart-context.tsx` itself imports `y-axis-scales.ts`, which imports
// `@visx/scale` at runtime (`pnpm check --rule charts-test-double` catches
// this: it fails "engine-isolation" the moment `ChartLegend` is added here).
// `ChartLegend` was already outside the test double before this item — this
// only documents why it stays there; giving it one costs a hand-written fake
// double, out of `touches`.
export {
  RampLegend,
  rampPositionOf,
  type RampLegendLabelMode,
  type RampLegendProps,
  type RampLegendScale,
} from "../charts/legend/ramp-legend";
export { SizeLegend, type SizeLegendProps } from "../charts/legend/size-legend";

// ── The per-family contract specs (the flat, auditable list — RM-177: read off
//    the registry, never hand-kept a second time) ───────────────────────────

/** The finite key set — keeps indexed access typed as `ChartContractSpec`, never `| undefined`. */
export type ChartFamilyName =
  | "AreaChart"
  | "BarChart"
  | "LineChart"
  | "ComposedChart"
  | "ScatterChart"
  // DensityScatterChart — columnar OR rows; the double checks presence only.
  | "DensityScatterChart"
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

/**
 * Reads every chart definition's own `contract` (ADR 0042 §5) off
 * `CHART_DEFINITIONS`, keyed the same way. `registry.test-d.ts` asserts
 * `ChartDefinitionId` and `ChartFamilyName` are the same set, so this is total.
 * `definitions.test.ts`'s "golden contract" suite still deep-equals each
 * definition's `contract` against this table — now a tripwire against a
 * definition losing its `contract` field, not a hand-authored comparison.
 */
function contractSpecsFromDefinitions(
  definitions: Readonly<Record<ChartFamilyName, { readonly contract: ChartContractSpec }>>,
): Record<ChartFamilyName, ChartContractSpec> {
  const specs = {} as Record<ChartFamilyName, ChartContractSpec>;
  for (const id of Object.keys(definitions) as ChartFamilyName[])
    specs[id] = definitions[id].contract;
  return specs;
}

export const CHART_CONTRACT_SPECS: Record<ChartFamilyName, ChartContractSpec> =
  contractSpecsFromDefinitions(CHART_DEFINITIONS);

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
  aliases?: AliasInput,
) {
  const Double = forwardRef<HTMLDivElement, P>(function ChartTestDouble(props, ref) {
    const raw = props as unknown as Record<string, unknown>;
    // Alias normalisation — RM-177: a caller still on a renamed prop's OLD
    // name validates like one already on the new one; both names stay
    // readable off `record` until 6.0 (ADR 0042 §8). `aliases` is `undefined`
    // for every family until its rename item lands, so this is a no-op today.
    const record = resolveChartDoubleProps(name, raw, aliases);
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
import type { InlineChipProps } from "../chart-frame/inline-chip";
import type { RingChartProps } from "../charts/ring-chart";
import type { FunnelChartProps } from "../charts/funnel-chart";
import type { RadarChartProps } from "../charts/radar-chart";
import type { ChoroplethChartProps } from "../charts/choropleth/choropleth-chart";
import type { SankeyChartProps } from "../charts/sankey/sankey-chart";
import type { GanttProps } from "../gantt/gantt";
// Heatmap — RM-021
import type { HeatmapChartProps } from "../charts/heatmap/heatmap-chart";
import type { DensityScatterChartProps } from "../charts/density-scatter/density-scatter-chart";
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
  CHART_DEFINITIONS.AreaChart.aliases,
);
const BarChartBaseDouble = createChartContainerDouble<BarChartProps>(
  "BarChart",
  CHART_CONTRACT_SPECS.BarChart,
  CHART_DEFINITIONS.BarChart.aliases,
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
  CHART_DEFINITIONS.LineChart.aliases,
);
export const ComposedChart = createChartContainerDouble<ComposedChartProps>(
  "ComposedChart",
  CHART_CONTRACT_SPECS.ComposedChart,
  CHART_DEFINITIONS.ComposedChart.aliases,
);
export const ScatterChart = createChartContainerDouble<ScatterChartProps>(
  "ScatterChart",
  CHART_CONTRACT_SPECS.ScatterChart,
  CHART_DEFINITIONS.ScatterChart.aliases,
);
export const DensityScatterChart = createChartContainerDouble<DensityScatterChartProps>(
  "DensityScatterChart",
  CHART_CONTRACT_SPECS.DensityScatterChart,
  CHART_DEFINITIONS.DensityScatterChart.aliases,
);
export const CandlestickChart = createChartContainerDouble<CandlestickChartProps>(
  "CandlestickChart",
  CHART_CONTRACT_SPECS.CandlestickChart,
  CHART_DEFINITIONS.CandlestickChart.aliases,
);
export const LiveLineChart = createChartContainerDouble<LiveLineChartProps>(
  "LiveLineChart",
  CHART_CONTRACT_SPECS.LiveLineChart,
  CHART_DEFINITIONS.LiveLineChart.aliases,
);
export const PieChart = createChartContainerDouble<PieChartProps>(
  "PieChart",
  CHART_CONTRACT_SPECS.PieChart,
  CHART_DEFINITIONS.PieChart.aliases,
);
export const RingChart = createChartContainerDouble<RingChartProps>(
  "RingChart",
  CHART_CONTRACT_SPECS.RingChart,
  CHART_DEFINITIONS.RingChart.aliases,
);
export const FunnelChart = createChartContainerDouble<FunnelChartProps>(
  "FunnelChart",
  CHART_CONTRACT_SPECS.FunnelChart,
  CHART_DEFINITIONS.FunnelChart.aliases,
);
export const RadarChart = createChartContainerDouble<RadarChartProps>(
  "RadarChart",
  CHART_CONTRACT_SPECS.RadarChart,
  CHART_DEFINITIONS.RadarChart.aliases,
);
export const ChoroplethChart = createChartContainerDouble<ChoroplethChartProps>(
  "ChoroplethChart",
  CHART_CONTRACT_SPECS.ChoroplethChart,
  CHART_DEFINITIONS.ChoroplethChart.aliases,
);
export const SankeyChart = createChartContainerDouble<SankeyChartProps>(
  "SankeyChart",
  CHART_CONTRACT_SPECS.SankeyChart,
  CHART_DEFINITIONS.SankeyChart.aliases,
);
export const Gantt = createChartContainerDouble<GanttProps>(
  "Gantt",
  CHART_CONTRACT_SPECS.Gantt,
  CHART_DEFINITIONS.Gantt.aliases,
);
// Heatmap — RM-021
export const HeatmapChart = createChartContainerDouble<HeatmapChartProps>(
  "HeatmapChart",
  CHART_CONTRACT_SPECS.HeatmapChart,
  CHART_DEFINITIONS.HeatmapChart.aliases,
);

// ── DumbbellChart — RM-023 ───────────────────────────────────────────────────

import type { DumbbellChartProps } from "../charts/dumbbell-chart";

export const DumbbellChart = createChartContainerDouble<DumbbellChartProps>(
  "DumbbellChart",
  CHART_CONTRACT_SPECS.DumbbellChart,
  CHART_DEFINITIONS.DumbbellChart.aliases,
);

// ── BulletChart — RM-061 ─────────────────────────────────────────────────────

import type { BulletChartProps } from "../charts/bullet-chart";

export const BulletChart = createChartContainerDouble<BulletChartProps>(
  "BulletChart",
  CHART_CONTRACT_SPECS.BulletChart,
  CHART_DEFINITIONS.BulletChart.aliases,
);

export const UnitChart = createChartContainerDouble<UnitChartProps>(
  "UnitChart",
  CHART_CONTRACT_SPECS.UnitChart,
  CHART_DEFINITIONS.UnitChart.aliases,
);

// Treemap — RM-025
export const TreemapChart = createChartContainerDouble<TreemapChartProps>(
  "TreemapChart",
  CHART_CONTRACT_SPECS.TreemapChart,
  CHART_DEFINITIONS.TreemapChart.aliases,
);

// DistributionChart — RM-026
export const DistributionChart = createChartContainerDouble<DistributionChartProps>(
  "DistributionChart",
  CHART_CONTRACT_SPECS.DistributionChart,
  CHART_DEFINITIONS.DistributionChart.aliases,
);

// Waterfall — RM-022
export const WaterfallChart = createChartContainerDouble<WaterfallChartProps>(
  "WaterfallChart",
  CHART_CONTRACT_SPECS.WaterfallChart,
  CHART_DEFINITIONS.WaterfallChart.aliases,
);

// Bump — RM-033
import type { BumpChartProps } from "../charts/bump-chart";

export const BumpChart = createChartContainerDouble<BumpChartProps>(
  "BumpChart",
  CHART_CONTRACT_SPECS.BumpChart,
  CHART_DEFINITIONS.BumpChart.aliases,
);

// ParallelCoordinates — RM-034
import type { ParallelCoordinatesChartProps } from "../charts/parallel-coordinates/parallel-coordinates-chart";

export const ParallelCoordinatesChart = createChartContainerDouble<ParallelCoordinatesChartProps>(
  "ParallelCoordinatesChart",
  CHART_CONTRACT_SPECS.ParallelCoordinatesChart,
  CHART_DEFINITIONS.ParallelCoordinatesChart.aliases,
);

// Tree — RM-035
export const TreeChart = createChartContainerDouble<TreeChartProps>(
  "TreeChart",
  CHART_CONTRACT_SPECS.TreeChart,
  CHART_DEFINITIONS.TreeChart.aliases,
);

// Network — RM-036
export const NetworkChart = createChartContainerDouble<NetworkChartProps>(
  "NetworkChart",
  CHART_CONTRACT_SPECS.NetworkChart,
  CHART_DEFINITIONS.NetworkChart.aliases,
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
    // Analytics — RM-138 / RM-139
    assertAnalyticsSpecContract((props.spec as { analytics?: unknown } | undefined)?.analytics);
    // Selection chrome — RM-145
    assertSelectionSpecContract(
      (props.spec as { selection?: unknown } | undefined)?.selection,
      record.onSelectionIntent,
    );
    // Dual-axis — RM-121
    assertDualAxisSpecContract(props.spec);
    // Choropleth — RM-124
    assertChoroplethSpecContract(props.spec);
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
      `"labels" must be { series?, values?, points?, comparison?, places? }`,
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
      // Choropleth — RM-124
      "places",
    ]);
  }
  checkSeriesLabel("AutoChart", "spec.labels.series", l.series);
  checkValueLabels("AutoChart", "spec.labels.values", l.values);
  checkPointLabels("AutoChart", "spec.labels.points", l.points, "key");
  // BarChart — RM-113
  checkOneOf("AutoChart", "spec.labels.comparison", l.comparison, BAR_COMPARISON_LABELS);
  // Choropleth — RM-124
  assertPlaceLabelsSpecContract(l.places);
}

// Choropleth — RM-124: `MAX_PLACE_LABELS` from `charts/choropleth/place-labels`,
// copied rather than imported — `src/test/**` pulls in no runtime chart module
// (`pnpm check --rule charts-test-double`). The place-labels test pins the pair.
const MAX_PLACE_LABELS = 30;

/**
 * `labels.places` (RM-124): at most `MAX_PLACE_LABELS` names, each field the
 * documented type. The real map silently caps `max` and ignores a `priority`
 * no feature carries, so the double names both.
 */
function assertPlaceLabelsSpecContract(places: unknown): void {
  if (places === undefined) return;
  if (typeof places !== "object" || places === null) {
    axisViolation(
      "AutoChart",
      "spec.labels.places",
      places,
      `"places" must be { key?, max?, priority?, collision? }`,
    );
  }
  const p = places as Record<string, unknown>;
  for (const field of Object.keys(p)) {
    checkOneOf("AutoChart", "spec.labels.places field", field, [
      "key",
      "max",
      "priority",
      "collision",
    ]);
  }
  for (const field of ["key", "priority"] as const) {
    if (p[field] !== undefined && typeof p[field] !== "string") {
      axisViolation(
        "AutoChart",
        `spec.labels.places.${field}`,
        p[field],
        `"${field}" names a feature property`,
      );
    }
  }
  if (p.max !== undefined) {
    const max = p.max;
    if (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > MAX_PLACE_LABELS) {
      axisViolation(
        "AutoChart",
        "spec.labels.places.max",
        max,
        `"max" is a whole number from 1 to ${MAX_PLACE_LABELS}`,
      );
    }
  }
  if (p.collision !== undefined && typeof p.collision !== "boolean") {
    axisViolation(
      "AutoChart",
      "spec.labels.places.collision",
      p.collision,
      `"collision" is a boolean`,
    );
  }
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

// Analytics — RM-138 / RM-139
const ANALYTIC_KINDS = ["line", "band", "trend", "window", "forecast", "errorBars"] as const;
const ANALYTIC_NAMED_VALUES = ["mean", "median", "min", "max", "sum"] as const;

function isSpecAnalyticValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string")
    return (ANALYTIC_NAMED_VALUES as readonly string[]).includes(value);
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.percentile === "number" || typeof v.stddev === "number";
}

/**
 * Validate `ChartSpec.analytics` (RM-138 / RM-139): the kind union and the
 * fields each kind cannot compute without — the real host silently drops an
 * analytic it cannot resolve, which would hide the mistake.
 */
export function assertAnalyticsSpecContract(analytics: unknown): void {
  if (analytics === undefined) return;
  if (!Array.isArray(analytics)) {
    axisViolation("AutoChart", "spec.analytics", analytics, `"analytics" must be an array`);
    return;
  }
  analytics.forEach((item, i) => {
    const prop = `spec.analytics[${i}]`;
    if (typeof item !== "object" || item === null) {
      axisViolation("AutoChart", prop, item, `"${prop}" must be an analytic object`);
      return;
    }
    const a = item as Record<string, unknown>;
    if (!(ANALYTIC_KINDS as readonly string[]).includes(a.kind as string)) {
      axisViolation(
        "AutoChart",
        `${prop}.kind`,
        a.kind,
        `"kind" must be one of ${ANALYTIC_KINDS.join(" | ")}`,
      );
    }
    checkOneOf("AutoChart", `${prop}.axis`, a.axis, ["x", "y"]);
    checkOneOf("AutoChart", `${prop}.ifOverflow`, a.ifOverflow, ["clip", "extend"]);
    const requireValue = (key: string) => {
      if (!isSpecAnalyticValue(a[key])) {
        axisViolation(
          "AutoChart",
          `${prop}.${key}`,
          a[key],
          `"${key}" must be a number, mean | median | min | max | sum, { percentile } or { stddev }`,
        );
      }
    };
    if (a.kind === "line") requireValue("value");
    if (a.kind === "band" && a.spread === undefined) {
      requireValue("from");
      requireValue("to");
    }
    if (
      (a.kind === "window" && !(typeof a.k === "number" && a.k >= 1)) ||
      (a.kind === "forecast" && !(typeof a.horizon === "number" && a.horizon >= 1))
    ) {
      const key = a.kind === "window" ? "k" : "horizon";
      axisViolation("AutoChart", `${prop}.${key}`, a[key], `"${key}" must be a number ≥ 1`);
    }
    if (a.kind === "errorBars" && a.low === undefined) {
      axisViolation("AutoChart", `${prop}.low`, a.low, `"low" must be a field name or { percent }`);
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

// InlineChip — RM-117
/**
 * `InlineChip` stand-in: the real chip's DOM (root + named swatch) without the
 * frame's series registry, so the swatch paints `currentColor`. It still
 * validates `series` — the real chip silently falls back to `currentColor` and
 * the bare key for an empty one, which would hide the mistake.
 */
export const InlineChip = forwardRef<HTMLSpanElement, InlineChipProps>(
  function InlineChipTestDouble({ series, label, className, children, ...props }, ref) {
    if (typeof series !== "string" || series.length === 0) {
      axisViolation("InlineChip", "series", series, `"series" must be a non-empty series key`);
    }
    return (
      <span ref={ref} data-slot="inline-chip" data-series={series} className={className} {...props}>
        <span
          data-slot="inline-chip-swatch"
          role="img"
          aria-label={label ?? series}
          style={{ backgroundColor: "currentColor" }}
        />
        {children}
      </span>
    );
  },
);
InlineChip.displayName = "InlineChip";

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

// Dual-axis — RM-121
const DUAL_AXIS_SIDES: readonly unknown[] = ["left", "right"];
const DUAL_AXIS_MARKS: readonly unknown[] = ["line", "area", "column"];

/**
 * A `type: "dual-axis"` spec: real `axis`/`mark` values, at least one line,
 * and columns on the left axis only — the rules the real `AutoChart` answers
 * with `ChartFallback kind="unsupported"`.
 */
function assertDualAxisSpecContract(spec: unknown): void {
  const { type, series } = (spec ?? {}) as { type?: unknown; series?: unknown };
  if (type !== "dual-axis" || !Array.isArray(series)) return;
  const entries = series.map(
    (entry) =>
      (typeof entry === "string" ? { key: entry } : entry) as { axis?: unknown; mark?: unknown },
  );
  entries.forEach((entry, i) => {
    if (entry.axis !== undefined && !DUAL_AXIS_SIDES.includes(entry.axis)) {
      axisViolation(
        "AutoChart",
        `spec.series[${i}].axis`,
        entry.axis,
        `"axis" is "left" or "right"`,
      );
    }
    if (entry.mark !== undefined && !DUAL_AXIS_MARKS.includes(entry.mark)) {
      axisViolation(
        "AutoChart",
        `spec.series[${i}].mark`,
        entry.mark,
        `"mark" is "line", "area" or "column"`,
      );
    }
  });
  if (!entries.some((entry) => (entry.mark ?? "line") === "line")) {
    axisViolation(
      "AutoChart",
      "spec.series",
      series,
      `a "dual-axis" spec needs at least one series with mark "line"`,
    );
  }
  if (entries.some((entry) => entry.mark === "column" && entry.axis === "right")) {
    axisViolation(
      "AutoChart",
      "spec.series",
      series,
      `a "dual-axis" spec draws columns on the left axis only`,
    );
  }
}

// Choropleth — RM-124
const CHOROPLETH_GEO_NAMES: readonly unknown[] = ["world", "us-states"];
const COLOR_SCALE_TYPES: readonly unknown[] = ["continuous", "stepped"];
const CONTINUOUS_SCALE_METHODS: readonly unknown[] = [
  "linear",
  "median",
  "quartiles",
  "quintiles",
  "deciles",
  "natural",
];
const STEPPED_SCALE_METHODS: readonly unknown[] = [
  "equidistant",
  "rounded",
  "quantile",
  "jenks",
  "custom",
];

/**
 * A `type: "choropleth"` spec: a real map, a well-formed `match` join, and a
 * `scale` whose `method` belongs to its own `type` — the rules the real
 * `AutoChart` answers with `ChartFallback kind="unsupported"` (no map) or
 * silently drops back to the default scale (a method the other family owns).
 */
function assertChoroplethSpecContract(spec: unknown): void {
  const { type, geo, match, scale } = (spec ?? {}) as {
    type?: unknown;
    geo?: unknown;
    match?: unknown;
    scale?: unknown;
  };
  if (type !== "choropleth") return;

  if (typeof geo === "string") {
    if (!CHOROPLETH_GEO_NAMES.includes(geo)) {
      axisViolation("AutoChart", "spec.geo", geo, `the bundled maps are "world" and "us-states"`);
    }
  } else if (
    typeof geo !== "object" ||
    geo === null ||
    !Array.isArray((geo as { features?: unknown }).features)
  ) {
    axisViolation(
      "AutoChart",
      "spec.geo",
      geo,
      `a "choropleth" spec needs a GeoJSON FeatureCollection, "world" or "us-states"`,
    );
  }

  if (match !== undefined) {
    const { row, feature } = match as { row?: unknown; feature?: unknown };
    for (const [name, value] of [
      ["row", row],
      ["feature", feature],
    ] as const) {
      if (value !== undefined && typeof value !== "string") {
        axisViolation(
          "AutoChart",
          `spec.match.${name}`,
          value,
          `"${name}" names the field the join reads`,
        );
      }
    }
  }

  if (scale === undefined) return;
  if (typeof scale !== "object" || scale === null) {
    axisViolation("AutoChart", "spec.scale", scale, `"scale" must be a colour-scale object`);
  }
  const s = scale as { key?: unknown; type?: unknown; method?: unknown; steps?: unknown };
  if (s.key !== undefined && typeof s.key !== "string") {
    axisViolation("AutoChart", "spec.scale.key", s.key, `"key" names a feature property`);
  }
  if (!COLOR_SCALE_TYPES.includes(s.type)) {
    axisViolation("AutoChart", "spec.scale.type", s.type, `"type" is "continuous" or "stepped"`);
  }
  const methods = s.type === "stepped" ? STEPPED_SCALE_METHODS : CONTINUOUS_SCALE_METHODS;
  if (s.method !== undefined && !methods.includes(s.method)) {
    axisViolation(
      "AutoChart",
      "spec.scale.method",
      s.method,
      `a "${String(s.type)}" scale's method is one of ${methods.join(" | ")}`,
    );
  }
  if (
    s.steps !== undefined &&
    (typeof s.steps !== "number" || !Number.isInteger(s.steps) || s.steps < 1)
  ) {
    axisViolation("AutoChart", "spec.scale.steps", s.steps, `"steps" is a whole number ≥ 1`);
  }
}
