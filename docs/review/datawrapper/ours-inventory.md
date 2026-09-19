# `@elabs-ai/components-charts` — capability inventory (ground truth for Datawrapper gap analysis)

Source: `packages/charts/src` @ package version **4.2.0** (read 2026-09-18, on-device, read-only). Props are transcribed from the exported `*Props` interfaces; defaults are from the JSDoc / destructuring defaults. Where behaviour is inferred rather than stated, it is marked _(inferred)_.

Stack: React 19 · visx (`@visx/shape|scale|responsive|brush|geo|sankey|zoom|gradient|pattern|grid`) · d3-array/force/geo/hierarchy/sankey/scale/shape · `motion` · `react-use-measure` · `@number-flow/react` · zustand (dashboard) · `@dnd-kit/core` (dashboard edit). Peer: `@elabs-ai/components-ui`, `@elabs-ai/components-tokens`.

Subpaths: `.` (charts), `./test` (validating jsdom double), `./dashboard`, `./dashboard/test`, `./dashboard/schema.json`.

Architecture in one paragraph: every cartesian container is a _composition_ container — `<LineChart data …><Grid/><Line dataKey/><XAxis/><YAxis/><ChartTooltip/></LineChart>`. Legends are **separate** components the caller composes (`ChartLegend`, `Legend`), never auto-drawn (except by `AutoChart`). Axes and tooltips are **HTML portals** positioned over an `aria-hidden` `<svg>`; keyboard access is a sibling `ChartDatapointLayer` of real `<button>`s. Title/description/source/table-flip/CSV/SVG/PNG chrome lives in `ChartFrame`, not in the chart.

---

## 1. Chart containers and their public props

Shared prop bundles (referenced below):

