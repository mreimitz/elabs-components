"use client";

/**
 * auto-chart.tsx — Smart, data-driven chart renderer for @elabs-ai/components-charts.
 *
 * Given a serializable `ChartSpec` (the shape an LLM tool-call emits),
 * AutoChart picks and renders the correct existing chart container.
 * Supports all twenty `ChartType` members (RM-038): the original Core-7
 * (line, area, bar, pie, scatter, radar, funnel) plus candlestick, heatmap,
 * calendar, waterfall, dumbbell, unit, treemap, histogram, box, strip, bump,
 * stream and diverging-bar. `network`/`parallel`/`tree`/`sankey` are
 * deliberately NOT in the union — see the `ChartType` docblock in
 * `./chart-spec` — and render `ChartFallback`.
 *
 * Design constraints:
 * - Never throws — empty/malformed data and unsupported types → ChartFallback.
 * - Token-driven colors only. Per-series `color` is honored only when it is a
 *   `var(--chart-N)` reference; raw hex/url(…) falls back to the palette.
 * - No raw hex in component source. The ONE inline color usage is the legend
 *   swatch, which uses a `var(--chart-N)` token string as the CSS `background`.
 * - `"use client"` — uses hooks and relies on ResizeObserver internally.
 */

import type { ScatterLabels } from "../charts/labels/point-labels";
import { Component, forwardRef, useMemo, type HTMLAttributes, type ReactNode } from "react";
import { cn, Skeleton, useLocale } from "@elabs-ai/components-ui";
import type { ChartDatapointClickHandler } from "../charts/chart-datapoint";
import type { ChartHoverCategory } from "../charts/chart-hover-link";
import type { ChartSelectionStatesResolver } from "../charts/chart-selection";
import { useChartValueFormatter } from "../charts/chart-formatters";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  BarXAxis,
  BarYAxis,
  BumpChart,
  Candlestick,
  CandlestickChart,
  ChartTooltip,
  DistributionChart,
  DumbbellChart,
  FunnelChart,
  type FunnelStage,
  Grid,
  HeatmapChart,
  Line,
  LineChart,
  type OHLCDataPoint,
  PieCenter,
  PieChart,
  type PieData,
  PieSlice,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  type RadarData,
  type RadarMetric,
  ScatterChart,
  Scatter,
  TreemapChart,
  type TreemapNode,
  UnitChart,
  type UnitChartDatum,
  WaterfallChart,
  type WaterfallDatum,
  type WaterfallStep,
  XAxis,
  YAxis,
} from "../charts";
import { ChartFallback } from "../charts/chart-fallback";
import type { GridMode } from "../charts/grid";
import type { XAxisProps } from "../charts/x-axis";
import type { YAxisProps } from "../charts/y-axis";
import {
  DEFAULT_CHART_PLOT_HEIGHT,
  resolvePlotBoxStyle,
  useChartFramePlotHeight,
  warnChartOnce,
  type ChartPlotHeight,
  type Responsive,
} from "../charts/chart-breakpoint";

import type {
  AxisSpec,
  ChartLabelsSpec,
  ChartSpec,
  ChartSeriesSpec,
  ChartType,
} from "./chart-spec";
import {
  inferChartType,
  isChartSpecPalette,
  isChartType,
  readsAsBeforeAfterPair,
  readsAsTotalRow,
  secondCategoricalField,
} from "./infer-chart-type";

// ---------------------------------------------------------------------------
// Palette cycling
// ---------------------------------------------------------------------------

/**
 * Twelve semantic chart color tokens.
 * These match `defaultScatterColors` from chart-context.tsx exactly.
 */
const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
  "var(--chart-11)",
  "var(--chart-12)",
] as const;

/** Regex that matches only `var(--chart-N)` tokens (any positive integer N). */
const CHART_TOKEN_RE = /^var\(--chart-[1-9]\d*\)$/;

function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] as string;
}

/**
 * Resolve a series color:
 * - Honor the spec color ONLY if it is a `var(--chart-N)` token.
 * - Anything else (raw hex, rgb, url, empty) → cycle palette by index.
 */
function resolveSeriesColor(specColor: string | undefined, index: number): string {
  if (specColor && CHART_TOKEN_RE.test(specColor)) {
    return specColor;
  }
  return paletteColor(index);
}

// ---------------------------------------------------------------------------
// Normalize series
// ---------------------------------------------------------------------------

interface NormalizedSeries {
  key: string;
  label: string;
  color: string;
}

function normalizeSeries(series: Array<ChartSeriesSpec | string>): NormalizedSeries[] {
  return series.map((s, i) => {
    const spec: ChartSeriesSpec = typeof s === "string" ? { key: s } : s;
    return {
      key: spec.key,
      label: spec.label ?? spec.key,
      color: resolveSeriesColor(spec.color, i),
    };
  });
}

// ---------------------------------------------------------------------------
// Date coercion
// ---------------------------------------------------------------------------

