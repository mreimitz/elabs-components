/**
 * defaults-golden.ts — the frozen, hand-kept default values of every definition whose
 * component reads its props through `useResolvedChartProps` (RM-182 review, major finding).
 *
 * Once a family resolves its props through its own definition, the defaults-parity suite can no
 * longer see a changed definition default: the bare render and the explicit render both read the
 * SAME `defaults` object, so they always match. This file is the value pin instead, like
 * `contract-golden.ts` is for contracts: `definitions.test.ts` compares each adopted
 * definition's `defaults` to the row here with `toStrictEqual`.
 *
 * Every value is frozen from the destructured defaults the components carried at e1fa89f1,
 * before they adopted their definitions (constants written out as their values). The only rows
 * that did not exist then are the `status: "ready"` of ScatterChart, CandlestickChart,
 * LiveLineChart and WaterfallChart, which gained the prop in RM-182; "ready" is the one state
 * those charts had before.
 *
 * Deliberately absent, as in the definitions, because "unset" has its own behaviour: Bar and
 * Area `fill`, Scatter `fill`/`stroke`/`trend`, ScatterChart `enterTransition`, LiveLineChart
 * `plotHeight` (style height, then host or frame, then 300 px), LiveXAxis `formatTime`, YAxis
 * `valueFormat`, Bar `stackGap`/`zeroLine`, Area `gradientToOpacity`.
 *
 * A deliberate default change updates this file in the same PR; anything else failing against it
 * is a real drift. A family that adopts `useResolvedChartProps` adds its row here (the golden
 * suite fails until it does).
 *
 * Test-only: never imported by shipped code (`charts-definitions-pure` skips `__fixtures__/**`).
 */

import type { ChartDefinitionId, PartDefinitionId } from "../registry";

/** The chart definitions whose components resolve their props through their definition. */
export type AdoptedChartDefinitionId = Extract<
  ChartDefinitionId,
  | "LineChart"
  | "AreaChart"
  | "ComposedChart"
  | "BarChart"
  | "ScatterChart"
  | "CandlestickChart"
  | "LiveLineChart"
  | "WaterfallChart"
  // RM-185
  | "ChoroplethChart"
  | "HeatmapChart"
  | "Gantt"
  | "DumbbellChart"
  | "BumpChart"
>;

export const DEFAULTS_GOLDEN: Record<
  AdoptedChartDefinitionId | PartDefinitionId,
  Readonly<Record<string, unknown>>