- **`ChartA11yProps`**: `accessibleLabel?: string` (name of the `role="figure"` region) · `accessibleDescription?: string` (sr-only, `aria-describedby`).
- **`ChartInteractionProps<T>`** (drill-down, #349): `onDatapointClick?: (point: ChartDatapoint, event) => void` · `copyValueOnActivate?: boolean` (default false; AutoChart true) · `datapointLabel?: ChartDatapointLabel` (override accessible name per target) · `maxInteractiveDatapoints?: number` (default 500, dev-warn threshold).
- **`ChartSelectionProps`** (RM-073): `selectionStates?: (category, seriesKey?, datum?) => "selected"|"associated"|"excluded"` · `dimExcluded?: boolean` (default true; excluded = ghost opacity + dashed frame + `data-selection` attr).
- **`ChartHoverLinkProps`** (shared crosshair across sibling charts): `hoverCategory?: string|number|Date|null` · `onHoverCategory?: (category) => void`.
- **Motion bundle** (most containers): `animationDuration?: number` (1100 ms) · `animationEasing?: string` · `enterTransition?: Transition` (motion spring/tween) · `revealSignature?: string` (replays reveal on change) · `revealOn?: "mount"|"inView"` · `replayOnClick?: boolean` · `onPhaseChange?: (phase: ChartPhase) => void`.
- **Loading bundle**: `status?: "loading"|"ready"` · `loadingLabel?: string` · `yDomainTween?: boolean` (true) · `yDomainTweenDuration?: number` (500).

### 1.1 LineChart (`charts/line-chart.tsx`) — extends ChartSelectionProps, ChartHoverLinkProps

- data: `data: Record<string,unknown>[]` · `xDataKey?: string` ("date") · `xScale?: "time"|"band"|"linear"` (default time; auto-falls back to band with dev warning if no Date-coercible values)
- axes/domain: `xDomain?: [Date, Date]` (brush zoom) · `xDomainSlotCount?: number` · `tweenYDomainOnXDomainChange?: boolean`; y-domain is auto (`[0, max*1.1]` when all ≥0, else padded min/max); **no `yDomain`/`yMin`/`yMax` prop** on the container
- layout: `margin?: Partial<Margin>` · `aspectRatio?: string` ("2 / 1"; omit to fill a sized parent) · `className` · `style`
- motion + loading bundles (`revealOn`, `replayOnClick`, `status`, `loadingLabel`, `yDomainTween*`)
- interaction: ChartInteractionProps · ChartSelectionProps · ChartHoverLinkProps
- a11y: ChartA11yProps
- `children: ReactNode` (Line, Area, AreaBand, Grid, XAxis, YAxis, ChartTooltip, ChartMarkers, ChartBrush, SeriesMarkers, ProfitLossLine, marks…)

**`Line`** (series mark): `dataKey` · `yAxisId?: string|number` ("left") · `stroke?` (`var(--chart-line-primary)`) · `strokeWidth?` (2.5) · `curve?: CurveFactory` (curveNatural; any `@visx/curve`) · `animate?` · `fadeEdges?: boolean|"left"|"right"` · `showHighlight?` (hover band) · `showMarkers?` · `markers?: SeriesPointMarkerStyle` · `markerStyle?: (d, i) => "filled"|"hollow"|"none"` · `labelPeaks?: number|{count, minGap}` (top-k peaks labelled with HaloText) · `dashFromIndex?: number` + `dashArray?` ("6,4") + `dashStroke?` (projection tail) · `loading?`, `loadingStroke?`, `loadingStrokeOpacity?`, `loadingPulseMode?`, `onLoadingPulseCycleComplete?` · `seriesIndex?` (pattern/dash slot under high decoration).

### 1.2 AreaChart (`charts/area-chart.tsx`) — same props as LineChart plus

- stacking: `offset?: "none"|"silhouette"|"wiggle"|"expand"` (d3 stack offsets; **unset = no stacking**, each Area from baseline; `expand` = 100%) · `seams?: number` (paper gap px between bands) · `labelBands?: boolean` (series name at band's widest x, HaloText)
- **`Area`**: `dataKey` · `yAxisId?` · `fill?` · `fillOpacity?` (0.4) · `stroke?` · `strokeWidth?` (2) · `curve?` (curveMonotoneX) · `animate?` · `showLine?` · `showHighlight?` · `gradientToOpacity?` · `gradientSpan?` · `fadeEdges?` · `showMarkers?` · `markers?` · `dashFromIndex?` · `dashArray?` · loading props · `labelPeaks?: boolean`
- **`AreaBand`** (range/confidence band): `lowKey` · `highKey` · `fill?` · `fillOpacity?` · `curve?` · `yAxisId?` · `className?`

### 1.3 BarChart (`charts/bar-chart.tsx`) — extends ChartSelectionProps

- data: `data` · `xDataKey?` ("name")
- encoding: `orientation?: "vertical"|"horizontal"` · `stacked?: boolean` · `stackGap?: number` · `barGap?: number` (0.2 of band) · `barWidth?: number` (fixed px) · `palette?: ChartPalette` (default fill for Bars via `resolvePalette`)
- layout: `margin?` · `aspectRatio?` ("2 / 1") · `className`
- motion + loading bundles · `onPhaseChange`
- interaction: ChartInteractionProps · ChartSelectionProps (no hover-link)
- a11y: ChartA11yProps
- children: Bar, Grid, BarXAxis, BarYAxis, ChartTooltip, visx patterns/gradients
- Value domain: `resolveBarValueDomain` — always zero-based (`[0, max*1.1]`, or `[min*1.1, max*1.1]` for negatives); stacked = positive & negative towers summed separately (diverging stacks). **No 100%-stacked mode for bars** (only AreaChart `offset="expand"`). **No sort prop** (caller sorts data).

**`Bar`**: `dataKey` · `yAxisId?` · `fill?` (color | `url(#gradient)` | `url(#pattern)`) · `stroke?` · `lineCap?: "round"|"butt"|number` · `animate?` · `animationType?: "grow"|"fade"` · `fadedOpacity?` (0.3) · `staggerDelay?` · `stackGap?` · `groupGap?` (4) · `showValues?: boolean|"outside"|"inside"` (HaloText value labels) · `unit?: number` (countable UnitStack rungs) · `highlightKey?: string|number|(d,i)=>boolean` (one hero bar in `--chart-foreground`, rest from `palette`) · `palette?` · `zeroLine?: boolean` (auto when any negative).

### 1.4 ScatterChart (`charts/scatter-chart.tsx`) — extends ChartSelectionProps

- `data` · `xDataKey?` ("date") · `xScale?: "time"|"linear"` (linear inferred when all numbers; **`"band"` deliberately unsupported**, warns) · `margin?` · `animationDuration?` · `animationEasing?` · `enterTransition?` · `revealSignature?` · `aspectRatio?` · `className` · `children` · `onPhaseChange?` · ChartA11yProps. (No ChartInteractionProps on the container.)
- **`Scatter`** extends `SeriesMarkersProps` (`dataKey`, `fill?`, `animate?` + `SeriesPointMarkerStyle`: `stroke?`, `strokeWidth?` (2), `ringGap?`, `outlineWidth?`, `outlineColor?`, `radius?` (5), `fadeOnHover?`, `inactiveOpacity?`, `inactiveBlur?`, `enterBlur?`, `showActiveHighlight?`, `shape?: SeriesMarkerShape`) plus `yAxisId?` · `yGradient?: boolean|{from,to}` · `dropLines?: "x"|"y"|"both"|false` · `labelExtremes?: {by:"y"|"x", count?, labelKey?, format?}` · `fadedOpacity?` · `jitter?: number` (seeded, needs `yType="category"`) · `yType?: "number"|"category"` · `highlightKey?: string|(d)=>boolean` (PeakRing).
- No bubble-size encoding prop (radius is per-series, not per-datum) _(inferred: no `sizeKey`)_.

### 1.5 PieChart (`charts/pie-chart.tsx`) — extends ChartSelectionProps

- data: `data: PieData[]` (`{label, value, color?, fill?}`)
- geometry: `size?: number` (px; else parent) · `innerRadius?` (0 → donut when >0) · `padAngle?` · `cornerRadius?` · `startAngle?` (-π/2) · `endAngle?` (3π/2) · `hoverOffset?` (10) · `seams?: number` · `radiusKey?: string` (second measure → outer radius, "Big Slice") · `referenceRings?: number[]`
- interaction: `hoveredIndex?` / `onHoverChange?` (controlled hover; wires to ChartLegend) · ChartInteractionProps · ChartSelectionProps
- motion: `enterTransition?` · `enterStaggerScale?` · `geometryScrubbing?`
- a11y: ChartA11yProps · `className` · `children` (PieSlice, PieCenter, PieCenterShell, patterns)
- **`PieSlice`**: `index` · `color?` · `fill?` · `animate?` · `showGlow?` · `hoverEffect?: "translate"|"grow"|"none"` · `hoverOffset?` · `className` · (injected) `outerRadiusOverride?`, `seams?`
- **`PieCenter`**: `defaultLabel?` · `formatOptions?: ChartStatFlowFormat` · `children?: render fn` (NumberFlow animated centre value)
- **No slice labels / percentage labels / outside leader labels** on the pie itself — labelling is via `ChartLegend` (value + percentage + progress) and `PieCenter`.

### 1.6 RingChart (`charts/ring-chart.tsx`) — concentric progress rings — extends ChartSelectionProps

- `data: RingData[]` (`{label, value, maxValue, color?}`) · `size?` · `strokeWidth?` (12) · `ringGap?` (6) · `baseInnerRadius?` (60) · `animationDuration?` · `startAngle?` · `endAngle?` · `hoveredIndex?`/`onHoverChange?` · `enterTransition?` · `enterStaggerScale?` · `geometryScrubbing?` · `labels?: "outside"` (dotted leader labels under high decoration) · ChartInteractionProps · ChartA11yProps · `children` (Ring, RingCenter).

### 1.7 RadarChart (`charts/radar-chart.tsx`)

- `data: RadarData[]` · `metrics: RadarMetric[]` (`{key,label}`) · `size?` · `levels?` (5) · `margin?: number` (60) · `animate?` · `enterDurationMs?` · `staggerScale?` · `enterTransition?` · `motionReplayKey?` · `hoveredIndex?`/`onHoverChange?` · `className` · `children` (RadarGrid, RadarAxis, RadarLabels, RadarArea) · ChartA11yProps. No drill-down, no selection.

### 1.8 FunnelChart (`charts/funnel-chart.tsx`)

- `data: FunnelStage[]` (`{label, value, displayValue?, color?, gradient?: FunnelGradientStop[]}`) · `orientation?: "horizontal"|"vertical"` · `color?` · `layers?` · `className` · `style` · `showPercentage?` · `showValues?` · `showLabels?` · `hoveredIndex?`/`onHoverChange?` · `formatPercentage?` · `formatValue?` · `staggerDelay?` · `enterTransition?` · `gap?` (4) · `renderPattern?: (id, color) => ReactNode` · `edges?: "curved"|"straight"` · `labelLayout?: "spread"|"grouped"` · `labelOrientation?` · `labelAlign?: "center"|"start"|"end"` · `showConversion?: "between"|"margin"|false` · `grid?: boolean|{bands?, bandColor?, lines?, lineColor?, lineOpacity?, lineWidth?}` · ChartInteractionProps · ChartA11yProps. Own ResizeObserver; no aspectRatio prop (CSS-sized via `style`).

### 1.9 CandlestickChart (`charts/candlestick-chart.tsx`)

- `data: OHLCDataPoint[]` · `xDataKey?` · `margin?` · `animationDuration?` (1500) · `enterTransition?` · `revealSignature?` · `aspectRatio?` · `className` · `style` · `candleGap?` (0.2) · `candleWidth?` · `xDomain?` · `xDomainSlotCount?` · `children` · ChartA11yProps. **`Candlestick`**: `animate?` · `positiveFill?` · `negativeFill?` · `bodyPatternPositive?` · `bodyPatternNegative?` · `insideStrokeWidth?` · `fadedOpacity?` · `showHoverFade?`. Data decimated by `decimateOhlcData` (bucketed OHLC merge).

### 1.10 HeatmapChart (`charts/heatmap/heatmap-chart.tsx`) — extends ChartSelectionProps, ChartInteractionProps

- data: `data` · `x: string` (column key; ISO date in calendar) · `y: string` · `valueKey: string` · `xOrder?: string[]` · `yOrder?: string[]`
- encoding: `mode?: "cell"|"dot"` · `variant?: "matrix"|"calendar"` · `palette?: "sequential"|"diverging"|"mono"` · `steps?: number` (0 = continuous opacity ramp) · `cellRadius?` (4) · `emptyValue?: "quiet"|"blank"` · `emptyMarkScale?`
- labels: `showValues?` (default true for diverging) · `showValueHalo?` · `highlight?: "max"|"none"|(d)=>boolean` (PeakRing) · `rowHighlight?: (rowLabel)=>boolean` · `valueFormat?: ChartValueFormat` · `xAxisLabel?: string` (**the one axis-title prop in the package**)
- legend: `showLegend?` (ramp key below plot)
- layout: `margin?` · `aspectRatio?` ("16 / 9"; "6 / 1" calendar) · `revealOn?` · `loading?` · `emptyTitle?`/`emptyMessage?`/`emptyAction?` · `className` · `style` · ChartA11yProps (auto summary "Heatmap, 7 rows × 24 columns, peak 42 at …").

### 1.11 WaterfallChart (`charts/waterfall-chart.tsx`) — extends ChartInteractionProps<WaterfallStep>

- `data: WaterfallDatum[]` (`{label, value, kind?: "step"|"total"}`) · `orientation?` · `showValues?` (true) · `connectors?` (true) · `grid?` · `positiveFill?` · `negativeFill?` · `totalFill?` · `unit?` (UnitStack rungs) · `valueFormat?` · `callouts?: WaterfallCallout[]` (named annotations) · `height?` · `margin?` · `aspectRatio` (2/1 via height omission) · `className` · ChartA11yProps.

### 1.12 DumbbellChart (`charts/dumbbell-chart.tsx`) — extends ChartSelectionProps, ChartInteractionProps

- `data` · `category` · `startKey` · `endKey` · `orientation?` · `variant?: "dumbbell"|"slope"` · `beads?: DumbbellBeadsConfig` · `markers?: {start, end}` (hollow/filled) · `extraKeys?: string[]` · `showDelta?` · `deltaLabelFormat?` · `bothEndsLabeled?` (slope) · `valueLabelFormat?` · `referenceLine?: {value, label}` · `showValueAxis?` · `sortBy?: DumbbellSortBy` (e.g. "delta" = |delta| desc) · `palette?` · `rowColor?: (row, i) => token|undefined` · `valueFormat?` · `margin?` · `aspectRatio?` · `className` · ChartA11yProps.

### 1.13 UnitChart (`charts/unit-chart.tsx`) — waffle / field / rows — extends ChartSelectionProps, ChartInteractionProps, div attrs

- `data: UnitChartDatum[]` · `layout: "waffle"|"field"|"rows"` · `total?` (100) · `unit?` (1) · `unitLabel?` · `columns?` (10) · `mark?: UnitChartMark` ("dot") · `palette?` · `showArithmetic?` (footer "41 + 35 + … = 100") · `sort?: "desc"|"none"` · ChartA11yProps. Own ResizeObserver.

### 1.14 TreemapChart (`charts/treemap/treemap-chart.tsx`) — extends ChartSelectionProps, ChartInteractionProps

- `data: TreemapNode` (hierarchy) · `depth?: 1|2` · `palette?: "mono"|"sequential"|"categorical"` · `gap?` (2) · `labelMinArea?` · `labelOverflow?: "ellipsis"|"hide"` · `hideLeafLabel?: (leaf)=>boolean` · `monoLeafColor?` · `monoBandColor?` · `otherThreshold?` (merge into "Other"; hard cap 30 leaves) · `drilldown?` (click group band to zoom, Back control) · `showValues?` · `valueFormat?` · `className` · `style` · `aspectRatio?` ("16 / 9") · ChartA11yProps. Own ResizeObserver.

### 1.15 DistributionChart (`charts/distribution/distribution-chart.tsx`) — extends ChartInteractionProps, ChartA11yProps

- `data: DistributionRow[]` (record-level) · `valueKey` · `groupKey?` · `kind: "histogram"|"box"|"violin"|"strip"` · `orientation?` · `bins?: number|number[]` · `bandwidth?` · `showMedian?` · `showOutliers?` · `unit?` + `unitLabel?` · `palette?` · `valueFormat?` · `currency?` · `referenceLines?: DistributionReferenceLine[]` · `className` · `style`. Pure stats helpers exported (`fiveNumberSummary`, `kde`, `binValues`, …).

### 1.16 BumpChart (`charts/bump-chart.tsx`) — extends ChartInteractionProps

- `data` (long format) · `period` · `entity` · `valueKey?` · `rankKey?` · `variant?: "lines"|"strip"` · `highlightKey?` (hero entity) · `showDelta?` · `maxEntities?` (10) · `maxPeriods?` · `palette?` · `valueFormat?` · `margin?` · `aspectRatio?` · `className` · ChartA11yProps. End-of-line entity labels are built in (`END_LABEL_MIN_GAP`).

### 1.17 ComposedChart (`charts/composed-chart.tsx`) — extends ChartSelectionProps, ChartHoverLinkProps

- `data` · `xDataKey?` · `xScale?` · `margin?` · motion bundle · `aspectRatio?` · `className` · loading bundle · `children` (Line/Area/SeriesBar on a shared time scale) · `barSize?` · `maxBarSize?` · `barGap?` · `stacked?` (SeriesBar only) · `stackGap?` · `onPhaseChange?` · ChartInteractionProps · ChartA11yProps. **`SeriesBar`** = time-based columns.

### 1.18 LiveLineChart (`charts/live-line-chart.tsx`)

- `data: LiveLinePoint[]` (`{time: unixSeconds, value}`) · `value: number` · `dataKey?` · `window?` (30 s) · `numXTicks?` (5) · `nowOffsetUnits?` · `exaggerate?` (tight y) · `lerpSpeed?` (0.08) · `margin?` · `paused?` · `children` (LiveLine, Grid, LiveXAxis, LiveYAxis, ChartTooltip) · `className` · `style` · ChartA11yProps. Pauses while off-screen (4.2.0).

### 1.19 ChoroplethChart (`charts/choropleth/choropleth-chart.tsx`)

- `data: FeatureCollection` (GeoJSON; feature `properties: {name?, id?, value?, …}`) · `margin?` · `animationDuration?` (800) · `enterTransition?` · `revealSignature?` · `aspectRatio?` ("16 / 9") · `scale?` · `center?: [lon, lat]` · `translate?` · `zoomEnabled?` · `zoomMin?` · `zoomMax?` · `initialZoom?: TransformMatrix` · `className` · `children` · ChartA11yProps · `keyboardNav?: ChoroplethKeyboardNavProps`.
- **`ChoroplethFeatureComponent`**: `fill?` · `stroke?` · `strokeWidth?` · `fadedOpacity?` · `getFeatureColor?: (feature, i) => string` (caller supplies the value→colour scale) · `patterns?` · `getFeaturePattern?` · `noDataFill?: "hatch"|"muted"` · `labelTop?: number` (top-N regions labelled at centroid). `ChoroplethGraticule`, `ChoroplethTooltip`. No built-in colour legend, no built-in projection choice beyond `@visx/geo` default _(inferred)_; ships a US-states fixture only.

### 1.20 NetworkChart (`charts/network/network-chart.tsx`) — extends ChartInteractionProps

- `nodes: NetworkNodeDatum[]` · `links: NetworkLinkDatum[]` · `layout: "force"|"circular"|"arc"` · `nodeSize?: "value"|number` · `labelThreshold?` · `emphasis?: "adjacency"|"none"` · `draggable?` (force) · `palette?` · `maxNodes?` (200, warn) · `seed?` · `valueFormat?` · `className` · `style` · `aspectRatio?` · ChartA11yProps.

### 1.21 ParallelCoordinatesChart — extends ChartInteractionProps

- `data` · `entity` · `dimensions: ParallelCoordinatesDimension[]` (3–6) · `highlightKey?: string|(d)=>boolean` · `curve?: "linear"|"monotone"` · `showExtremes?` · `palette?` · `margin?` · `aspectRatio?` · `className` · ChartA11yProps.

### 1.22 TreeChart (`charts/tree-chart.tsx`) — extends ChartInteractionProps

- `data: TreeNode` · `orientation?: "lr"|"tb"` · `nodeSize?` (7) · `collapseDepth?` ("+k" pill) · `palette?: TreePalette` · `className` · ChartA11yProps. Fixed-size layout, scrolls; no ResizeObserver for layout (only scroll affordance).

### 1.23 SankeyChart (`charts/sankey/sankey-chart.tsx`)

- `data: {nodes, links}` · `margin?` · `animationDuration?` · `enterTransition?` · `revealSignature?` · `aspectRatio?` ("2 / 1") · `nodeWidth?` (16) · `nodePadding?` (24) · `className` · `children` (SankeyNode, SankeyLink, SankeyTooltip, SankeyThreadLinks) · `hoveredNodeIndex?`/`onNodeHoverChange?` · `mode?: "aggregate"|"threads"`.
- `SankeyNode`: `fill?` · `lineCap?` · `fadedOpacity?` · `showLabels?` · `getNodeColor?`. `SankeyLink`: `stroke?` · `strokeOpacity?` · `fadedOpacity?` · `useGradient?` · `getNodeColor?` · `getLinkColor?` · `patterns?` · `getLinkPattern?`. No drill-down contract on Sankey.

### 1.24 Gauge (`charts/gauge.tsx`) — extends ChartA11yProps

- `value` (0–100) · `totalNotches?` · `spacing?` · `notchCornerRadius?` · `uniformWidth?` · `startAngle?` · `endAngle?` · `useGradient?` · `activeGradient?: [hex, hex]` · `inactiveGradient?` · `centerValue` · `defaultLabel?` · `prefix?` · `suffix?` · `formatOptions?` · `inactiveFill?` · `activeFill?` · `inactiveFillOpacity?` · `activeFillOpacity?` · `children` (defs) · `className` · `width?` · `height?` · `minWidth?` (300) · `notchLengthPercent?` · `enterTransition?` · `enterStaggerScale?` · `milestones?: number[]` · `remainingLabel?` · `target?` · `thresholds?: GaugeThreshold[]` (`{value,label}` rim ticks, no colour zones) · `labels?`.

### 1.25 BulletChart (`charts/bullet-chart.tsx`) — div attrs + ChartA11yProps

- `value` · `target?` · `comparative?` · `bands?: BulletBand[]` · `min?` (0) · `max?` · `orientation?` · `size?: "sm"|"md"` · `showAxis?` · `valueFormat?` · `labels?` · `higherIsBetter?`.

### 1.26 Sparkline (`sparkline/sparkline.tsx`) — SVG attrs

- `values: number[]` · `variant?: "bar"|"line"` · `emphasizeLast?` · `label?` · `width?`/`height?` · `fit?: "fixed"|"fill"` (fill = own ResizeObserver) · `target?` · `baseline?: number[]` · `band?: [lo, hi]` · `fitDomain?` · `showLastValue?` · `formatValue?` · `lastValueSuffix?` · `labels?`.

### 1.27 Gantt (`gantt/gantt.tsx`) — div attrs + CVA variants

- `tasks: GanttTask[]` · `rowHeight?` · `viewMode?`/`defaultViewMode?` (`GanttTimeUnit` | "auto") · `onViewModeChange?` · `viewModes?` · `selectedId?`/`defaultSelectedId?`/`onSelect?` · `expandedIds?`/`defaultExpandedIds?`/`onExpandedChange?` · `onTaskMove?` · `onTaskResize?` · `onDependencyCreate?` · `pointerDrag?` · `columns?: GanttColumn[]` · `scales?: GanttScale[]` · `labelPosition?` · `highlightTime?` · `markers?: GanttMarker[]` · `renderBar?` · `taskTypes?` · `locale?` · `formatDate?` · `pixelsPerDay?`/`defaultPixelsPerDay?`/`onPixelsPerDayChange?` · `zoomBounds?` · `sort?`/`onSortChange?` · `onColumnResize?` · `labelColumnWidth?` (240) · `loading?` · `children`.

### 1.28 MetricCard (re-exported from `@elabs-ai/components-ui`)

- `label` · `value: ReactNode` · `valueFormat?: MetricCardValueFormat` ("compact") · `currency?` · `copyExactValue?` (true) · `description?` · `delta?: string` · `deltaDirection?: "up"|"down"|"neutral"` · `positiveIsGood?` · `icon?` · `visual?` · `sparkline?: ReactNode` · `evidence?` · `loading?` · `announceLoading?` · CVA `emphasis` ("default"|"headline"…) and `size` ("sm"|"md").

### 1.29 MetricGrid (`metric-grid/metric-grid.tsx`)

- `children?` · `columns?: 2|3|4` · `reveal?` · `featured?: number` · `featuredSpan?: 2|3` · `className` · `loading?`. Responsive via Tailwind **viewport** classes: `sm:grid-cols-2`, `lg:grid-cols-3|4`.

### 1.30 ChartCard (legacy) — `title` (required) · `titleAs?` · `description?` · `actions?` · `children` · `height?` (260) · `loading?` · `source?`. Has ResizeObserver only for its skeleton.

### 1.31 ChartFrame (`chart-frame/chart-frame.tsx`) — div attrs

- chrome: `title?: ReactNode` · `description?: ReactNode` · `source?: ReactNode` (all-caps attribution row; also baked into SVG/PNG export) · `chrome?: "card"|"tile"|"bare"` · `headerSlot?` · `menuSlot?: ReactNode | (api: ChartFrameMenuApi) => ReactNode` (tile only) · `density?: "xs"|"sm"|"md"|"lg"` · `interactions?: {passive?, active?, select?, edit?}`
- data: `data?: Record<string,unknown>[]` · `columns?: {key, header?}[]` · `detail?: ReactNode` (expand-modal right pane; default per-column min/max/avg summary)
- features: `features?: ("expand"|"table"|"download"|"export-svg"|"export-png")[]` (default all; table/download auto-hidden without data; export-\* hidden when body has no `<svg>`) · `renderTable?` · `onDownload?` (CSV; default RFC-4180 local serializer, injection-guarded) · `onExport?: (kind: "svg"|"png", blob, filename) => void` · `onExpandChange?`
- layout: `height?: number` (260 default; `chrome="tile"` without height fills host `h-full`) · `loading?` · `children`.
- **No** byline/author, notes, alt-text, or footer-link props beyond `source`.

### 1.32 AutoChart + ChartSpec (`auto-chart/`)

- **`AutoChartProps`**: `spec: ChartSpec` · `height?` (280) · `loading?` · `copyValueOnActivate?` (true) · `selectionStates?` · `dimExcluded?` · `hoverCategory?` · `onHoverCategory?` · `onDatapointClick?` · div attrs.
- **`ChartSpec`**: `type?: ChartType` (`line|area|bar|pie|scatter|radar|funnel|candlestick|heatmap|calendar|waterfall|dumbbell|unit|treemap|histogram|box|strip|bump|stream|diverging-bar`; inferred when omitted) · `data` · `x` · `xType?: "time"|"category"|"number"` · `series: (string | {key, label?, color?})[]` (color honoured only as `var(--chart-N)`) · `y2?` · `group?` · `hierarchy?: TreemapNode` · `palette?: "mono"|"sequential"|"categorical"` (treemap only) · `kind?: "steps"|"records"|"ranking"` · `emphasis?: "analytical"|"editorial"` · `title?` · `description?` · `stacked?` · `orientation?` · `donut?` · `legend?` (default `series.length > 1`) · `valueFormat?` · `currency?` · `fields?: {category?, series?}`.
- AutoChart never throws: bad data / unknown type → `ChartFallback kind="empty"|"unsupported"`. Renders its own simple `AutoLegend` (`<ul>` of swatches, non-interactive). Height is fixed-px (aspectRatio suppressed).

---

## 2. Cross-cutting capabilities

### Axes

- **Time/linear/band x-axis (`XAxis`)**: `numTicks?` (5; **fixed count, not width-derived**) · `tickerHalfWidth?` (50) · `tickMode?: "domain"|"data"` · `tickFormat?: (Date) => string` (time scale only) · `tickValues?: Date[]` · `periodTicks?` (HairlineFloor). Tick placement: `selectEvenlySpacedIndices` searches `targetCount ± 1` layouts scored for even on-screen spacing; **duplicate labels de-duped** (`dedupeIndicesByLabel`); default label = `Intl.DateTimeFormat(locale, {month:"short", day:"numeric"})` — no automatic multi-scale (year/month/hour) format switching _(inferred: only shortDate/weekday/hms formatters exist)_. Labels are HTML `<div>` portals in the margin.
- **Value axis (`YAxis`)**: `yAxisId?` · `orientation?: "left"|"right"` (→ **dual y-axis supported**: each `Line/Area/Bar yAxisId` groups into its own linear scale; `buildYScalesFromDomains`) · `numTicks?` (clamped 1–10, default 5; d3 `scale.ticks`) · `valueFormat?` · `currency?` · `formatValue?` · deprecated `formatLargeNumbers`. Scales are `scaleLinear` with `nice: true`. **No log/sqrt scale option; no explicit `domain`/min/max prop; no axis title prop** (only `HeatmapChart.xAxisLabel`). `includeZero` exists only as an internal option (`resolveYDomain({includeZero})`); line/area domains are auto: `[0, max*1.1]` for non-negative data, else padded extent. Bars/lengths always zero-based (honesty gate `charts-honesty`).
- **Category axes for bars (`BarXAxis`/`BarYAxis`)**: `showAllLabels?` · `maxLabels?` (12 / 20) · `fit?: "auto"|"off"` · `tickerHalfWidth?`. Driven by `planCategoryAxis` (see §3).
- **Gridlines (`Grid`)**: `horizontal?` (true) · `vertical?` (false) · `numTicksRows?` (5) · `numTicksColumns?` (10) · `rowTickValues?` · `stroke?` · `strokeOpacity?` · `strokeWidth?` (`CHART_HAIRLINE_WIDTH`) · `strokeDasharray?` ("4,4") · `fadeHorizontal?`/`fadeVertical?` · `yAxisId?` · `shimmer*` (loading) · **reference lines**: `highlightRowValues?: number[]` + `highlightRowLabel?: (v)=>string` + stroke props; `highlightColumnValues?: (number|Date)[]` + `highlightColumnLabel?` + stroke props.
- Rule: furniture paints one ink (`--chart-grid`) at full opacity, one weight (`pnpm check --rule chart-hairline`).

### Value formatting (`charts/value-format.ts`, `chart-formatters.ts`)

- `ChartValueFormat = "number" | "compact" | "currency" | "percent"`; default `"compact"`. `COMPACT_THRESHOLD = 1000` (`|v| ≥ 1000` → `Intl notation:"compact", compactDisplay:"short"`, `maximumFractionDigits: 1`). `"number"` = exact, never compacted. `"currency"` uses `Intl style:"currency"` with `currency` from prop → `ChartConfigProvider.currency` → `"USD"` (never inferred from locale). `"percent"` = `Intl style:"percent"` (expects fractions).
- Locale: `useLocale()` from `@elabs-ai/components-ui` LocaleProvider drives all `Intl` formatters (cached per locale+options).
- **Set-consistent notation** (#250): `valueFormatOptionsForSet` / `useChartValueSetFormatter` compact a whole tick/label set only if every finite non-zero member would compact alone — never "1K" beside "400".
- **No custom pattern/template strings** (no `"0.0a"`, no prefix/suffix props on axes); escape hatch is a `formatValue`/`formatDate` function prop where offered (YAxis, XAxis `tickFormat`, ChartLegend, Funnel, Sparkline, Dumbbell, Gantt). Exact value recoverable via `copyValueOnActivate` / MetricCard `copyExactValue`.
- Date formats: `shortDateFmt` (Mon d), `weekdayDateFmt`, `hmsTimeFmt`, `intFmt`. Gantt has `locale` + `formatDate`.

### Legend

- **`ChartLegend`** (list legend, composed by caller beside the chart): `items: {label, value, maxValue?, color, seriesIndex?}[]` · `hoveredIndex?`/`onHover?` (**interactive hover-link** to Pie/Ring/Sankey/Radar via `hoveredIndex`; `ChartLegendHoverProvider` for Line/Bar series dim) · `onItemClick?` (renders real `<button>`s) · `showProgress?` · `showMarker?` · `showValue?` · `showPercentage?` · `formatValue?` · `title?` · class-name hooks · `renderItem?`. Swatch renders the decoration pattern under high decoration.
- **Composable `Legend` + `LegendItemComponent`/`LegendMarker`/`LegendLabel`/`LegendValue`/`LegendProgress`** for custom layouts.
- **Position**: no `position` prop — placement is wherever the caller renders it (flex/grid). `AutoChart` renders a flat `<ul>` below the chart.
- **No toggle-to-hide series**, no click-to-isolate built in (only hover-dim and `onItemClick` callback).
- Density: `xs`/`sm` → legends render `null`.

### Tooltip

- **`ChartTooltip`** (cartesian): `showDatePill?` · `showCrosshair?` · `showDots?` · `indicatorColor?: string | (point)=>string` · `content?: ({point, index}) => ReactNode` (full custom) · `rows?: (point) => TooltipRow[]` (`{color,label,value}`) · `dotColor?` · `children` · `className` · `springConfig?` · `boxSpringConfig?` · `panelStyle?`. Shared/crosshair: it is by design a **shared-x tooltip** (bisector on x, all series rows) with a vertical crosshair indicator and a `DateTicker` pill along the axis; flip/clamp inside container. Cross-chart sync via `hoverCategory`/`onHoverCategory` (`ChartHoverLinkIndicator`).
- Family-specific tooltips: `HeatmapTooltip`, `SankeyTooltip`, `ChoroplethTooltip`, `MarkerTooltipContent`; `ChartTooltipBox`/`ChartTooltipContent`/`ChartTooltipIndicator`/`ChartTooltipDot` as primitives.
- No string templating language (`{{value}}`); customization is React render props.
- Mobile: containers set `touchAction: "none"`; hover via pointer events (visx `localPoint`) _(inferred)_.

### Annotations

- `charts/markers/`: **`ChartMarkers`** (`items: ChartMarker[]` = `{date, icon, title, description?, content?, color?, onClick?, href?, target?}`, `size?`, `showLines?`, `animate?`) — event markers at dates with vertical guide lines, fan-out clustering (`MarkerGroup`: `maxFanned`, `forceOpen`, `isMuted`, `iconFill`, `borderColor`…), tooltip on hover.
- `marks/` (RM-017, all `aria-hidden`, token-only ink): `HaloText` (`halo?`, `haloWidth?`), `Leader` (`from`, `to`, `kind?: LeaderKind` (elbow/curve/…), `dash?`), `Marginalia` (`anchor`, `x`, `y`, `children`, `maxWidth?` wrapping, `halo?`, `leaderKind?`, `dash?`, `fontSize?`, `textAnchor?`), `PeakRing` (`cx, cy, r, shape?: circle|square`), `HairlineFloor` (period ticks), `QuietDot`, `UnitStack`, `DrawPath` (self-drawing path), `seededRnd`, `stagger`.
- Reference lines/bands: `Grid.highlightRowValues/highlightColumnValues` (+labels), `AreaBand` (range band), `Sparkline.target/band/baseline`, `DumbbellChart.referenceLine`, `DistributionChart.referenceLines`, `Gauge.target/thresholds/milestones`, `WaterfallChart.callouts`, `Gantt.markers/highlightTime`, `Bar.zeroLine`, `PieChart.referenceRings`.
- Highlight segments: `SegmentBackground`, `SegmentLineFrom/To`, `useHighlightSegment`, `ChartBrushSelectionOverlay`.
- Direct labels: `Bar.showValues`, `Line.labelPeaks`, `Area.labelPeaks`, `AreaChart.labelBands`, `Scatter.labelExtremes`, `Heatmap.showValues`, `Treemap.showValues`, Bump end labels, `ChoroplethFeature.labelTop`, `Dumbbell.showDelta`, Waterfall `showValues`. **No generic end-of-line series label option on `Line`** (only peak labels; series naming is via legend/description).
- All annotation coordinates are in data/pixel space via components — **no declarative text-annotation prop** on the containers (no `annotations: [{x, y, text}]`).

### Colours

- Tokens (`packages/tokens/src/themes.css`): `--chart-1..12` categorical ramp, `--chart-seq-1..7` (single hue), `--chart-mono-1..7` (neutral), `--chart-div-neg-2..pos-2` (5-step diverging), `--chart-accent`, furniture `--chart-grid`, `--chart-foreground(-muted)`, `--chart-background`, `--chart-line-primary`, etc. No raw hex in components (gate). Dark mode = theme tokens (`data-theme`), automatic; `HaloText` halo follows `--chart-background`.
- `ChartPalette = "categorical"|"sequential"|"diverging"|"mono"|"accent"`; `resolvePalette(palette, n, {explicit})`: categorical soft cap **6** (beyond → mono + warn unless explicit); `accent` = one hero `--chart-accent` + mono rest. Per-series override via `stroke`/`fill`/`color`; per-datum override via `PieData.color`, `rowColor` (dumbbell), `getFeatureColor` (choropleth), `getNodeColor` (sankey), `highlightKey` (bar/scatter/bump/parallel: one hero in `--chart-foreground`, rest de-emphasised).
- Fills: visx gradients re-exported; `PatternLines/Circles/Hexagons/Waves`; **high-decoration mode** (`useHighDecoration`, `data-decoration ≥ 8`) auto-switches series to hatch patterns + dash arrays + marker shapes (`seriesPattern`, `seriesDashArray`, `seriesMarkerShape`) for colour-blind-safe differentiation.
- Selection encoding: `data-selection="selected|associated|excluded"`, `SELECTION_EXCLUDED_OPACITY`, dashed frame for excluded.

### Sorting / stacking / nulls / curves

- Sorting: only `UnitChart.sort`, `DumbbellChart.sortBy`, `FilterTile.sort`, Gantt column sort. Bars/pies render in data order.
- Stacking: `BarChart.stacked` (grouped default; diverging stacks OK; **no 100% mode**); `AreaChart.offset` (none/silhouette/wiggle/expand — expand = 100%); `ComposedChart.stacked` (SeriesBar).
- Null/gap handling: **line/area treat a non-numeric value as 0** (`getY` returns 0; `LinePath` `defined` default `() => true`) — **no gap rendering, no interpolation option**; peaks ignore NaN; heatmap distinguishes `null` (missing, hatched/blank) from `0` (QuietDot); distribution drops non-finite and counts them; time-series x invalid dates warn and render text fallback.
- Curves: any `@visx/curve` factory via `curve` prop (Line default `curveNatural`, Area `curveMonotoneX`, ParallelCoordinates linear|monotone); dashed tails via `dashFromIndex`; markers via `showMarkers`/`SeriesMarkers`.
- Decimation: `decimateTimeSeries` (LTTB) to `max(64, ceil(innerWidth*1.5))` points; OHLC bucket merge; `CanvasLayer` for >~20k points with spatial-grid hit test.

### a11y

- Container `role="figure"` + `aria-label` (+ `aria-describedby` sr-only), SVG `aria-hidden`. Keyboard: `ChartDatapointLayer` (real `<button>` targets outside the SVG, auto-named "series/category/value", 500-target warn); `ChartLegend onItemClick` buttons; Choropleth `keyboardNav`; Gantt full keyboard editing; treemap drilldown Back; `ChartFrame` table flip (ui `Table`) as the data alternative + scroll-region focus when overflowing. Category labels the axis cannot paint are re-stated `sr-only`. Auto summaries for heatmap/network/distribution/unit (English-only for distribution). Motion respects `motion-reduce` via token gates.

### Export / chrome (`ChartFrame`)

- Expand modal (with `detail` pane), table flip, CSV download, **SVG export** (inlines computed styles, bakes background rect + `source` row, fixed font stack), **PNG export** (offscreen canvas at fixed 2×), `onExport` routing. **Export clones only the `<svg>`** — HTML-portaled axis tick labels, legends, title/description are **not** in the exported picture (only `source` row is appended) _(inferred from `buildExportSvg`)_. No PDF, no embed code, no iframe/oEmbed, no server-side render.

---

## 3. RESPONSIVE behaviour (precise)

### How width/height is obtained

- **Cartesian & most families** wrap the plot in visx **`<ParentSize debounceTime={N}>`** (ResizeObserver under the hood) inside a container `div` styled `style={{ aspectRatio }}` (default `"2 / 1"`; heatmap/treemap/network/choropleth `"16 / 9"`). The chart fills the parent's width; height = width / ratio unless the caller passes `style={{height}}` or omits `aspectRatio` to fill a sized parent.
  - `line-chart.tsx:411` `<ParentSize debounceTime={10}>`; `composed-chart.tsx:471`, `candlestick-chart.tsx:372`, `gauge.tsx:859`, `pie-chart.tsx:864`, `ring-chart.tsx:600`, `live-line-chart.tsx:673`, `choropleth-chart.tsx:560`, `heatmap-chart.tsx:1147`, `distribution-chart.tsx:335` — all **10 ms** debounce.
  - `bar-chart.tsx:1177`, `area-chart.tsx:425`, `radar-chart.tsx:293` — **100 ms** debounce (locked by `parent-size-debounce.test.tsx`: "a 10ms debounce fires a full recompute on nearly every resize-observer tick during a drag-resize … Raised to 100ms").
  - `sankey-chart.tsx:511` `<ParentSize>` with no debounce.
- **`react-use-measure` `useMeasure({ debounce: 10 })`**: scatter-chart (169), dumbbell (1288), bullet (541), parallel-coordinates (817), bump (1028); `canvas-layer` no debounce.
- **Own `ResizeObserver`**: funnel (890), unit-chart (277), treemap (239), network (260), sparkline `fit="fill"` (199), chart-card (skeleton), chart-frame (overflow detection only), dashboard `useBreakpoint`, tree-chart (scroll affordance only).
- Guard: `TimeSeriesChartInner` returns `null` when `width < 10 || height < 10` (`time-series-chart-shell.tsx:213`). Gauge `minWidth` default 300. `CATEGORY_AXIS_MIN_CONTAINER_WIDTH = 160` (below: category labels hidden).
- SSR: ParentSize renders 0×0 → chart body renders nothing until measured; `Sparkline` falls back to `width`/`height` props.

### Width-based layout adaptations that DO exist

1. **Category axis fit cascade** (`category-axis-plan.ts`, used by `BarXAxis`/`BarYAxis` via `BarChart`): pure planner with injected canvas text measurement (`use-text-measurer.ts`). Order: `container floor (<160px → hidden)` → `horizontal` (every label fits its band step) → `tilted 45°` (bottom axis only; viable when `slotSize >= lineHeightPx * √2`) → `trim` (binary-searched ellipsis "…", min 24 px text) → `drop` (stride, re-enter once) → `hidden`. `BarChart` **reserves margin** from `requiredExtentPx` (cap `MAX_CATEGORY_AXIS_EXTENT_BOTTOM = 72`, `_LEFT = 112`, `MIN_PLOT_EXTENT = 48`) in ONE pass (explicit "no ResizeObserver on the label band — would oscillate"). Unpainted labels go `sr-only`. Escape hatch `fit="off"`.
2. **Time-series point decimation**: `renderData = decimateTimeSeries(data, maxRenderPointsForWidth(innerWidth))` with `maxRenderPointsForWidth = max(64, ceil(innerWidth * 1.5))` (`time-series-chart-shell.tsx:375`, `decimate-time-series.ts:99`). Purely a render-performance cap, not a visual simplification.
3. **X-axis tick de-dupe**: duplicate formatted labels are removed and layouts `numTicks ± 1` are scored for even pixel spacing — but the target count is a fixed prop (5), **not derived from width**.
4. **Tooltip box** flips/clamps inside the container (`ChartTooltipBox` `containerWidth/Height`); `DateTicker` fades near edges (`tickerHalfWidth`).
5. **Pie `radiusKey` reference-ring labels** use a fixed-spacing leader column; treemap `labelMinArea` hides labels by tile area (px²) — "never shrinks type".
6. **Network** clamps node radius (`NETWORK_MIN/MAX_NODE_RADIUS`) and label gutter fraction to the box.
7. **MetricGrid** uses Tailwind **viewport** breakpoints (`sm:grid-cols-2`, `lg:grid-cols-N`) — the only media-query-driven responsiveness in the package. `chartCenterContainerClassName = "@container/chart-center …"` is the only `@container` usage (pie/ring centre typography scales with `cqw` _(inferred)_).

### What does NOT adapt to width (explicitly)

- **No breakpoint/mobile mode inside any chart.** The only tiering is **`density: "xs"|"sm"|"md"|"lg"`** from `ChartConfigProvider`/`ChartFrame density`, and it is _host-picked_ ("Families never measure text for this — the host (a sheet tile) picks the tier from the cell size"; `chart-config-context.tsx`). Effects: `xs` → `XAxis`, `YAxis`, `BarXAxis`, `BarYAxis`, legends return `null`; frame drops description/source; `sm` → `YAxis` and legends `null`, category axis thinned to ≤ 4 ticks (`thinToDensity`, `CHART_DENSITY_SM_MAX_TICKS = 4`); `lg` → value labels where a family draws them. A standalone `<LineChart>` on a phone renders at `md` with 5 x ticks regardless of width.
- Margins are static props (`margin`) except the bar category-axis reserve; **font sizes never scale** with width (tokens `text-chart-label`, `text-meta`); legends never relocate; y tick count never changes with height; time-axis tick format never coarsens with width; pie/ring never switch to a legend-only mode; no label-collision avoidance for direct labels (`showValues`, `labelPeaks`) other than `minGap` by data index; no aspect-ratio change by breakpoint; no min-height safeguard beyond the 10 px guard.
- `ChartFrame` body has a fixed `height` (260 px) irrespective of width unless `chrome="tile"`.

### Dashboard-level responsiveness (`dashboard/dashboard-sheet/use-breakpoint.ts`, `dashboard-sheet.tsx`)

- `useBreakpoint(ref, {md: 1024, sm: 640})` — **container query via ResizeObserver on the sheet element** ("never window/matchMedia"); defaults `"lg"` before measurement or when width is 0. `resolveBreakpointLayout(spec, bp)`: `spec.layouts[bp]` if authored, else base for lg/md, else `stackForNarrow(base)` (one column, y-then-x order, heights preserved) for `sm`; edit mode force-dropped to view below `sm`. `data-breakpoint` attribute on the sheet. Tile density (`xs` <200×100, `sm` <400×200, `md` <800×400, else `lg`) is computed by `DashboardTile` from its rendered pixel box and forwarded through `ChartFrame density` — this is the mechanism by which charts _do_ simplify on small tiles.

---

## 4. Dashboard subpath (`@elabs-ai/components-charts/dashboard`, ADR 0037)

- **Spec-driven** (`DashboardSpec` v1, JSON schema published at `./dashboard/schema.json`): `grid` (`mode: "fit"|"flow"`, 24 columns, 12 rows fit, 30 px rowHeight flow), tiles with `layout` cells, optional per-breakpoint `layouts.{sm,md,lg}`, `interactions[]`, `bookmarks`, `theme` override, `showCondition`.
- **10 built-in tile kinds**: `chart` (content = `ChartSpec` → `AutoChart` inside `ChartFrame chrome="tile"`), `metric`, `text`, `heading`, `divider`, `image`, `container` (`tabs`|`stack` of child tiles), `button`, `variable`, `filter` (`field`, `mode single|multi`, `search`, `showCounts`, `sort`, host-supplied `values`). `table`/`chat`/`process-map` are host-registered kinds (registry `DashboardTileKind` with `migrate`, `validateContent` (not yet called by the sheet), `capabilities.frame`).
- **Rendering**: `DashboardProvider` (one zustand store per sheet; `onChange(spec, {conflict, incoming, reason})`, `autosaveMs`, `onSelectionChange`, `initialState`, `driver`, `host`, `bookmarks.storage`) + `DashboardSheet` (absolute-positioned tiles, `fit` fills host height or falls back to square cells, lazy tile mounting in a viewport band, `renderAll`, roving tab stop) + `DashboardTile` (header/menu slots, density tier, `data-tile-kind`/`data-tile-id`).
- **Selection/interactions**: tri-state `selected|associated|excluded`; pluggable `SelectionDriver` (bundled local driver; async engine example for Qlik-shaped hosts); `resolveInteractions` emitter→consumer map with effects `filter|highlight|drill|none`, wildcards, per-tile `emits`/`consumes`; shared hover via `useHover`; `useVariable`; `visibleWhen`/`showCondition` expression grammar (`core/expression.ts`).
- **Chrome**: `DashboardToolbar`, `DashboardSelectionBar` (chips, back/forward, save bookmark), `DashboardAssetPanel`, `DashboardPropertiesPanel`, `DashboardGridSettings`, `DashboardInteractionsEditor`/Dialog, `DashboardPresentation` (kiosk, `cycleMs` auto-advance pausable, fullscreen on gesture), `DashboardThemeScope`, `DashboardWorkbook` + `WorkbookNav` (multi-sheet, hidden-but-mounted sheets), `useDashboardShortcuts`.
- **Edit layer** (`@dnd-kit/core`): drag/resize handles, marquee, align, clipboard, context menu, size badge, single polite live region, undo/redo `history`, auto-layout (`auto-layout.ts` with golden fixtures).
- **Persistence/URL**: host-owned; `encodeDashboardState`/`decodeDashboardState` (v1, ≤ 8 kB), `useDashboardUrlState`.
- **Export**: `exportSheet({format: "svg"|"png", width 1680, height 1120, scale 2})` composes each visible top-level tile's chart `<svg>`; containers omitted, non-chart tiles = placeholder rects; live selections/variables not reflected (documented KNOWN LIMITATION).

---

## 5. Known limitations (from comments, docs, and code reading)

Stated in source/docs:

1. `exportSheet`: off-screen render uses a fresh provider — live selection/variable overrides are not exported; container tiles omitted; non-chart tiles are placeholders (`export-sheet.ts` "KNOWN LIMITATION").
2. `ScatterChart`: categorical/ordinal x-scale "stays unsupported and keeps warning" (`scatter-chart-shell.tsx`).
3. Violin half-width is per-group (n not encoded by width) — stated limitation (`kinds/violin.tsx`).
4. `describeDistribution` auto text is English-only (`distribution-groups.ts`).
5. Gantt: no shared virtualizer across panes; >200 rows deferred perf TODO (`gantt.tsx`).
6. `DashboardTileKind.validateContent` is "Not yet called by the sheet or the validator" (`tile-registry.ts`).
7. AutoChart cannot express node/link, per-row dimension lists, hierarchy-as-tree, ring, gauge, sankey, network, parallel, tree, gantt, live, choropleth, composed (manual-select list in `chart-selection.md`).
8. `@visx` charts do not render under jsdom — test double required (README).
9. `categorical` palette hard-limited to 6 before falling back to mono (`CATEGORICAL_SOFT_CAP`); treemap ≤ 4 categorical groups, 30-leaf cap; bump ≤ 10 entities; parallel 3–6 dimensions; network 200-node warn.
10. Series `color` in `ChartSpec` honoured only as `var(--chart-N)` tokens; raw hex ignored (theme-safety rule).
11. `ChartDensity.edit` interaction flag "reserved — no chart reads it yet".
12. Tokens README: a consumer-authored dark theme is a "KNOWN LIMIT" for `dark:` utilities (ADR 0029).

Inferred from code (verify before citing as fact): 13. **Line/Area render `null`/missing values as 0** — no gap/break, no interpolation setting. 14. **No axis titles** (except heatmap `xAxisLabel`), **no log/sqrt scales**, **no manual y-domain/min/max** on containers, no axis line/tick-mark styling props, no second x-axis. 15. **X tick count is a fixed prop (5)**, not width-derived; time tick format does not coarsen/finer with zoom or width; no explicit "date granularity" prop (only `tickFormat`, `tickValues`, `periodTicks`). 16. **No automatic responsive layout inside a chart** (legend relocation, font scaling, mobile modes): all simplification requires the host to pass `density`. 17. **SVG/PNG export omits HTML-portaled axis labels, legends, title and description** (only the `<svg>` + `source` row) — verify visually. 18. Legend: no `position` prop, no click-to-toggle series visibility, not auto-rendered except in `AutoChart`. 19. Pie: no slice/percentage/outside labels; Sankey: no drill-down contract; Radar/Scatter/Candlestick/LiveLine: no `onDatapointClick`. 20. Bars: no 100%-stacked mode, no sort prop, no per-bar colour rule except `highlightKey`/`palette`/pattern; no error bars anywhere; no bubble (per-datum size) scatter; no small-multiples/facet container; no dual-axis for bars beyond `yAxisId` (works for vertical bars only per JSDoc). 21. No tooltip string templating; no declarative text annotation array; no PDF/embed/oEmbed/responsive-iframe output; no server-side or headless rendering path; no CSV/URL data import (data is always in-memory rows). 22. Choropleth ships no built-in colour scale/legend or basemaps (caller supplies `getFeatureColor`, GeoJSON); only a US-states fixture. 23. `MetricGrid` is the only component using viewport media breakpoints; everything else is container-measured or host-tiered.
