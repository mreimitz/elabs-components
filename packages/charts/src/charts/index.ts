// Chart context and hooks

// Re-export visx gradient and pattern components for bar fill styling
export {
  GradientDarkgreenGreen,
  GradientLightgreenGreen,
  GradientOrangeRed,
  GradientPinkBlue,
  GradientPinkRed,
  GradientPurpleOrange,
  GradientPurpleTeal,
  GradientSteelPurple,
  GradientTealBlue,
  LinearGradient,
  RadialGradient,
} from "@visx/gradient";
// Area chart components
export { Area, type AreaProps } from "./area";
export { AreaChart, type AreaChartProps } from "./area-chart";
export { AreaChartLoading, type AreaChartLoadingProps } from "./area-chart-loading";
// Bar chart components
export { Bar, type BarAnimationType, type BarLineCap, type BarProps } from "./bar";
export { BarChart, type BarChartProps, type BarOrientation } from "./bar-chart";
export { BarXAxis, type BarXAxisProps } from "./bar-x-axis";
export { BarYAxis, type BarYAxisProps } from "./bar-y-axis";
export { Candlestick, type CandlestickProps } from "./candlestick";
export {
  CandlestickChart,
  type CandlestickChartProps,
  type OHLCDataPoint,
} from "./candlestick-chart";
export { ChartBrush, type ChartBrushProps, type ChartBrushSelection } from "./chart-brush";
export {
  ChartBrushLayout,
  type ChartBrushLayoutProps,
  type ChartBrushLayoutState,
} from "./chart-brush-layout";
export {
  type ChartBrushPatternPreset,
  ChartBrushSelectionOverlay,
  type ChartBrushSelectionOverlayProps,
  type ChartBrushSelectionPattern,
} from "./chart-brush-selection-overlay";
export {
  ChartBrushTrackOverlay,
  type ChartBrushTrackOverlayProps,
  type ChartBrushTrackOverlayStyle,
} from "./chart-brush-track-overlay";
export {
  chartCenterContainerClassName,
  chartCenterLabelClassName,
  chartCenterValueClassName,
} from "./chart-center-typography";
export { CHART_CLIP_PASSTHROUGH } from "./chart-child-passthrough";
export {
  ChartConfigProvider,
  type ChartConfigProviderProps,
  type ChartConfigValue,
  DEFAULT_CHART_CONFIG,
  type SpringConfig,
  useChartConfig,
} from "./chart-config-context";
export {
  type ChartContextValue,
  type ChartHoverContextValue,
  ChartProvider,
  type ChartStableContextValue,
  chartAccentColor,
  type ChartPalette,
  chartCssVars,
  chartDivergingRamp,
  chartMonoRamp,
  chartSequentialRamp,
  CATEGORICAL_SOFT_CAP,
  defaultScatterColors,
  type LineConfig,
  type Margin,
  type TooltipData,
  useChart,
  useChartHover,
  resolvePalette,
  type ResolvePaletteOptions,
  useChartStable,
  useYScale,
} from "./chart-context";
// Drill-down interaction contract (#349) — one payload shape for every family.
export type {
  ChartDatapoint,
  ChartDatapointClickHandler,
  ChartDatapointLabel,
  ChartInteractionProps,
} from "./chart-datapoint";
export {
  ChartDatapointLayer,
  type ChartDatapointLayerProps,
  ChartDatapointProvider,
  type ChartDatapointProviderProps,
  type ChartDatapointTarget,
  DEFAULT_MAX_INTERACTIVE_DATAPOINTS,
  MIN_DATAPOINT_TARGET_SIZE,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
// Legacy legend component (backward compatibility)
export { ChartLegend, type ChartLegendProps, type LegendItem } from "./chart-legend";
export { ChartLegendHoverProvider, useChartLegendHover } from "./chart-legend-hover";
export { ChartLoadingLabel, type ChartLoadingLabelProps } from "./chart-loading-label";
export {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_LIFECYCLE,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  isChartInteractionPhase,
  resolveRestingChartPhase,
} from "./chart-phase";
export { ChartRevealClip, type ChartRevealClipProps } from "./chart-reveal-clip";
export {
  ChartStatFlow,
  type ChartStatFlowFormat,
  type ChartStatFlowProps,
  defaultChartStatFlowFormat,
} from "./chart-stat-flow";
// Choropleth chart components
export {
  ChoroplethChart,
  type ChoroplethChartProps,
  type ChoroplethContextValue,
  type ChoroplethFeature,
  ChoroplethFeatureComponent,
  type ChoroplethFeatureProperties,
  type ChoroplethFeatureProps,
  ChoroplethGraticule,
  type ChoroplethGraticuleProps,
  ChoroplethProvider,
  ChoroplethTooltip,
  type ChoroplethTooltipData,
  type ChoroplethTooltipProps,
  choroplethCssVars,
  defaultChoroplethColors,
  type TransformMatrix,
  useChoropleth,
  useChoroplethZoom,
} from "./choropleth";
// Composed time-series (line + area + SeriesBar on shared time scale)
export { ComposedChart, type ComposedChartProps } from "./composed-chart";
// Funnel chart components
export {
  FunnelChart,
  type FunnelChartProps,
  type FunnelGradientStop,
  type FunnelStage,
} from "./funnel-chart";
// Gauge chart
export { Gauge, type GaugeProps } from "./gauge";
export {
  type GenerateCategoricalSkeletonDataOptions,
  type GenerateChartSkeletonDataOptions,
  generateCategoricalSkeletonData,
  generateChartSkeletonData,
} from "./generate-chart-skeleton-data";
// Shared chart elements
export { Grid, type GridProps } from "./grid";
// Composable legend components
export {
  Legend,
  type LegendContextValue,
  LegendItem as LegendItemComponent,
  type LegendItemContextValue,
  type LegendItemData,
  type LegendItemProps,
  LegendLabel,
  type LegendLabelProps,
  LegendMarker,
  type LegendMarkerProps,
  LegendProgress,
  type LegendProgressProps,
  type LegendProps,
  LegendValue,
  type LegendValueProps,
  legendCssVars,
  useLegend,
  useLegendItem,
} from "./legend";
// Line chart components
export { Line, type LineProps } from "./line";
export { LineChart, type LineChartProps } from "./line-chart";
export { LineChartLoading, type LineChartLoadingProps } from "./line-chart-loading";
export {
  type LineLoadingPulseMode,
  LineLoadingPulseStroke,
  type LineLoadingPulseStrokeProps,
  resolveLineLoadingPulseMode,
} from "./line-loading-pulse";
export {
  detectMomentum,
  LiveLine,
  type LiveLineProps,
  type Momentum,
  type MomentumColors,
} from "./live-line";
// Live line chart (real-time streaming)
export { LiveLineChart, type LiveLineChartProps, type LiveLinePoint } from "./live-line-chart";
export { LiveXAxis, type LiveXAxisProps } from "./live-x-axis";
export { LiveYAxis, type LiveYAxisProps } from "./live-y-axis";
// Marker components
export {
  type ChartMarker,
  ChartMarkers,
  type ChartMarkersProps,
  MarkerGroup,
  type MarkerGroupProps,
  MarkerTooltipContent,
  type MarkerTooltipContentProps,
  useActiveMarkers,
} from "./markers";
export { PatternArea, type PatternAreaProps } from "./pattern-area";
// Pie chart components
export { PieCenter, type PieCenterProps } from "./pie-center";
export { PieCenterShell, type PieCenterShellProps } from "./pie-center-shell";
export { DEFAULT_HOVER_OFFSET, PieChart, type PieChartProps } from "./pie-chart";
export {
  defaultPieColors,
  type PieArcData,
  type PieContextValue,
  type PieData,
  PieProvider,
  pieCssVars,
  usePie,
  usePieHover,
  usePieStable,
} from "./pie-context";
export { PieSlice, type PieSliceHoverEffect, type PieSliceProps } from "./pie-slice";
// Profit/loss line (sign-colored segments on LineChart)
export {
  PROFIT_LOSS_LEGEND_ITEMS,
  ProfitLossLegend,
  type ProfitLossLegendProps,
} from "./profit-loss-legend";
export {
  ProfitLossLegendHoverProvider,
  useProfitLossLegendHover,
} from "./profit-loss-legend-hover";
export {
  PROFIT_LOSS_NEGATIVE_COLOR,
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  ProfitLossLine,
  type ProfitLossLineProps,
  profitLossColor,
  resolveProfitLossTooltipLabel,
} from "./profit-loss-line";
export { type ProfitLossSegment, splitProfitLossSegments } from "./profit-loss-segments";
// Radar chart components
export { RadarArea, type RadarAreaProps } from "./radar-area";
export { RadarAxis, type RadarAxisProps } from "./radar-axis";
export { RadarChart, type RadarChartProps } from "./radar-chart";
export {
  defaultRadarColors,
  type RadarContextValue,
  type RadarData,
  type RadarMetric,
  RadarProvider,
  radarCssVars,
  useRadar,
  useRadarHover,
  useRadarStable,
} from "./radar-context";
export { RadarGrid, type RadarGridProps } from "./radar-grid";
export { RadarLabels, type RadarLabelsProps } from "./radar-labels";
// Ring chart components
export { Ring, type RingLineCap, type RingProps } from "./ring";
export { RingCenter, type RingCenterProps } from "./ring-center";
export { RingChart, type RingChartProps } from "./ring-chart";
export {
  defaultRingColors,
  type RingContextValue,
  type RingData,
  RingProvider,
  ringCssVars,
  useRing,
  useRingHover,
  useRingStable,
} from "./ring-context";
// Sankey chart components
export {
  SankeyChart,
  type SankeyChartProps,
  type SankeyContextValue,
  type SankeyData,
  SankeyLink,
  type SankeyLinkDatum,
  type SankeyLinkProps,
  SankeyNode,
  type SankeyNodeDatum,
  type SankeyNodeProps,
  SankeyProvider,
  SankeyTooltip,
  type SankeyTooltipData,
  type SankeyTooltipProps,
  sankeyCssVars,
  useSankey,
} from "./sankey";
// Scatter chart components
export { Scatter, type ScatterProps } from "./scatter";
export { ScatterChart, type ScatterChartProps } from "./scatter-chart";
// Segment selection components
export {
  SegmentBackground,
  type SegmentBackgroundProps,
  SegmentLineFrom,
  type SegmentLineProps,
  SegmentLineTo,
  type SegmentLineVariant,
} from "./segment";
// Series bar (time-based columns for ComposedChart)
export { SeriesBar, type SeriesBarProps } from "./series-bar";
export { SeriesMarkers, type SeriesMarkersProps } from "./series-markers";
// Decoration series-pattern foundation (#164)
export {
  isPaletteFill,
  makeSeriesPattern,
  seriesDashArray,
  seriesMarkerShape,
  seriesPattern,
  seriesPatternId,
  type SeriesMarkerShape,
  type SeriesPatternDescriptor,
  type SeriesPatternKind,
} from "./series-pattern";
export {
  getSeriesMarkerVisualExtent,
  SeriesPointMarker,
  type SeriesPointMarkerProps,
  type SeriesPointMarkerStyle,
} from "./series-point-marker";
// Decoration detection hook (#164)
export { useHighDecoration, useHighDecorationOf } from "./use-high-decoration";
// Theme --radius → px resolver for SVG bar geometry (#165)
export { useResolvedRadius, useResolvedRadiusOf } from "./use-resolved-radius";
export { StaticChartPreviewProvider, useStaticChartPreview } from "./static-chart-preview-context";
// Tooltip components
export {
  ChartTooltip,
  type ChartTooltipProps,
  ChartTooltipBox,
  type ChartTooltipBoxProps,
  ChartTooltipContent,
  type ChartTooltipContentProps,
  ChartTooltipDot,
  type ChartTooltipDotProps,
  ChartTooltipIndicator,
  type ChartTooltipIndicatorProps,
  DateTicker,
  type DateTickerProps,
  type IndicatorWidth,
  type TooltipRow,
} from "./tooltip";
export { useAnimatedYDomains } from "./use-animated-y-domains";
// Chart interaction hook
export { type ChartSelection, useChartInteraction } from "./use-chart-interaction";
export { PatternCircles, PatternHexagons, PatternLines, PatternWaves } from "./visx-pattern";
export { XAxis, type XAxisProps } from "./x-axis";
export { YAxis, type YAxisProps } from "./y-axis";
export { DEFAULT_Y_AXIS_ID, getPrimaryYScale, type YAxisOrientation } from "./y-axis-scales";
export {
  resolveYAxisTickCount,
  Y_AXIS_DEFAULT_TICK_COUNT,
  Y_AXIS_MAX_TICK_COUNT,
  Y_AXIS_MIN_TICK_COUNT,
} from "./y-axis-ticks";
// Non-temporal x-scale modes for the cartesian shell (#352).
export { type ChartXScaleType } from "./x-scale-mode";
export {
  computeYDomainsByAxis,
  isLoadingChromePhase,
  isYDomainTweenPhase,
  mergeYDomainRecords,
  niceYDomain,
  shouldTweenYDomain,
  type YDomain,
} from "./y-domain-utils";

// Editorial marks — RM-017
// The shared low-level drawing vocabulary (`packages/charts/src/marks/`): halo
// text, dashed leaders, peak rings, marginalia, hairline floors, quiet dots,
// countable unit stacks, seeded jitter, animation stagger and self-drawing
// paths. Re-exported here so the package barrel carries them alongside the
// composition primitives; see `../marks/index.ts` for the rules that hold
// across all ten.
export {
  CHART_STAGGER_BAR_MS,
  CHART_STAGGER_DOT_MS,
  DrawPath,
  type DrawPathProps,
  HairlineFloor,
  type HairlineFloorProps,
  type HairlineScale,
  HaloText,
  type HaloTextProps,
  Leader,
  type LeaderDash,
  type LeaderKind,
  type LeaderPoint,
  type LeaderProps,
  leaderPath,
  Marginalia,
  type MarginaliaProps,
  PeakRing,
  type PeakRingProps,
  type PeakRingShape,
  QUIET_DOT_SIZE,
  QuietDot,
  type QuietDotProps,
  seededRnd,
  stagger,
  UnitStack,
  type UnitStackDirection,
  type UnitStackKind,
  type UnitStackProps,
} from "../marks";

// Unit — RM-024
// UnitChart — "one mark = one honest unit": waffle / phyllotaxis-field /
// tick-row layouts, lieflat's default replacement for pie charts.
export {
  UnitChart,
  type UnitChartDatum,
  type UnitChartLayout,
  type UnitChartMark,
  type UnitChartProps,
} from "./unit-chart";
export {
  buildUnitChartSummary,
  computeArithmetic,
  computeUnitCounts,
  type FieldCluster,
  type FieldLayout,
  type FieldLayoutOptions,
  GOLDEN_ANGLE_RAD,
  layoutField,
  layoutRows,
  layoutWaffle,
  type RowsLayout,
  type RowsLayoutOptions,
  type RowsLayoutRow,
  UNIT_CHART_GROUP_STAGGER_MS,
  UNIT_CHART_POSITION_STAGGER_MS,
  type UnitArithmetic,
  unitMarkDelayMs,
  type UnitMark,
  type UnitRect,
  type WaffleLayout,
  type WaffleLayoutOptions,
} from "./unit-layouts";