/**
 * Coerce ISO-string x values → Date objects in a copy of the data array.
 * Called once before passing data to time-series containers (LineChart,
 * AreaChart, ScatterChart) which expect Date for their xDataKey values.
 */
function coerceDatesToDate(
  data: Record<string, unknown>[],
  xKey: string,
): Record<string, unknown>[] {
  return data.map((row) => {
    const v = row[xKey];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return { ...row, [xKey]: d };
      }
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// ChartFallback — re-exported for backward compatibility (moved to
// `../charts/chart-fallback` in #352 so the cartesian chart shells can reach
// it too; see that module's doc comment for why).
// ---------------------------------------------------------------------------

export { ChartFallback };

/** Unsupported type names already warned about, so a re-render does not re-log. */
const warnedUnsupportedTypes = new Set<string>();

/**
 * The developer channel for an unsupported `spec.type` (#304). The rendered
 * fallback only says the chart can’t be displayed — the type name is a fact
 * about the spec, for whoever wrote it, so it goes to the console instead.
 */
function warnUnsupportedChartType(type: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const name = String(type);
  if (warnedUnsupportedTypes.has(name)) return;
  warnedUnsupportedTypes.add(name);
  console.warn(
    `[AutoChart] Chart type "${name}" is not a ChartType, so AutoChart rendered its fallback. ` +
      "Use one of CHART_TYPES, or render that chart's own container directly.",
  );
}

// Labels — RM-110
/** `ChartSpec.labels.points` → `Scatter labels` (a `priorityKey` field becomes the priority reader). */
function scatterPointLabels(points: ChartLabelsSpec["points"]): ScatterLabels | undefined {
  if (!points) return undefined;
  const { key, mode, priorityKey } = points;
  return {
    key,
    mode,
    priority: priorityKey
      ? (d) => {
          const v = Number(d[priorityKey]);
          return Number.isFinite(v) ? v : 0;
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// AutoLegend
// ---------------------------------------------------------------------------

interface AutoLegendProps {
  series: NormalizedSeries[];
}

function AutoLegend({ series }: AutoLegendProps) {
  const { t } = useLocale();
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label={t("charts.legend.label")}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-muted-foreground text-meta">
          {/* Inline style here is intentional: the color IS a var(--chart-N) token,
              not raw hex. We verified this in resolveSeriesColor. */}
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: s.color }}
          />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Row readers shared by the RM-038 families
// ---------------------------------------------------------------------------

/** A row's numeric cell, or `0` — the containers all take real numbers. */
function numberAt(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * The dumbbell's `[startKey, endKey]`, resolved exactly as the `dumbbell` rule
 * resolved them: an explicit `spec.y2` is the "after" measure, otherwise the
 * two declared series are put in reading order by their before/after names.
 * Falls back to declaration order, which is what a caller who set `type:
 * "dumbbell"` by hand most likely meant.
 */
function dumbbellKeys(spec: ChartSpec, series: NormalizedSeries[]): [string, string] {
  const first = series[0]?.key ?? "";
  if (spec.y2) {
    return [first, spec.y2];
  }
  const second = series[1]?.key ?? first;
  const ordered = readsAsBeforeAfterPair(series[0]?.label ?? first, series[1]?.label ?? second);
  if (!ordered) {
    return [first, second];
  }
  const keyOf = (label: string) => series.find((x) => x.label === label)?.key ?? label;
  return [keyOf(ordered[0]), keyOf(ordered[1])];
}

// ---------------------------------------------------------------------------
// renderChart switch
// ---------------------------------------------------------------------------

/**
 * `ChartSpec.axes` (RM-108) → the `XAxis`/`YAxis`/`Grid` props every
 * cartesian family spreads. Unset fields stay unset, so a spec without `axes`
 * renders exactly as before.
 */
function resolveAxisSpecProps(
  axes: ChartSpec["axes"],
  isHorizontal: boolean,
): { x: XAxisProps; y: YAxisProps; gridMode: GridMode | undefined } {
  const x: AxisSpec = axes?.x ?? {};
  const y: AxisSpec = axes?.y ?? {};
  const numericTicks = (ticks: AxisSpec["ticks"]) =>
    ticks?.filter((tick): tick is number => typeof tick === "number");
  const xTicks = x.ticks?.every((tick) => typeof tick === "number")
    ? numericTicks(x.ticks)
    : x.ticks?.map((tick) => new Date(tick)).filter((date) => !Number.isNaN(date.getTime()));
  return {
    x: {
      domain: x.domain,
      scale: x.scale,
      ticks: xTicks && xTicks.length > 0 ? xTicks : undefined,
      title: x.title,
      titlePlacement: x.titlePlacement,
      orientation: x.position === "top" ? "top" : x.position === "bottom" ? "bottom" : undefined,
    },
    y: {
      domain: y.domain,
      scale: y.scale,
      ticks: numericTicks(y.ticks),
      title: y.title,
      titlePlacement: y.titlePlacement,
      orientation: y.position === "right" ? "right" : y.position === "left" ? "left" : undefined,
    },
    gridMode: (isHorizontal ? x.gridMode : y.gridMode) ?? undefined,
  };
}

function renderChart(
  type: ChartType,
  spec: ChartSpec,
  series: NormalizedSeries[],
  resolvedData: Record<string, unknown>[],
  /**
   * `resolvedData` with `spec.x` ISO-date strings coerced to `Date` — computed
   * ONCE per `(spec.data, spec.x)` pair in the component body (memoised), so
   * `line`/`area`/`stream`/`candlestick` (and `scatter` under `xType: "time"`)
   * don't each re-walk + re-allocate the whole dataset on every render.
   */
  timeCoercedData: Record<string, unknown>[],
  plotHeight: Responsive<ChartPlotHeight> | undefined,
  /**
   * Resolved in the component body, not here: `renderChart` is a plain function
   * and cannot call the hook that reads the active locale and currency.
   */
  yFormat: (value: number) => string,
  /** Put the exact value on the clipboard when a datapoint is activated. */
  copyValueOnActivate: boolean,
  links: AutoChartLinkProps = {},
): ReactNode {
  const { x, stacked, orientation, donut } = spec;
  const axisProps = resolveAxisSpecProps(spec.axes, orientation === "horizontal");
  // Unit and distribution charts size themselves from their data; a numeric
  // plot height still fixes their box, as the deprecated `height` did.
  // charts-responsive-exempt: a pixel number is the documented fixed-box form for the families that take no plotHeight
  const fixedHeight = typeof plotHeight === "number" ? plotHeight : undefined;

  switch (type) {
    // ── Line ─────────────────────────────────────────────────────────────────
    case "line": {
      const timeData = timeCoercedData;
      return (
        <LineChart
          data={timeData}
          xDataKey={x}
          plotHeight={plotHeight}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
          hoverCategory={links.hoverCategory}
          onHoverCategory={links.onHoverCategory}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
        >
          <Grid horizontal mode={axisProps.gridMode} />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={s.color}
              // Labels — RM-110
              name={s.label}
              seriesLabel={spec.labels?.series}
              valueLabels={spec.labels?.values}
            />
          ))}
          <XAxis dateFormat={spec.dateFormat} {...axisProps.x} />
          <YAxis formatValue={yFormat} {...axisProps.y} />
          <ChartTooltip />
        </LineChart>
      );
    }

    // ── Area / Stream ─────────────────────────────────────────────────────────
    //    One case, two baselines: a `stream` is the same stacked bands with
    //    d3's wiggle offset (RM-029), which is the whole difference between the
    //    two readings — so forking the JSX would only duplicate it.
    case "area":
    case "stream": {
      const timeData = timeCoercedData;
      return (
        <AreaChart
          data={timeData}
          xDataKey={x}
          offset={type === "stream" ? "wiggle" : stacked ? "none" : undefined}
          plotHeight={plotHeight}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
          hoverCategory={links.hoverCategory}
          onHoverCategory={links.onHoverCategory}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
        >
          <Grid horizontal mode={axisProps.gridMode} />
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              stroke={s.color}
              fill={s.color}
              // Labels — RM-110
              name={s.label}
              seriesLabel={spec.labels?.series}
              valueLabels={spec.labels?.values}
            />
          ))}
          <XAxis dateFormat={spec.dateFormat} {...axisProps.x} />
          <YAxis formatValue={yFormat} {...axisProps.y} />
          <ChartTooltip />
        </AreaChart>
      );
    }

    // ── Bar ───────────────────────────────────────────────────────────────────
    case "bar": {
      const isHorizontal = (orientation ?? "vertical") === "horizontal";
      // BarChart does not accept a style prop; wrap in a sized div instead.
      return (
        <BarChart
          plotHeight={plotHeight}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={resolvedData}
          xDataKey={x}
          stacked={stacked ?? false}
          orientation={orientation ?? "vertical"}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        >
          {/* Gridlines run ACROSS the value axis, so they swap with orientation. */}
          <Grid horizontal={!isHorizontal} mode={axisProps.gridMode} vertical={isHorizontal} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} lineCap="round" />
          ))}
          {isHorizontal ? <BarYAxis /> : <BarXAxis />}
          {/*
            A value scale, at last — bars used to render with categories and no
            way to read a magnitude off the chart.

            Vertical only, deliberately: with `orientation="horizontal"` the
            chart sets `yScale = valueScale` over a range of `[0, innerWidth]`,
            and `YAxis` paints scale OUTPUT as a `top` coordinate — so it would
            plot x-pixels vertically. The bottom value axis a horizontal bar
            chart wants is its own component; tracked separately.
          */}
          {isHorizontal ? null : <YAxis formatValue={yFormat} {...axisProps.y} />}
          <ChartTooltip />
        </BarChart>
      );
    }

    // ── Pie / Donut ───────────────────────────────────────────────────────────
    case "pie": {
      const firstSeries = series[0];
      const valueKey = firstSeries?.key ?? "";
      const pieData: PieData[] = resolvedData.map((row, i) => ({
        label: String(row[x] ?? `Slice ${i + 1}`),
        value: typeof row[valueKey] === "number" ? (row[valueKey] as number) : 0,
      }));

      const innerRadius = donut ? 80 : 0;

      // PieChart uses aspect-square by default; size it via a wrapper div
      return (
        <PieChart
          plotHeight={plotHeight}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={pieData}
          innerRadius={innerRadius}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        >
          {pieData.map((_d, i) => (
            // pie slices are position-indexed, so the index is a stable key
            <PieSlice key={i} index={i} />
          ))}
          {donut ? <PieCenter /> : null}
        </PieChart>
      );
    }

    // ── Scatter ───────────────────────────────────────────────────────────────
    case "scatter": {
      // ScatterChart does not accept a style prop; wrap in a sized div.
      // Coerce strings → Date only when xType is "time"; otherwise pass numeric x as-is.
      const scatterData = spec.xType === "time" ? timeCoercedData : resolvedData;
      // #302: a numeric x (`xType: "number"`) needs ScatterChart's non-temporal
      // scale, or the axis prints epoch dates — see `scatter-chart-shell.tsx`.
      return (
        <ScatterChart
          plotHeight={plotHeight}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          data={scatterData}
          xDataKey={x}
          xScale={spec.xType === "number" ? "linear" : "time"}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
        >
          <Grid horizontal mode={axisProps.gridMode} />
          {series.map((s) => (
            <Scatter
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              // Labels — RM-110
              labels={scatterPointLabels(spec.labels?.points)}
            />
          ))}
          <XAxis dateFormat={spec.dateFormat} {...axisProps.x} />
          <YAxis formatValue={yFormat} {...axisProps.y} />
          <ChartTooltip />
        </ScatterChart>
      );
    }

    // ── Radar ─────────────────────────────────────────────────────────────────
    case "radar": {
      /**
       * RadarChart requires:
       * - `data: RadarData[]` — each item is a series (polygon), has a `label`,
       *   optional `color`, and `values: Record<string, number>`.
       * - `metrics: RadarMetric[]` — the spoke definitions (`key` + `label`).
       *
       * We pivot from the tabular spec:
       * - `spec.x` field in each row is the metric label (spoke name).
       * - Each series key provides values per-metric.
       *
       * So for each series we produce one RadarData entry whose `values` map
       * each x-value (metric key) to the series value at that row.
       */
      const metrics: RadarMetric[] = resolvedData.map((row) => ({
        key: String(row[x] ?? ""),
        label: String(row[x] ?? ""),
      }));

      const radarData: RadarData[] = series.map((s) => ({
        label: s.label,
        color: s.color,
        values: Object.fromEntries(
          resolvedData.map((row) => {
            const v = row[s.key];
            return [String(row[x] ?? ""), typeof v === "number" ? v : 0];
          }),
        ),
      }));

      // RadarChart defaults to aspect-square; size via wrapper div
      return (
        <RadarChart
          plotHeight={plotHeight}
          data={radarData}
          metrics={metrics}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
        >
          <RadarGrid />
          <RadarAxis />
          <RadarLabels />
          {radarData.map((d, i) => (
            <RadarArea key={d.label} index={i} />
          ))}
        </RadarChart>
      );
    }

    // ── Funnel ────────────────────────────────────────────────────────────────
    case "funnel": {
      const firstSeries = series[0];
      const valueKey = firstSeries?.key ?? "";
      const funnelData: FunnelStage[] = resolvedData.map((row) => ({
        label: String(row[x] ?? ""),
        value: typeof row[valueKey] === "number" ? (row[valueKey] as number) : 0,
      }));

      return (
        <FunnelChart
          data={funnelData}
          color={series[0]?.color ?? "var(--chart-1)"}
          orientation={(orientation as "horizontal" | "vertical" | undefined) ?? "horizontal"}
          plotHeight={plotHeight}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
          onDatapointClick={links.onDatapointClick}
        />
      );
    }

    // ── Candlestick ───────────────────────────────────────────────────────────
    //    `CandlestickChart` plots real `Date`s and four fixed columns, so the
    //    spec's own column names are mapped onto them here.
    //    NOTE: it is the one container in this switch with no
    //    `copyValueOnActivate` — it does not extend `ChartInteractionProps`.
    case "candlestick": {
      const named = (want: string) => series.find((s) => s.key.toLowerCase() === want)?.key ?? want;
      const openKey = named("open");
      const highKey = named("high");
      const lowKey = named("low");
      const closeKey = named("close");
      const ohlc: OHLCDataPoint[] = timeCoercedData
        .map((row) => ({
          date: row[x] instanceof Date ? (row[x] as Date) : new Date(String(row[x] ?? "")),
          open: numberAt(row, openKey),
          high: numberAt(row, highKey),
          low: numberAt(row, lowKey),
          close: numberAt(row, closeKey),
        }))
        .filter((d) => !Number.isNaN(d.date.getTime()));
      return (
        <CandlestickChart
          data={ohlc}
          xDataKey="date"
          plotHeight={plotHeight}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
        >
          <Grid horizontal mode={axisProps.gridMode} />
          <Candlestick />
          <XAxis dateFormat={spec.dateFormat} {...axisProps.x} />
          <YAxis formatValue={yFormat} {...axisProps.y} />
          <ChartTooltip />
        </CandlestickChart>
      );
    }

    // ── Heatmap / Calendar ────────────────────────────────────────────────────
    //    One container, two grids (RM-021). The row key is resolved by the SAME
    //    helper the inference rule used, so the picture and the explanation
    //    cannot name different columns. `variant="calendar"` ignores `y`.
    case "heatmap":
    case "calendar": {
      const valueKey = series[0]?.key ?? "";
      const yKey = secondCategoricalField(spec) ?? "";
      return (
        // The heatmap draws its cells into its own plot box, so a plot height
        // resizes the cells rather than clipping them.
        <HeatmapChart
          plotHeight={plotHeight}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={resolvedData}
          x={x}
          y={yKey}
          valueKey={valueKey}
          variant={type === "calendar" ? "calendar" : "matrix"}
          valueFormat={spec.valueFormat}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        />
      );
    }

    // ── Waterfall ─────────────────────────────────────────────────────────────
    case "waterfall": {
      const valueKey = series[0]?.key ?? "";
      const steps: WaterfallDatum[] = resolvedData.map((row) => {
        const label = String(row[x] ?? "");
        return {
          label,
          value: numberAt(row, valueKey),
          // Same classifier the `waterfall` rule used to recognise the shape.
          kind: readsAsTotalRow(label) ? "total" : "step",
        };
      });
      return (
        <WaterfallChart
          data={steps}
          plotHeight={plotHeight}
          orientation={orientation ?? "vertical"}
          valueFormat={spec.valueFormat}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
          // WaterfallChart types its handler on its own `WaterfallStep` datum; the spec-driven
          // link is family-agnostic, so it is cast the same way `WaterfallChart` itself casts
          // an internal handler (see its own `onDatapointClick={onDatapointClick as
          // ChartDatapointClickHandler | undefined}`).
          onDatapointClick={
            links.onDatapointClick as unknown as ChartDatapointClickHandler<WaterfallStep>
          }
        />
      );
    }

    // ── Dumbbell ──────────────────────────────────────────────────────────────
    case "dumbbell": {
      const [startKey, endKey] = dumbbellKeys(spec, series);
      return (
        <DumbbellChart
          plotHeight={plotHeight}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={resolvedData}
          category={x}
          startKey={startKey}
          endKey={endKey}
          orientation={orientation ?? "horizontal"}
          valueFormat={spec.valueFormat}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        />
      );
    }

    // ── Unit (waffle) ─────────────────────────────────────────────────────────
    case "unit": {
      const valueKey = series[0]?.key ?? "";
      const unitData: UnitChartDatum[] = resolvedData.map((row, i) => ({
        label: String(row[x] ?? `Part ${i + 1}`),
        value: numberAt(row, valueKey),
      }));
      return (
        <UnitChart
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={unitData}
          layout="waffle"
          style={fixedHeight === undefined ? undefined : { height: fixedHeight }}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        />
      );
    }

    // ── Treemap ───────────────────────────────────────────────────────────────
    //    The one type that reads `spec.hierarchy` instead of `spec.data`; with
    //    no hierarchy there is nothing to draw, so it falls back.
    case "treemap": {
      const hierarchy: TreemapNode | undefined = spec.hierarchy;
      if (!hierarchy) {
        return null;
      }
      return (
        // A treemap is shape-sensitive — its whole quality depends on tile
        // aspect ratios — so a pixel height is a FLOOR here rather than a fixed
        // box that can force a wide container into a degenerate row of
        // slivers (#306).
        <TreemapChart
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={hierarchy}
          // A spec is model output: an invented palette falls back to the
          // documented mono default rather than reaching the layout (#306).
          palette={isChartSpecPalette(spec.palette) ? spec.palette : "mono"}
          // A pixel height stays a floor over the treemap's own 16:9 box (#306);
          // an aspect or per-breakpoint value is passed through as-is.
          plotHeight={fixedHeight === undefined ? plotHeight : undefined}
          style={fixedHeight === undefined ? undefined : { minHeight: fixedHeight }}
          valueFormat={spec.valueFormat}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        />
      );
    }

    // ── Distribution: histogram / box / strip ─────────────────────────────────
    //    One container, three marks (RM-026) — `kind` IS the chart type here,
    //    which is why the three share a case.
    case "histogram":
    case "box":
    case "strip": {
      const valueKey = series[0]?.key ?? "";
      return (
        <DistributionChart
          style={fixedHeight === undefined ? undefined : { height: fixedHeight }}
          data={resolvedData}
          valueKey={valueKey}
          groupKey={spec.group}
          kind={type}
          valueFormat={spec.valueFormat}
          currency={spec.currency}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
          onDatapointClick={links.onDatapointClick}
        />
      );
    }

    // ── Bump ──────────────────────────────────────────────────────────────────
    case "bump": {
      const measure = series[0]?.key ?? "";
      const isRank = /^(rank|position|place)$/i.test(measure.trim());
      return (
        <BumpChart
          plotHeight={plotHeight}
          data={resolvedData}
          period={x}
          entity={secondCategoricalField(spec) ?? ""}
          // A column literally called "rank" IS the rank; anything else is a
          // magnitude the container ranks for us.
          rankKey={isRank ? measure : undefined}
          valueKey={isRank ? undefined : measure}
          valueFormat={spec.valueFormat}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
          onDatapointClick={links.onDatapointClick}
        />
      );
    }

    // ── Diverging bar ─────────────────────────────────────────────────────────
    //    A single signed measure around the zero baseline (RM-027). The signed
    //    value labels are what separates it from `bar`: the crossing is the
    //    story, so each bar states which side of zero it landed on.
    case "diverging-bar": {
      const valueKey = series[0]?.key ?? "";
      const color = series[0]?.color ?? "var(--chart-1)";
      return (
        <BarChart
          plotHeight={plotHeight}
          dimExcluded={links.dimExcluded}
          selectionStates={links.selectionStates}
          onDatapointClick={links.onDatapointClick}
          data={resolvedData}
          xDataKey={x}
          orientation={orientation ?? "vertical"}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        >
          <Grid horizontal mode={axisProps.gridMode} />
          <Bar dataKey={valueKey} fill={color} lineCap="round" showValues zeroLine />
          <BarXAxis />
          <YAxis formatValue={yFormat} {...axisProps.y} />
          <ChartTooltip />
        </BarChart>
      );
    }

    // ── Unsupported / deferred ────────────────────────────────────────────────
    default: {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Local error boundary (review finding)
// ---------------------------------------------------------------------------
// The `try/catch` around `renderChart(...)` below only covers errors thrown
// while BUILDING the element tree (the synchronous `createElement` calls).
// It cannot catch an error thrown later, when React actually renders/commits
// one of those chart containers (a hook throwing on a malformed value deep in
// a container, for instance) — only a class component's `componentDidCatch`/
// `getDerivedStateFromError` can. Without this, that error unmounts the
// nearest ancestor boundary (or the whole app), breaking AutoChart's documented
// "never throws" contract.
interface AutoChartErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}
interface AutoChartErrorBoundaryState {
  hasError: boolean;
}
class AutoChartErrorBoundary extends Component<
  AutoChartErrorBoundaryProps,
  AutoChartErrorBoundaryState
