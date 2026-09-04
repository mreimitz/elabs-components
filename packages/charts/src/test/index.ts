/**
 * @elabs-ai/components-charts/test — the official jsdom-safe test double for `@elabs-ai/components-charts`
 * (issue #364).
 *
 * A `@visx/*`-backed chart does not render meaningfully under jsdom, so a
 * consumer's test suite has historically mocked the whole `@elabs-ai/components-charts`
 * barrel as a no-op — hiding real chart-prop bugs from the quality gate. Swap
 * to this subpath instead:
 *
 * ```ts
 * // vitest.setup.ts
 * vi.mock("@elabs-ai/components-charts", async () =>
 *   import("@elabs-ai/components-charts/test"),
 * );
 * ```
 *
 * Every double re-declares the real component's runtime value-contract
 * (`assertChartContract` in `./contract.ts`) and THROWS a `ChartContractError`
 * on a missing/invalid required prop — so a test that would crash the real
 * chart (a missing `data`, an unparsable date, a declared series `dataKey`
 * absent from the rows) still fails, exactly where the real component would.
 *
 * See `.claude/rules/chart-components.md` § "Test double" and
 * `docs/playbooks` / the "Testing charts in jsdom" Storybook doc page.
 *
 * COVERED: every chart CONTAINER (contract-validated — see `doubles.tsx`) plus
 * every composition primitive and context provider the real barrel exports, as
 * inert stand-ins (see `primitives.tsx`). The primitives carry no behaviour —
 * they exist so the mocked module namespace is COMPLETE, because Vitest's
 * `vi.mock` factory proxy THROWS on any export the factory omits (`[vitest] No
 * "Line" export is defined on the … mock`) the moment the consumer's module
 * reads the binding, i.e. long before React decides whether to mount it.
 *
 * NOT covered — the barrel's SCREAMING_SNAKE constants (`DEFAULT_HOVER_OFFSET`,
 * `PROFIT_LOSS_*`, … — they live in `@visx`-backed modules, so re-exporting
 * them would drag the engine back in), its hooks (`useChart`, `useChartHover`,
 * …) and its utility functions (`chartCssVars`, `inferChartType`, …). A test
 * that needs one of those, or that asserts on a primitive's real MARKUP,
 * composes the two modules instead:
 *
 * ```ts
 * vi.mock("@elabs-ai/components-charts", async (importOriginal) => ({
 *   ...(await importOriginal<Record<string, unknown>>()),
 *   ...(await import("@elabs-ai/components-charts/test")),
 * }));
 * ```
 *
 * (importing `@visx` under jsdom is safe — only RENDERING a visx chart is not —
 * so that form works; it is just slower.)
 *
 * Deliberately EXCLUDED from `brand-ui.manifest.json` (`readSubpathBarrels` in
 * `packages/cli/lib/core.mjs`) — the manifest is the agent-facing BUILD-WITH
 * catalogue, and listing a second `LineChart` under a `/test` import path would
 * cause exactly the hallucination the manifest exists to prevent.
 */

// ── The contract engine + diagnostics ────────────────────────────────────────
export {
  assertChartContract,
  buildChartDoublePayload,
  ChartContractError,
  configureChartTestDouble,
  readChartDoubleProps,
  resetChartTestDoubleConfig,
} from "./contract";
export type { ChartContractSpec, ChartDoublePayload, ChartDoubleViolationMode } from "./contract";

// ── The doubles ───────────────────────────────────────────────────────────────
export {
  AreaChart,
  AutoChart,
  BarChart,
  CandlestickChart,
  CHART_CONTRACT_SPECS,
  ChartCard,
  ChartFrame,
  ChoroplethChart,
  ComposedChart,
  DumbbellChart,
  FunnelChart,
  Gantt,
  // Heatmap — RM-021
  HeatmapChart,
  LineChart,
  LiveLineChart,
  MetricCard,
  MetricGrid,
  PieChart,
  RadarChart,
  RingChart,
  SankeyChart,
  ScatterChart,
  Sparkline,
} from "./doubles";