> = {
  // ── Charts (RM-182) ──────────────────────────────────────────────────────
  LineChart: {
    xDataKey: "date",
    animationDuration: 1100,
    className: "",
    status: "ready",
    yDomainTweenDuration: 500,
    yDomainTween: true,
    tweenYDomainOnXDomainChange: false,
    tooltip: true,
  },
  AreaChart: {
    xDataKey: "date",
    animationDuration: 1100,
    className: "",
    status: "ready",
    yDomainTweenDuration: 500,
    yDomainTween: true,
    tweenYDomainOnXDomainChange: false,
    tooltip: true,
  },
  ComposedChart: {
    xDataKey: "date",
    animationDuration: 1100,
    className: "",
    status: "ready",
    barGap: 4,
    stacked: false,
    stackGap: 0,
    insetBars: true,
    tooltip: true,
  },
  BarChart: {
    xDataKey: "name",
    animationDuration: 1100,
    animationEasing: "cubic-bezier(0.85, 0, 0.15, 1)",
    className: "",
    status: "ready",
    barGap: 0.2,
    orientation: "vertical",
    stacked: false,
    stackGap: 0,
    stackOrder: "data",
    showTotals: false,
    sort: "none",
    reverse: false,
    track: false,
    comparisonLabel: "none",
    tooltip: true,
  },
  ScatterChart: {
    xDataKey: "date",
    animationDuration: 1100,
    className: "",
    status: "ready",
    tooltip: true,
  },
  CandlestickChart: {
    xDataKey: "date",
    animationDuration: 1100,
    className: "",
    candleGap: 0.2,
    tooltip: true,
    status: "ready",
  },
  LiveLineChart: {
    dataKey: "value",
    window: 30,
    numXTicks: 5,
    nowOffsetUnits: 0,
    exaggerate: false,
    lerpSpeed: 0.08,
    paused: false,
    status: "ready",
  },
  WaterfallChart: {
    connectors: true,
    dataFormat: "differences",
    grid: true,
    negativeFill: "var(--chart-2)",
    orientation: "vertical",
    positiveFill: "var(--chart-1)",
    showValues: true,
    sort: "data",
    totalFill: "var(--chart-foreground)",
    status: "ready",
  },

  // ── Charts (RM-185) ──────────────────────────────────────────────────────
  ChoroplethChart: {
    animationDuration: 800,
    center: [0, 20],
    zoomEnabled: false,
    zoomMin: 0.5,
    zoomMax: 4,
    initialZoom: {
      scaleX: 1,
      scaleY: 1,
      translateX: 0,
      translateY: 0,
      skewX: 0,
      skewY: 0,
    },
    className: "",
    hideNoData: false,
    emptyTitle: "No data",
    emptyMessage: "No region has data to map.",
  },
  HeatmapChart: {
    cellRadius: 4,
    emptyMessage: "No data to plot.",
    emptyTitle: "No data",
    emptyMarkScale: 0.6,
    emptyValue: "quiet",
    highlight: "max",
    loading: false,
    palette: "sequential",
    revealOn: "mount",
    legendLabels: "endpoints",
    showLegend: true,
    showValueHalo: true,
    steps: 5,
    variant: "matrix",
  },
  Gantt: {
    density: "comfortable",
    labelColumnWidth: 240,
    loading: false,
  },
  DumbbellChart: {
    orientation: "horizontal",
    variant: "dumbbell",
    markers: { start: "hollow", end: "filled" },
    range: false,
    showDelta: false,
    bothEndsLabeled: false,
    showValueAxis: false,
    sortBy: "none",
    reverse: false,
    copyValueOnActivate: false,
  },
  BumpChart: {
    variant: "lines",
    showDelta: false,
    maxEntities: 10,
    copyValueOnActivate: false,
  },

  // ── Parts (RM-182) ───────────────────────────────────────────────────────
  XAxis: {
    orientation: "bottom",
    titlePlacement: "outside",
    tickerHalfWidth: 50,
    tickMode: "domain",
    periodTicks: false,
  },
  YAxis: {
    orientation: "left",
    titlePlacement: "outside",
    labelPlacement: "outside",
    unitOn: "last",
    matchSeriesColor: false,
  },
  BarValueAxis: {
    position: "bottom",
  },
  LiveXAxis: {
    numTicks: 5,
  },
  Grid: {
    mode: "lines",
    horizontal: true,
    vertical: false,
    numTicksColumns: 10,
    stroke: "var(--chart-grid)",
    strokeOpacity: 1,
    strokeWidth: 0.65,
    strokeDasharray: "4,4",
    highlightRowStroke: "var(--chart-foreground-muted)",
    highlightRowStrokeOpacity: 1,
    highlightRowStrokeWidth: 1,
    highlightRowStrokeDasharray: "0",
    highlightColumnStroke: "var(--chart-foreground-muted)",
    highlightColumnStrokeOpacity: 1,
    highlightColumnStrokeWidth: 1,
    highlightColumnStrokeDasharray: "0",
    fadeHorizontal: true,
    fadeVertical: false,
    shimmer: false,
    shimmerStroke: "color-mix(in oklch, var(--foreground) 68%, transparent)",
    shimmerLength: 140,
    shimmerSpeed: 1,
    shimmerSync: false,
  },
  Bar: {
    fillStyle: "solid",
    lineCap: "round",
    animate: true,
    animationType: "grow",
    fadedOpacity: 0.3,
    groupGap: 4,
  },
  Line: {
    stroke: "var(--chart-line-primary)",
    strokeWidth: 2.5,
    curve: "monotone",
    animate: true,
    fadeEdges: true,
    showHighlight: true,
    showMarkers: false,
    outline: false,
    dashArray: "6,4",
    loadingStroke: "var(--chart-foreground)",
    loadingStrokeOpacity: 0.5,
  },
  Area: {
    fillOpacity: 0.4,
    strokeWidth: 2,
    curve: "monotone",
    animate: true,
    showLine: true,
    showHighlight: true,
    gradientSpan: 1,
    fadeEdges: false,
    showMarkers: false,
    dashArray: "6,4",
    loadingStroke: "var(--chart-foreground)",
    loadingStrokeOpacity: 0.5,
    labelPeaks: false,
  },
  Scatter: {
    strokeWidth: 2,
    ringGap: 2,
    outlineWidth: 0,
    radius: 5,
    animate: true,
    fadeOnHover: true,
    inactiveOpacity: 0.5,
    inactiveBlur: 2,
    enterBlur: 2,
    showActiveHighlight: true,
    dropLines: false,
    fadedOpacity: 0.35,
    yType: "number",
    sizeRange: [4, 22],
  },
  ReferenceLine: {
    labelPosition: "end",
    strokeWidth: 1.5,
  },
};
