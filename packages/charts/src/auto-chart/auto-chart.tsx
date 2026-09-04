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

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn, Skeleton, useLocale } from "@elabs-ai/components-ui";
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
  XAxis,
  YAxis,
} from "../charts";
import { ChartFallback } from "../charts/chart-fallback";

import type { ChartSpec, ChartSeriesSpec, ChartType } from "./chart-spec";
import {
  inferChartType,
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

// ---------------------------------------------------------------------------
// AutoLegend
// ---------------------------------------------------------------------------

interface AutoLegendProps {
  series: NormalizedSeries[];
}

function AutoLegend({ series }: AutoLegendProps) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Chart legend">
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

function renderChart(
  type: ChartType,
  spec: ChartSpec,
  series: NormalizedSeries[],
  resolvedData: Record<string, unknown>[],
  height: number,
  /**
   * Resolved in the component body, not here: `renderChart` is a plain function
   * and cannot call the hook that reads the active locale and currency.
   */
  yFormat: (value: number) => string,
  /** Put the exact value on the clipboard when a datapoint is activated. */
  copyValueOnActivate: boolean,
): ReactNode {
  const { x, stacked, orientation, donut } = spec;

  switch (type) {
    // ── Line ─────────────────────────────────────────────────────────────────
    case "line": {
      const timeData = coerceDatesToDate(resolvedData, x);
      return (
        // LineChart accepts style prop — pass height directly to suppress aspectRatio
        <LineChart
          data={timeData}
          xDataKey={x}
          aspectRatio={undefined}
          style={{ height }}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        >
          <Grid horizontal />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} stroke={s.color} />
          ))}
          <XAxis />
          <YAxis formatValue={yFormat} />
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
      const timeData = coerceDatesToDate(resolvedData, x);
      return (
        // AreaChart accepts style prop — pass height directly to suppress aspectRatio
        <AreaChart
          data={timeData}
          xDataKey={x}
          aspectRatio={undefined}
          offset={type === "stream" ? "wiggle" : stacked ? "none" : undefined}
          style={{ height }}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        >
          <Grid horizontal />
          {series.map((s) => (
            <Area key={s.key} dataKey={s.key} stroke={s.color} fill={s.color} />
          ))}
          <XAxis />
          <YAxis formatValue={yFormat} />
          <ChartTooltip />
        </AreaChart>
      );
    }

    // ── Bar ───────────────────────────────────────────────────────────────────
    case "bar": {
      const isHorizontal = (orientation ?? "vertical") === "horizontal";
      // BarChart does not accept a style prop; wrap in a sized div instead.
      return (
        <div style={{ height }}>
          <BarChart
            data={resolvedData}
            xDataKey={x}
            stacked={stacked ?? false}
            orientation={orientation ?? "vertical"}
            aspectRatio={undefined}
            className="h-full"
            accessibleLabel={spec.title}
            accessibleDescription={spec.description}
            copyValueOnActivate={copyValueOnActivate}
          >
            {/* Gridlines run ACROSS the value axis, so they swap with orientation. */}
            <Grid horizontal={!isHorizontal} vertical={isHorizontal} />
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
            {isHorizontal ? null : <YAxis formatValue={yFormat} />}
            <ChartTooltip />
          </BarChart>
        </div>
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
        <div style={{ height }}>
          <PieChart
            data={pieData}
            innerRadius={innerRadius}
            className="h-full"
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
        </div>
      );
    }

    // ── Scatter ───────────────────────────────────────────────────────────────
    case "scatter": {
      // ScatterChart does not accept a style prop; wrap in a sized div.
      // Coerce strings → Date only when xType is "time"; otherwise pass numeric x as-is.
      const scatterData = spec.xType === "time" ? coerceDatesToDate(resolvedData, x) : resolvedData;
      return (
        <div style={{ height }}>
          <ScatterChart
            data={scatterData}
            xDataKey={x}
            aspectRatio={undefined}
            className="h-full"
            accessibleLabel={spec.title}
            accessibleDescription={spec.description}
          >
            <Grid horizontal />
            {series.map((s) => (
              <Scatter key={s.key} dataKey={s.key} fill={s.color} />
            ))}
            <XAxis />
            <YAxis formatValue={yFormat} />
            <ChartTooltip />
          </ScatterChart>
        </div>
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
        <div style={{ height }}>
          <RadarChart
            data={radarData}
            metrics={metrics}
            className="h-full"
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
        </div>
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
        // FunnelChart accepts style prop — pass height directly
        <FunnelChart
          data={funnelData}
          color={series[0]?.color ?? "var(--chart-1)"}
          orientation={(orientation as "horizontal" | "vertical" | undefined) ?? "horizontal"}
          style={{ height }}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
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
      const ohlc: OHLCDataPoint[] = coerceDatesToDate(resolvedData, x)
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
          aspectRatio={undefined}
          style={{ height }}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
        >
          <Grid horizontal />
          <Candlestick />
          <XAxis />
          <YAxis formatValue={yFormat} />
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
        // Sized by aspect ratio internally, so `height` is a FLOOR here rather
        // than a cap — a clipped heatmap loses cells, which is worse than a
        // taller box.
        <div style={{ minHeight: height }}>
          <HeatmapChart
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
        </div>
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
          height={height}
          orientation={orientation ?? "vertical"}
          valueFormat={spec.valueFormat}
          accessibleLabel={spec.title}
          accessibleDescription={spec.description}
          copyValueOnActivate={copyValueOnActivate}
        />
      );
    }

    // ── Dumbbell ──────────────────────────────────────────────────────────────
    case "dumbbell": {
      const [startKey, endKey] = dumbbellKeys(spec, series);
      return (
        <div style={{ minHeight: height }}>
          <DumbbellChart
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
        </div>
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
          data={unitData}
          layout="waffle"
          style={{ height }}
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
        <TreemapChart
          data={hierarchy}
          style={{ height }}
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
        <div style={{ height }}>
          <DistributionChart
            data={resolvedData}
            valueKey={valueKey}
            groupKey={spec.group}
            kind={type}
            valueFormat={spec.valueFormat}
            currency={spec.currency}
            accessibleLabel={spec.title}
            accessibleDescription={spec.description}
            copyValueOnActivate={copyValueOnActivate}
          />
        </div>
      );
    }

    // ── Bump ──────────────────────────────────────────────────────────────────
    case "bump": {
      const measure = series[0]?.key ?? "";
      const isRank = /^(rank|position|place)$/i.test(measure.trim());
      return (
        <div style={{ minHeight: height }}>
          <BumpChart
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
          />
        </div>
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
        <div style={{ height }}>
          <BarChart
            data={resolvedData}
            xDataKey={x}
            orientation={orientation ?? "vertical"}
            aspectRatio={undefined}
            className="h-full"
            accessibleLabel={spec.title}
            accessibleDescription={spec.description}
            copyValueOnActivate={copyValueOnActivate}
          >
            <Grid horizontal />
            <Bar dataKey={valueKey} fill={color} lineCap="round" showValues zeroLine />
            <BarXAxis />
            <YAxis formatValue={yFormat} />
            <ChartTooltip />
          </BarChart>
        </div>
      );
    }

    // ── Unsupported / deferred ────────────────────────────────────────────────
    default: {
      return null;
    }
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
  /** Chart body height in pixels. Default: 280 */
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
  { spec, height = 280, loading = false, copyValueOnActivate = true, className, ...props },
  ref,
) {
  const { t } = useLocale();
  // Resolved here, above every early return, because it is a hook. `renderChart`
  // is a plain function and receives the result.
  const yFormat = useChartValueFormatter(spec.valueFormat, spec.currency);

  // ── Loading vs ready ───────────────────────────────────────────────────────
  // Same box shape as ChartFallback, but a skeleton instead of message text —
  // one status region for the whole box, not one per skeleton box.
  if (loading) {
    return (
      <div
        ref={ref}
        className={cn("w-full rounded-md", className)}
        style={{ height }}
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
        message="No data to display"
        className={cn("w-full", className)}
        style={{ height }}
        {...props}
      />
    );
  }

  if (!readsHierarchy && (!spec.series || spec.series.length === 0)) {
    return (
      <ChartFallback
        ref={ref}
        message="No data to display"
        className={cn("w-full", className)}
        style={{ height }}
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
    return (
      <ChartFallback
        ref={ref}
        message={`Chart type "${spec.type}" is not supported yet.`}
        className={cn("w-full", className)}
        style={{ height }}
        {...props}
      />
    );
  }

  // ── Normalize series ───────────────────────────────────────────────────────
  const series = normalizeSeries(spec.series);

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
  const showLegend = spec.legend ?? legendItems.length > 1;

  // ── Chart title ───────────────────────────────────────────────────────────
  const title = spec.title;

  // ── Render ────────────────────────────────────────────────────────────────
  let chartNode: ReactNode = null;
  try {
    chartNode = renderChart(type, spec, series, spec.data, height, yFormat, copyValueOnActivate);
  } catch {
    return (
      <ChartFallback
        ref={ref}
        message="No data to display"
        className={cn("w-full", className)}
        style={{ height }}
        {...props}
      />
    );
  }

  if (chartNode === null) {
    // renderChart returned null → unsupported type branch hit at runtime
    return (
      <ChartFallback
        ref={ref}
        message={`Chart type "${type}" is not supported yet.`}
        className={cn("w-full", className)}
        style={{ height }}
        {...props}
      />
    );
  }

  return (
    <div ref={ref} className={cn("flex w-full flex-col", className)} {...props}>
      {title ? <p className="mb-1 text-subtitle text-foreground">{title}</p> : null}
      {chartNode}
      {showLegend ? <AutoLegend series={legendItems} /> : null}
    </div>
  );
});