// ── Composition primitives + providers (inert stand-ins — see primitives.tsx) ─
export {
  Area,
  AreaChartLoading,
  Bar,
  BarXAxis,
  BarYAxis,
  Candlestick,
  ChartBrush,
  ChartBrushLayout,
  ChartBrushSelectionOverlay,
  ChartBrushTrackOverlay,
  ChartConfigProvider,
  ChartDatapointLayer,
  ChartDatapointProvider,
  ChartFallback,
  ChartLegend,
  ChartLegendHoverProvider,
  ChartLoadingLabel,
  ChartMarkers,
  ChartProvider,
  ChartRevealClip,
  ChartStatFlow,
  ChartTooltip,
  ChartTooltipBox,
  ChartTooltipContent,
  ChartTooltipDot,
  ChartTooltipIndicator,
  ChoroplethFeatureComponent,
  ChoroplethGraticule,
  ChoroplethProvider,
  ChoroplethTooltip,
  DateTicker,
  DrawPath,
  Gauge,
  GradientDarkgreenGreen,
  GradientLightgreenGreen,
  GradientOrangeRed,
  GradientPinkBlue,
  GradientPinkRed,
  GradientPurpleOrange,
  GradientPurpleTeal,
  GradientSteelPurple,
  GradientTealBlue,
  Grid,
  HairlineFloor,
  HaloText,
  Leader,
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  LegendProgress,
  LegendValue,
  Line,
  LineChartLoading,
  LineLoadingPulseStroke,
  LinearGradient,
  LiveLine,
  LiveXAxis,
  LiveYAxis,
  Marginalia,
  MarkerGroup,
  MarkerTooltipContent,
  PatternArea,
  PatternCircles,
  PatternHexagons,
  PatternLines,
  PatternWaves,
  PeakRing,
  PieCenter,
  PieCenterShell,
  PieProvider,
  PieSlice,
  ProfitLossLegend,
  ProfitLossLegendHoverProvider,
  ProfitLossLine,
  QuietDot,
  RadarArea,
  RadarAxis,
  RadarGrid,
  RadarLabels,
  RadarProvider,
  RadialGradient,
  Ring,
  RingCenter,
  RingProvider,
  SankeyLink,
  SankeyNode,
  SankeyProvider,
  SankeyTooltip,
  Scatter,
  SegmentBackground,
  SegmentLineFrom,
  SegmentLineTo,
  SeriesBar,
  SeriesMarkers,
  SeriesPointMarker,
  StaticChartPreviewProvider,
  UnitStack,
  XAxis,
  YAxis,
} from "./primitives";

// ── Type parity (erased at runtime — never pulls @visx) ─────────────────────
export type { AreaChartProps } from "../charts/area-chart";
export type { AutoChartProps } from "../auto-chart/auto-chart";
export type { BarChartProps } from "../charts/bar-chart";
export type { CandlestickChartProps, OHLCDataPoint } from "../charts/candlestick-chart";
export type { ChartCardProps } from "../chart-card/chart-card";
export type { ChartFrameProps } from "../chart-frame/chart-frame";
export type { ChoroplethChartProps } from "../charts/choropleth/choropleth-chart";
export type { ChoroplethFeatureProperties } from "../charts/choropleth/choropleth-context";
export type { ComposedChartProps } from "../charts/composed-chart";
export type { DumbbellChartProps } from "../charts/dumbbell-chart";
export type { FunnelChartProps, FunnelStage } from "../charts/funnel-chart";
export type { GanttProps, GanttTask } from "../gantt/gantt";
export type { LineChartProps } from "../charts/line-chart";
export type { LiveLineChartProps, LiveLinePoint } from "../charts/live-line-chart";
export type { MetricCardProps } from "@elabs-ai/components-ui";
export type { MetricGridProps } from "../metric-grid/metric-grid";
export type { PieChartProps } from "../charts/pie-chart";
export type { PieData } from "../charts/pie-context";
export type { RadarChartProps } from "../charts/radar-chart";
export type { RadarData, RadarMetric } from "../charts/radar-context";
export type { RingChartProps } from "../charts/ring-chart";
export type { RingData } from "../charts/ring-context";
export type { SankeyChartProps, SankeyData } from "../charts/sankey/sankey-chart";
export type { ScatterChartProps } from "../charts/scatter-chart";
export type { SparklineProps } from "../sparkline/sparkline";
