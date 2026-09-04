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

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { ChartA11yLabel, useChartA11yContainerProps } from "../charts/chart-a11y";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import {
  assertChartContract,
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
export type { SparklineProps } from "../sparkline/sparkline";

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
  | "UnitChart";

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
  Gantt: {
    dataProp: "tasks",
    dataKind: "array",
    requiredProps: ["tasks"],
    itemRequiredKeys: ["id", "name", "start", "end"],
    dateItemKeys: ["start", "end"],
  },
  UnitChart: {
    dataKind: "array",
    requiredProps: ["data", "layout"],
    hasStatus: false,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
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
import type { UnitChartProps } from "../charts/unit-chart";

export const AreaChart = createChartContainerDouble<AreaChartProps>(
  "AreaChart",
  CHART_CONTRACT_SPECS.AreaChart,
);
export const BarChart = createChartContainerDouble<BarChartProps>(
  "BarChart",
  CHART_CONTRACT_SPECS.BarChart,
);
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
export const UnitChart = createChartContainerDouble<UnitChartProps>(
  "UnitChart",
  CHART_CONTRACT_SPECS.UnitChart,
);

// ── AutoChart (a special shape: `spec`, not `data`) ──────────────────────────

import type { AutoChartProps } from "../auto-chart/auto-chart";

export const AutoChart = forwardRef<HTMLDivElement, AutoChartProps>(
  function AutoChartTestDouble(props, ref) {
    const record = props as unknown as Record<string, unknown>;
    assertChartContract("AutoChart", record, { dataKind: "none", requiredProps: ["spec"] });
    if (props.spec !== undefined && (typeof props.spec !== "object" || props.spec === null)) {
      throw new ChartContractError(
        "AutoChart",
        "spec",
        props.spec,
        `"spec" must be a ChartSpec object`,
      );
    }
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