> {
  override state: AutoChartErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AutoChartErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error("AutoChart: chart render failed, showing fallback", error);
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// AutoChart
// ---------------------------------------------------------------------------

export interface AutoChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * The serializable chart specification produced by an LLM tool-call.
   *
   * `spec.type` is optional; omit it and the data shape decides (see
   * `explainChartType`). The full `ChartType` union AutoChart renders is:
   * `line` | `area` | `bar` | `pie` | `scatter` | `radar` | `funnel` |
   * `candlestick` | `heatmap` | `calendar` | `waterfall` | `dumbbell` |
   * `unit` | `treemap` | `histogram` | `box` | `strip` | `bump` | `stream` |
   * `diverging-bar`.
   *
   * Anything else — including `network`, `parallel`, `tree` and `sankey`, which
   * stay explicit-container-only — renders `ChartFallback` instead.
   *
   * That list is not hand-kept prose: `auto-chart.test.tsx` parses it back out
   * of this comment and asserts it equals `CHART_TYPES`, so a type added to the
   * union without being documented here fails the suite.
   */
  spec: ChartSpec;
  /**
   * Height of the drawing area only; the title and legend stack around it.
   * A number of pixels, `{ aspect }` (width / height), or a per-breakpoint
   * `{ base, medium?, narrow? }`. Default: the chart family's own default
   * (`{ aspect: 2 }` wide, `{ aspect: 1.25 }` narrow for the 2:1 families).
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /**
   * @deprecated Use `plotHeight`. Removed in 5.0.0. Until then it is read as
   * `plotHeight` and logs one development warning per page.
   */
  height?: number;
  /**
   * Loading vs ready — renders a layout-shaped skeleton at the normal chart
   * height instead of resolving `spec`. Default: `false`.
   */
  loading?: boolean;
  /**
   * Copy a datapoint's EXACT value to the clipboard when it is activated by
   * pointer or keyboard. Default **`true`** here, unlike the raw chart
   * containers, which default it to `false`.
   *
   * The asymmetry is deliberate. `AutoChart` renders compact axis labels
   * (`1.5M`) from a spec its caller never sees the axis config for, so without
   * this there is no way to recover the exact figure. A raw container's caller
   * owns the axis and can format it themselves, and turning this on mounts the
   * datapoint interaction layer — which would break the documented guarantee
   * that a chart with no interaction props renders byte-identical DOM.
   *
   * Set `false` to keep `AutoChart`'s pre-existing DOM (no interaction layer,
   * no keyboard targets).
   */
  copyValueOnActivate?: boolean;
  /**
   * Selection input (RM-073), forwarded to the chosen container. The resolver's
   * `category` is read from `spec.fields.category` (default `spec.x`), so a host
   * maps selection without knowing the chart type.
   */
  selectionStates?: ChartSelectionStatesResolver;
  /** Dim `excluded` marks. Default `true`. Forwarded with `selectionStates`. */
  dimExcluded?: boolean;
  /** Shared-crosshair category from a sibling chart (RM-073). */
  hoverCategory?: ChartHoverCategory;
  /** Fires with the hovered category on pointer move, `null` on leave (RM-073). */
  onHoverCategory?: (category: ChartHoverCategory) => void;
  /**
   * Forwarded to the chosen container's own `onDatapointClick` (RM-075), when that
   * family accepts one (bar, line, area/stream, pie, waterfall, heatmap/calendar,
   * dumbbell, unit, treemap, histogram/box/strip, bump, funnel, diverging-bar).
   * Absent on scatter/radar/candlestick — those containers don't accept it yet.
   * Unset by default, so the default render stays byte-identical (#349's own rule:
   * "with it unset the chart renders exactly as before").
   */
  onDatapointClick?: ChartDatapointClickHandler;
}

