/**
 * @qlik-coe-emea/qlabs-components-charts — KPI tiles, a chart container, and 14 compositional charts.
 *
 * Token-driven: series use `--chart-1..5` tokens so visuals theme consistently.
 *
 * Chart containers (14):
 *   AreaChart, BarChart, LineChart, ScatterChart, PieChart, RingChart,
 *   FunnelChart, RadarChart, CandlestickChart, ComposedChart, LiveLineChart,
 *   ChoroplethChart, SankeyChart, Gantt
 *
 * Composition primitives (pass as children or configure via props):
 *   Area, Bar, Line, Scatter, Ring, PieSlice, Candlestick, RadarArea,
 *   LiveLine, SeriesBar, PatternArea, Gauge, Segment*,
 *   XAxis, YAxis, BarXAxis, BarYAxis, LiveXAxis, LiveYAxis, RadarAxis,
 *   RadarGrid, RadarLabels, Grid, ChartBrush, ChartBrushLayout,
 *   ChartTooltip, ChartTooltipBox, ChartTooltipContent, ChartTooltipDot, ChartTooltipIndicator,
 *   DateTicker, Legend, LegendItemComponent, LegendLabel, LegendMarker,
 *   LegendProgress, LegendValue, ChartLegend, ChartMarkers, MarkerGroup,
 *   PieCenter, PieCenterShell, RingCenter, ChartStatFlow,
 *   ProfitLossLine, ProfitLossLegend, ChartRevealClip, ChartLoadingLabel,
 *   SankeyNode, SankeyLink, SankeyTooltip,
 *   ChoroplethFeatureComponent, ChoroplethGraticule, ChoroplethTooltip,
 *   + provider/context/hook exports for each chart family.
 *
 * Legacy primitives (kept for backward compatibility):
 *   MetricCard, MetricGrid, ChartCard
 */

// ── ChartFrame ───────────────────────────────────────────────────────────────
export * from "./chart-frame";

// ── Legacy primitives (kept for backward compatibility) ──────────────────────
export * from "./metric-card";
export * from "./metric-grid";
export * from "./chart-card";

// ── Charts + composition primitives ─────────────────────────────────────────
// charts/index.ts uses explicit named re-exports and handles all aliasing
// (e.g. LegendItem → LegendItemComponent, Margin exported once from
// chart-context, ChoroplethFeature → ChoroplethFeatureComponent) so a single
// export * is safe — no name collisions with the legacy exports above.
export * from "./charts";

// ── AutoChart — smart data-driven chart renderer ─────────────────────────────
export * from "./auto-chart";

// ── Sparkline — word-sized micro-chart (#L17) ────────────────────────────────
export * from "./sparkline";

// ── Gantt — interactive, virtualized, accessible Gantt/timeline widget (#240) ─
export * from "./gantt";
