/**
 * primitives.tsx — inert stand-ins for the COMPOSITION PRIMITIVES of
 * `@elabs/components-charts`, so the `./test` module namespace is
 * COMPLETE (issue #364).
 *
 * WHY THIS EXISTS (the bug it fixes): the documented consumer wiring is a
 * `vi.mock` FACTORY —
 *
 * ```ts
 * vi.mock("@elabs/components-charts", async () =>
 *   import("@elabs/components-charts/test"));
 * ```
 *
 * — and Vitest wraps a factory's result in a proxy that THROWS on any export the
 * factory did not return:
 *
 *     [vitest] No "Line" export is defined on the
 *     "@elabs/components-charts" mock.
 *
 * The throw happens when the consumer's module reads the binding (`<Line …/>`),
 * long before React would decide whether to reconcile it — so "a container
 * double never mounts its children, therefore a missing `Line` never throws" is
 * FALSE for the wiring this package documents. Without these stand-ins the
 * canonical composition `<LineChart><Line dataKey="revenue" /></LineChart>` —
 * i.e. essentially every real chart in a consuming app — fails on import.
 *
 * WHAT THEY DO: nothing. A container double only INSPECTS its children (via
 * `React.Children`, to validate declared series `dataKey`s) and never mounts
 * them, so these parts exist to make the named export RESOLVE, carrying their
 * props for that inspection. A `*Provider` passes `children` through (a
 * provider that swallowed its subtree would delete the consumer's tree rather
 * than stand in for it); everything else renders `null`.
 *
 * NOT COVERED, and why there is an escape hatch: the barrel's SCREAMING_SNAKE
 * constants live in `@visx`-backed modules (`DEFAULT_HOVER_OFFSET` in
 * `pie-chart.tsx`, `PROFIT_LOSS_*` in `profit-loss-line.tsx`), and hooks
 * (`useChart`, …) / utility functions (`chartCssVars`, `inferChartType`, …)
 * cannot be faithfully faked. A test that needs one of those — or that asserts
 * on a primitive's real MARKUP — composes the two modules instead:
 *
 * ```ts
 * vi.mock("@elabs/components-charts", async (importOriginal) => ({
 *   ...(await importOriginal<Record<string, unknown>>()),
 *   ...(await import("@elabs/components-charts/test")),
 * }));
 * ```
 *
 * That form pulls the real engine into the test's module graph (importing
 * `@visx` under jsdom is safe — only RENDERING a visx chart is not), so it is
 * slower; prefer the plain form.
 *
 * PARITY IS ENFORCED, not remembered: `pnpm charts:test-double:check` rung (a)
 * fails when a PascalCase component export of the real barrel has no same-named
 * export here or in `./doubles`.
 */
"use client";

import type { ReactNode } from "react";

interface InertPartProps {
  children?: ReactNode;
  [key: string]: unknown;
}

// NOTE: plain function components, deliberately NOT `forwardRef`. A stand-in
// renders no host element, so there is nothing a ref could ever attach to, and
// a `forwardRef` render function that ignores its `ref` parameter makes React
// log "forwardRef render functions accept exactly two parameters" for every
// part on every render — console noise in the consumer's test output for zero
// benefit. (React 19 passes `ref` as an ordinary prop anyway.)

/** A part that renders nothing — it exists so the named export resolves. */
function createInertPart(name: string) {
  const Part = (_props: InertPartProps) => null;
  Part.displayName = name;
  return Part;
}

/** A provider stand-in — renders `children` so the consumer's subtree survives. */
function createPassThroughPart(name: string) {
  const Part = (props: InertPartProps) => <>{props.children}</>;
  Part.displayName = name;
  return Part;
}

// ── Context providers — pass `children` THROUGH (a provider that swallowed its
//    subtree would delete the consumer's tree, not stand in for it). ──────────
export const ChartConfigProvider = createPassThroughPart("ChartConfigProvider");
export const ChartDatapointProvider = createPassThroughPart("ChartDatapointProvider");
export const ChartLegendHoverProvider = createPassThroughPart("ChartLegendHoverProvider");
export const ChartProvider = createPassThroughPart("ChartProvider");
export const ChoroplethProvider = createPassThroughPart("ChoroplethProvider");
export const PieProvider = createPassThroughPart("PieProvider");
export const ProfitLossLegendHoverProvider = createPassThroughPart("ProfitLossLegendHoverProvider");
export const RadarProvider = createPassThroughPart("RadarProvider");
export const RingProvider = createPassThroughPart("RingProvider");
export const SankeyProvider = createPassThroughPart("SankeyProvider");
export const StaticChartPreviewProvider = createPassThroughPart("StaticChartPreviewProvider");