/** The link inputs `AutoChart` forwards to its container. */
type AutoChartLinkProps = Pick<
  AutoChartProps,
  "dimExcluded" | "hoverCategory" | "onHoverCategory" | "selectionStates" | "onDatapointClick"
>;

/**
 * Re-keys a selection resolver onto `spec.fields` (RM-073). With no `fields`
 * (or `fields.category === x`) the host's resolver passes through untouched.
 */
function resolveSpecSelection(
  spec: ChartSpec,
  resolver: ChartSelectionStatesResolver | undefined,
): ChartSelectionStatesResolver | undefined {
  const categoryField = spec.fields?.category;
  if (!resolver || !categoryField || categoryField === spec.x) return resolver;
  return (category, seriesKey, datum) => {
    const mapped = datum?.[categoryField];
    return resolver(
      mapped instanceof Date || typeof mapped === "string" || typeof mapped === "number"
        ? mapped
        : category,
      seriesKey,
      datum,
    );
  };
}

/**
 * AutoChart — smart, data-driven chart renderer.
 *
 * Reads a `ChartSpec`, picks the right chart container (Core-7), and renders it.
 * Never throws — bad data / unsupported types render `ChartFallback` instead.
 *
 * The component is intentionally bare: no built-in ChartFrame wrapper.
 * Consumers add expand / flip / download by wrapping with `<ChartFrame>`.
 */
