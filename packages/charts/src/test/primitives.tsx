/**
 * primitives.tsx — inert stand-ins for the COMPOSITION PRIMITIVES of
 * `@elabs-ai/components-charts`, so the `./test` module namespace is
 * COMPLETE (issue #364).
 *
 * WHY THIS EXISTS (the bug it fixes): the documented consumer wiring is a
 * `vi.mock` FACTORY —
 *
 * ```ts
 * vi.mock("@elabs-ai/components-charts", async () =>
 *   import("@elabs-ai/components-charts/test"));
 * ```
 *
 * — and Vitest wraps a factory's result in a proxy that THROWS on any export the
 * factory did not return:
 *
 *     [vitest] No "Line" export is defined on the
 *     "@elabs-ai/components-charts" mock.
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
 * vi.mock("@elabs-ai/components-charts", async (importOriginal) => ({
 *   ...(await importOriginal<Record<string, unknown>>()),
 *   ...(await import("@elabs-ai/components-charts/test")),
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
// ── Editorial marks (RM-017) — inert like every other part. A mark is a bare SVG
//    element, so a stand-in that rendered one would put an <svg> outside any
//    <svg> in the consumer's jsdom tree; the export exists so the mocked
//    namespace RESOLVES, which is the whole job (see the header). `seededRnd`
//    and `stagger` are pure FUNCTIONS and deliberately NOT doubled — the parity
//    gate scopes to PascalCase components, and a test that needs the real hash
//    composes the two modules via the `importOriginal` form above. ────────────
export const DrawPath = createInertPart("DrawPath");
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
export const HairlineFloor = createInertPart("HairlineFloor");
export const HaloText = createInertPart("HaloText");
export const Leader = createInertPart("Leader");
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
export const Marginalia = createInertPart("Marginalia");
export const MarkerGroup = createInertPart("MarkerGroup");
export const MarkerTooltipContent = createInertPart("MarkerTooltipContent");
export const PatternArea = createInertPart("PatternArea");
export const PatternCircles = createInertPart("PatternCircles");
export const PatternHexagons = createInertPart("PatternHexagons");
export const PatternLines = createInertPart("PatternLines");
export const PatternWaves = createInertPart("PatternWaves");
export const PeakRing = createInertPart("PeakRing");
export const PieCenter = createInertPart("PieCenter");
export const PieCenterShell = createInertPart("PieCenterShell");
export const PieSlice = createInertPart("PieSlice");
export const ProfitLossLegend = createInertPart("ProfitLossLegend");
export const ProfitLossLine = createInertPart("ProfitLossLine");
export const QuietDot = createInertPart("QuietDot");
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
export const UnitStack = createInertPart("UnitStack");
export const XAxis = createInertPart("XAxis");
export const YAxis = createInertPart("YAxis");

// ── CanvasLayer — RM-046 ─────────────────────────────────────────────────────
// Inert like every other part: the real layer paints into a 2D context, and
// jsdom's `HTMLCanvasElement.getContext` returns `null` without the optional
// `canvas` package, so a stand-in that rendered a real <canvas> would be a
// surface that never paints. The export exists so the mocked namespace
// RESOLVES (see the header).
export const CanvasLayer = createInertPart("CanvasLayer");

/**
 * A recording stand-in for `CanvasRenderingContext2D`, so a consumer can assert
 * what a `draw` callback DID without a browser.
 *
 * jsdom has no 2D context at all: `canvas.getContext("2d")` is `null` unless the
 * native `canvas` package is installed, which this repo deliberately does not
 * depend on. So the choice for a consumer testing a canvas view is "assert
 * nothing" or "hand the callback a context you can read back" — this is the
 * second. Every method is a no-op that appends to `calls`; every settable
 * property (`fillStyle`, `strokeStyle`, `lineWidth`, `globalAlpha`, `font`)
 * is a real property, so a callback that reads back what it set behaves.
 *
 * ```ts
 * const ctx = createCanvasContextStub();
 * draw(ctx.context, scales, 2);
 * expect(ctx.calls.filter((c) => c.method === "fillRect")).toHaveLength(50_000);
 * expect(ctx.context.fillStyle).toBe("#123456");
 * ```
 *
 * Pair it with `installCanvasContextStub()` when the component under test owns
 * its own canvas element and you cannot reach the context yourself.
 */
export interface CanvasContextStub {
  /** Pass this where a `CanvasRenderingContext2D` is expected. */
  context: CanvasRenderingContext2D;
  /** Every method call, in order. */
  calls: { method: string; args: unknown[] }[];
  /** Drop the recorded calls, keeping the same context object. */
  reset: () => void;
}

/** Methods a chart `draw` callback realistically reaches for. */
const CANVAS_STUB_METHODS = [
  "arc",
  "beginPath",
  "clearRect",
  "clip",
  "closePath",
  "createLinearGradient",
  "drawImage",
  "ellipse",
  "fill",
  "fillRect",
  "fillText",
  "lineTo",
  "measureText",
  "moveTo",
  "rect",
  "resetTransform",
  "restore",
  "rotate",
  "save",
  "scale",
  "setLineDash",
  "setTransform",
  "stroke",
  "strokeRect",
  "strokeText",
  "transform",
  "translate",
] as const;

export function createCanvasContextStub(canvas?: HTMLCanvasElement): CanvasContextStub {
  const calls: { method: string; args: unknown[] }[] = [];
  const context = {
    canvas: canvas ?? null,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;

  for (const method of CANVAS_STUB_METHODS) {
    (context as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      // `measureText` has a return contract callers divide by; the rest do not.
      return method === "measureText" ? ({ width: 0 } as TextMetrics) : undefined;
    };
  }

  return {
    context,
    calls,
    reset: () => {
      calls.length = 0;
    },
  };
}

/**
 * Patches `HTMLCanvasElement.prototype.getContext` so every canvas in the test
 * hands back one shared {@link CanvasContextStub}. Returns the stub plus a
 * `restore()` — call it in `afterEach`, or the patch leaks into the next file.
 */
export function installCanvasContextStub(): CanvasContextStub & { restore: () => void } {
  const stub = createCanvasContextStub();
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function patched(this: HTMLCanvasElement, kind: string) {
    if (kind === "2d") {
      (stub.context as unknown as { canvas: HTMLCanvasElement }).canvas = this;
      return stub.context;
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    ...stub,
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}