// ── Series / axis / legend / tooltip / pattern parts — inert (never mounted by a
//    container double; see the header). ────────────────────────────────────────
export const Area = createInertPart("Area");
export const AreaChartLoading = createInertPart("AreaChartLoading");
export const Bar = createInertPart("Bar");
export const BarXAxis = createInertPart("BarXAxis");
export const BarYAxis = createInertPart("BarYAxis");
export const Candlestick = createInertPart("Candlestick");
export const ChartBrush = createInertPart("ChartBrush");
export const ChartBrushLayout = createInertPart("ChartBrushLayout");
export const ChartBrushSelectionOverlay = createInertPart("ChartBrushSelectionOverlay");
export const ChartBrushTrackOverlay = createInertPart("ChartBrushTrackOverlay");
// The keyboard drill-down layer (#349) renders real <button>s beside the SVG in
// the live component; as a stand-in it is inert like every other part — a double
// plots nothing, so there are no datapoints to expose. A test that asserts on the
// real targets needs the real chart, not the double.
export const ChartDatapointLayer = createInertPart("ChartDatapointLayer");
export const ChartFallback = createInertPart("ChartFallback");
export const ChartLegend = createInertPart("ChartLegend");
export const ChartLoadingLabel = createInertPart("ChartLoadingLabel");
export const ChartMarkers = createInertPart("ChartMarkers");
export const ChartRevealClip = createInertPart("ChartRevealClip");
export const ChartStatFlow = createInertPart("ChartStatFlow");
export const ChartTooltip = createInertPart("ChartTooltip");
export const ChartTooltipBox = createInertPart("ChartTooltipBox");
export const ChartTooltipContent = createInertPart("ChartTooltipContent");
export const ChartTooltipDot = createInertPart("ChartTooltipDot");
export const ChartTooltipIndicator = createInertPart("ChartTooltipIndicator");
export const ChoroplethFeatureComponent = createInertPart("ChoroplethFeatureComponent");
export const ChoroplethGraticule = createInertPart("ChoroplethGraticule");
export const ChoroplethTooltip = createInertPart("ChoroplethTooltip");
export const DateTicker = createInertPart("DateTicker");
export const Gauge = createInertPart("Gauge");
export const GradientDarkgreenGreen = createInertPart("GradientDarkgreenGreen");
export const GradientLightgreenGreen = createInertPart("GradientLightgreenGreen");
export const GradientOrangeRed = createInertPart("GradientOrangeRed");
export const GradientPinkBlue = createInertPart("GradientPinkBlue");
export const GradientPinkRed = createInertPart("GradientPinkRed");
export const GradientPurpleOrange = createInertPart("GradientPurpleOrange");
export const GradientPurpleTeal = createInertPart("GradientPurpleTeal");
export const GradientSteelPurple = createInertPart("GradientSteelPurple");
export const GradientTealBlue = createInertPart("GradientTealBlue");
export const Grid = createInertPart("Grid");
export const Legend = createInertPart("Legend");
export const LegendItemComponent = createInertPart("LegendItemComponent");
export const LegendLabel = createInertPart("LegendLabel");
export const LegendMarker = createInertPart("LegendMarker");
export const LegendProgress = createInertPart("LegendProgress");
export const LegendValue = createInertPart("LegendValue");
export const Line = createInertPart("Line");
export const LineChartLoading = createInertPart("LineChartLoading");
export const LineLoadingPulseStroke = createInertPart("LineLoadingPulseStroke");
export const LinearGradient = createInertPart("LinearGradient");
export const LiveLine = createInertPart("LiveLine");
export const LiveXAxis = createInertPart("LiveXAxis");
export const LiveYAxis = createInertPart("LiveYAxis");
export const MarkerGroup = createInertPart("MarkerGroup");
export const MarkerTooltipContent = createInertPart("MarkerTooltipContent");
export const PatternArea = createInertPart("PatternArea");
export const PatternCircles = createInertPart("PatternCircles");
export const PatternHexagons = createInertPart("PatternHexagons");
export const PatternLines = createInertPart("PatternLines");
export const PatternWaves = createInertPart("PatternWaves");
export const PieCenter = createInertPart("PieCenter");
export const PieCenterShell = createInertPart("PieCenterShell");
export const PieSlice = createInertPart("PieSlice");
export const ProfitLossLegend = createInertPart("ProfitLossLegend");
export const ProfitLossLine = createInertPart("ProfitLossLine");
export const RadarArea = createInertPart("RadarArea");
export const RadarAxis = createInertPart("RadarAxis");
export const RadarGrid = createInertPart("RadarGrid");
export const RadarLabels = createInertPart("RadarLabels");
export const RadialGradient = createInertPart("RadialGradient");
export const Ring = createInertPart("Ring");
export const RingCenter = createInertPart("RingCenter");
export const SankeyLink = createInertPart("SankeyLink");
export const SankeyNode = createInertPart("SankeyNode");
export const SankeyTooltip = createInertPart("SankeyTooltip");
export const Scatter = createInertPart("Scatter");
export const SegmentBackground = createInertPart("SegmentBackground");
export const SegmentLineFrom = createInertPart("SegmentLineFrom");
export const SegmentLineTo = createInertPart("SegmentLineTo");
export const SeriesBar = createInertPart("SeriesBar");
export const SeriesMarkers = createInertPart("SeriesMarkers");
export const SeriesPointMarker = createInertPart("SeriesPointMarker");
export const XAxis = createInertPart("XAxis");
export const YAxis = createInertPart("YAxis");