export const AutoChart = forwardRef<HTMLDivElement, AutoChartProps>(function AutoChart(
  {
    spec,
    plotHeight,
    height,
    loading = false,
    copyValueOnActivate = true,
    className,
    dimExcluded,
    hoverCategory,
    onHoverCategory,
    selectionStates,
    onDatapointClick,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  // `height` is the deprecated alias; `plotHeight` wins when both are set.
  if (height !== undefined) {
    warnChartOnce(
      "AutoChart.height",
      '[AutoChart] "height" is deprecated and will be removed in 5.0.0. Use "plotHeight": it sets the chart\'s own height, and the title and legend are added around it.',
    );
  }
  const effectivePlotHeight = plotHeight ?? height;
  // Loading and fallback boxes reserve the box the chart will draw, at the
  // wide tier (they render before any chart measures its container).
  const framePlotHeight = useChartFramePlotHeight();
  const fallbackStyle = resolvePlotBoxStyle(
    {
      plotHeight: effectivePlotHeight,
      defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT,
      framePlotHeight,
    },
    "wide",
  );
  // In a fill-host frame (a dashboard tile) the chart's plot box is
  // `height: 100%`, which only resolves if every box between the frame body and
  // the plot is definite — this root included. The chart then takes what the
  // title and legend leave (`flex-1 min-h-0`).
  const fillsFrame = framePlotHeight === "fill" && effectivePlotHeight === undefined;
  // Resolved here, above every early return, because it is a hook. `renderChart`
  // is a plain function and receives the result.
  const yFormat = useChartValueFormatter(spec.valueFormat, spec.currency);
  // Memoised above every early return (rules of hooks) so a re-render that
  // doesn't change `spec.series`/`spec.data`/`spec.x` (e.g. a `height` or
  // `className` change from the caller) doesn't re-walk + re-allocate either —
  // both were previously recomputed unconditionally on every render.
  const series = useMemo(() => normalizeSeries(spec.series), [spec.series]);
  const timeCoercedData = useMemo(() => coerceDatesToDate(spec.data, spec.x), [spec.data, spec.x]);

  // ── Loading vs ready ───────────────────────────────────────────────────────
  // Same box shape as ChartFallback, but a skeleton instead of message text —
  // one status region for the whole box, not one per skeleton box.
  if (loading) {
    return (
      <div
        ref={ref}
        className={cn("w-full rounded-md", className)}
        style={fallbackStyle}
        role="status"
        aria-live="polite"
        {...props}
      >
        <span className="sr-only">{t("charts.chart.loading")}</span>
        <Skeleton className="size-full" />
      </div>
    );
  }

  // ── Guard: empty or clearly invalid data ──────────────────────────────────
  // A treemap spec carries its rows in `hierarchy`, so an empty `data`/`series`
  // pair is correct there rather than a missing dataset.
  const readsHierarchy = Boolean(spec.hierarchy);

  if (!readsHierarchy && (!spec.data || spec.data.length === 0)) {
    return (
      <ChartFallback
        ref={ref}
        kind="empty"
        className={cn("w-full", className)}
        style={fallbackStyle}
        {...props}
      />
    );
  }

  if (!readsHierarchy && (!spec.series || spec.series.length === 0)) {
    return (
      <ChartFallback
        ref={ref}
        kind="empty"
        className={cn("w-full", className)}
        style={fallbackStyle}
        {...props}
      />
    );
  }

  // ── Resolve type (explicit wins) ──────────────────────────────────────────
  let type: ChartType;
  let isUnsupported = false;

  if (spec.type) {
    // Every `ChartType` member has a branch in `renderChart`, so the guard is
    // now "is this a member at all" — a spec cast past the type (`"sankey" as
    // any`, a model inventing a name) still lands on the fallback.
    if (isChartType(spec.type)) {
      type = spec.type;
    } else {
      isUnsupported = true;
      type = "bar"; // unused — we render fallback below
    }
  } else {
    type = inferChartType(spec);
  }

  if (isUnsupported) {
    warnUnsupportedChartType(spec.type);
    return (
      <ChartFallback
        ref={ref}
        kind="unsupported"
        className={cn("w-full", className)}
        style={fallbackStyle}
        {...props}
      />
    );
  }

  // ── Legend items ───────────────────────────────────────────────────────────
  // Pie/donut slices are colored by DATA ROW (the `x` value), not by series, so
  // the legend must map each slice label to its palette color. Every other chart
  // type colors by series, so the normalized series ARE the legend items.
  const legendItems: NormalizedSeries[] =
    type === "pie"
      ? spec.data.map((row, i) => ({
          key: `${String(row[spec.x] ?? i)}-${i}`,
          label: String(row[spec.x] ?? `Slice ${i + 1}`),
          color: paletteColor(i),
        }))
      : series;

  // ── Legend visibility ──────────────────────────────────────────────────────
  // Labels — RM-110: a chart that names its own series (end labels or the
  // key row) does not also get the legend below it, unless the spec asks.
  const namesSeriesItself = spec.labels?.series !== undefined && spec.labels.series !== "none";
  const showLegend = spec.legend ?? (legendItems.length > 1 && !namesSeriesItself);

  // ── Chart title ───────────────────────────────────────────────────────────
  const title = spec.title;
  const links: AutoChartLinkProps = {
    dimExcluded,
    hoverCategory,
    onHoverCategory,
    selectionStates: resolveSpecSelection(spec, selectionStates),
    onDatapointClick,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  let chartNode: ReactNode = null;
  try {
    chartNode = renderChart(
      type,
      spec,
      series,
      spec.data,
      timeCoercedData,
      effectivePlotHeight,
      yFormat,
      copyValueOnActivate,
      links,
    );
  } catch {
    return (
      <ChartFallback
        ref={ref}
        kind="empty"
        className={cn("w-full", className)}
        style={fallbackStyle}
        {...props}
      />
    );
  }

  if (chartNode === null) {
    // renderChart returned null → unsupported type branch hit at runtime
    warnUnsupportedChartType(type);
    return (
      <ChartFallback
        ref={ref}
        kind="unsupported"
        className={cn("w-full", className)}
        style={fallbackStyle}
        {...props}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={cn("flex w-full flex-col", fillsFrame && "h-full min-h-0", className)}
      {...props}
    >
      {title ? <p className="mb-1 text-subtitle text-foreground">{title}</p> : null}
      {/*
       * The `try/catch` above only covers errors thrown while BUILDING this
       * element tree; an error thrown once React actually renders/commits one
       * of these chart containers only a class boundary can catch (see
       * `AutoChartErrorBoundary`'s doc comment) — without it, that error would
       * escape AutoChart's documented "never throws" contract.
       */}
      <AutoChartErrorBoundary
        fallback={<ChartFallback message="Unable to display this chart" style={fallbackStyle} />}
      >
        {fillsFrame ? <div className="min-h-0 flex-1">{chartNode}</div> : chartNode}
      </AutoChartErrorBoundary>
      {showLegend ? <AutoLegend series={legendItems} /> : null}
    </div>
  );
});
