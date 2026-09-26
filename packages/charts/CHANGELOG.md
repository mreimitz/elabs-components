# @elabs-ai/components-charts

## 5.6.0

### Minor Changes

- 4ead512: `BarChart`'s `stackGap` now works. Before, setting it on the chart did nothing, and a `Bar`'s own `stackGap` pushed each segment further up the stack, so the top of a stack sat above its real total and the bottom lifted off the baseline.

  The gap is now cut only out of the boundaries between segments, half from each side. Every stack still starts on the baseline and ends exactly at its total, in plain, percent and diverging stacks alike, and positive and negative stacks never get a gap at zero. A `Bar`'s own `stackGap` overrides the chart's value for that series, `ComposedChart` stacks follow the same rule, and the tooltip dots sit on the ends the bars draw.

  The default stays 0, and at 0 every chart draws exactly as before.

- 6885bfe: Every chart now follows the `interactions` you set on `ChartConfigProvider` or `ChartFrame`. Before, only `ChartTooltip`, `ChartBrush` and the keyboard datapoint targets listened. The other charts kept their own tooltips, zoom and drag whatever the host said.
  - `passive: false` hides every hover tooltip. That now includes the heatmap, treemap, tree, network, sankey, choropleth, unit, bump, dumbbell, parallel-coordinates, distribution, density-scatter and Gantt tooltips, the canvas layer's hover, the `Sparkline` hover and keyboard readout (as if you had set `interactive={false}`), and any `ChartTooltipBox` you mount yourself.
  - `active: false` turns off direct manipulation. The navigator strip stays as a read-only overview with no handles, drag or wheel pan. Pinch, Ctrl/⌘-wheel and `+` / `−` / `0` zoom stop, and the zoom buttons are not shown. Pan and zoom stop on the density scatter, the choropleth and the tree (a zoomable tree also stops scrolling under the wheel, trackpad or touch), and so do the tree's minimap clicks, network node drag, Gantt bar drag, Gantt zoom, the Gantt keyboard moves, resizes and dependency links, Gantt column resizing, and the selection gestures (range, rectangle, lasso, radial).
  - `select: false` stops a click or Enter on the canvas layer from activating a point, stops the density scatter's zone tags from selecting, and stops the selection gestures from emitting.

  New: `useChartInteractionPolicy()` returns the resolved switches, `{ passive, active, select, edit }`, so your own chart parts can follow the same policy.

- 8cdcd91: Heatmaps, colour-scale legends and waterfalls now draw in the active theme's own chart colours.

  The sequential ramp (`--chart-seq-1` … `-7`) takes the hue of each theme's lead series colour (`--chart-1`), so a heatmap, calendar, treemap or choropleth reads in the same colour as that theme's bars and lines. In the default light and dark themes it moves from muted blue to the brand lime. The lightness steps are unchanged, so every contrast and spacing guarantee still holds. Downloadable theme families whose ramp did not match their lead colour were re-derived the same way.

  `WaterfallChart` now paints rises in `--chart-1` and falls in `--chart-2`, the same pair a two-series `BarChart` uses. Totals stay on `--chart-foreground`. Pass `positiveFill="var(--chart-seq-6)"` and `negativeFill="var(--chart-seq-3)"` to keep the previous look.

- 7e18ba1: The cartesian charts — `LineChart`, `AreaChart`, `ComposedChart`, `BarChart`, `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart` — now share one set of sizing, loading, legend, tooltip and value-format props, and take their defaults from one place. With no new props set, every chart except `LiveLineChart` inside a `ChartFrame` or host draws exactly as before (see below).
  - `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart` gain `status`. `status="loading"` shows a skeleton in the plot box the chart will fill, with one polite "Loading chart…" message, so nothing moves when the data arrives. The default is `"ready"`.
  - `LiveLineChart` gains `plotHeight`: pixels, `{ aspect }`, or a value per breakpoint, and a caller's `style.height` still wins. Standalone it stays 300 px. Inside a host or a `ChartFrame`, a live line chart now follows the frame's plot height, or fills a tile, like every other cartesian chart. A `ChartFrame` with no plot height of its own no longer holds its 260 px body around a live line chart: the frame is as tall as the chart's 300 px plot plus its title and footer.
  - `margin` on all eight charts also takes a single number for every side, beside the per-side object it took before.

- 0e6bc36: `TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart` and `ParallelCoordinatesChart` all gain `status="loading"` for the skeleton, the same as the rest of the package. `TreemapChart`, `SankeyChart`, `NetworkChart` and `ParallelCoordinatesChart` also gain `empty={{ title, message, action }}` for the nothing-to-plot state (`TreeChart` has no such state: its `data` is always one real root node, never an empty list). `TreeChart` also gains `plotHeight` (a fixed or responsive plot height, matching the other families) and its tooltip now keeps clear of the hovered node the same way every other chart's tooltip does.

  `SankeyChart` gains `accessibleLabel` and `accessibleDescription`: set a label with no description and the chart announces a generated summary ("Sankey diagram, 5 nodes, 8 links") through the same screen-reader seam `LineChart`, `AreaChart`, `BarChart`, `ScatterChart` and `PieChart` already use, so a Sankey diagram is no longer silent to assistive technology.

  No default values changed. Two behaviours did change, new props or not: an empty `Treemap`/`Sankey`/`Network`/`ParallelCoordinates` now shows a "No data" panel where it used to render blank (pass `empty` to override its title and message; `TreeChart` has no `empty` state — a tree's root is always one real node, never "nothing to plot"), and `TreeChart`'s tooltip now moves off the hovered node instead of covering it.

  A `TreemapChart` counts as empty only when its data has no positive value to draw, decided from the data rather than the drawn layout: a one-level hierarchy at the default `depth` of 2 still draws its top-level groups, as before, and a root with `children: []` shows the "No data" panel instead of throwing a development error. While `status="loading"`, a `TreeChart` with no `plotHeight` reserves the shared default plot box (2:1, 1.25:1 when narrow) for its skeleton instead of collapsing to no height. Inside a `ChartFrame` it reserves nothing of its own: the frame's usual bounded body holds the skeleton, so the frame keeps the same height when the data arrives.

- a3833db: `ChartBrush` now honours its `selection` prop. Pass a `{ start, end }` window (or `null`) and the brush draws exactly that window; hand back the value `onSelectionChange` reports and a drag keeps going, while any other value (a reset button, a linked chart) moves the window there. Before, `selection` was accepted but ignored.

  The package now exports the types its chart props already use: `WaterfallLabelsConfig`, `WaterfallDataFormat`, `WaterfallSort`, `WaterfallEndpointOptions`, `DumbbellDeltaConfig`, `DumbbellValueAxisConfig`, `GaugeThreshold` and `GaugeLabels`.

  `MetricGrid` forwards a `ref` to its grid element, the same element that receives `className`.

  Deprecated: `<Scatter trend>` is now marked `@deprecated` in its type docs, not only by its one-time runtime warning. Pass `analytics={[{ kind: "trend", of: dataKey, model }]}` on `ScatterChart` instead, which also adds the legend entry and the tooltip row. The `trend` prop keeps working until its removal in 6.0.0.

- 382acd3: Charts show a tooltip on hover by default. `LineChart`, `AreaChart`, `BarChart`, `ScatterChart`, `ComposedChart` and `CandlestickChart` used to show one only when you added a `<ChartTooltip />` child. Now a chart without one adds a default `<ChartTooltip />` itself. A `<ChartTooltip>` child you pass (for `variant`, `rows`, `content`, …) still replaces the default, and `tooltip={false}` turns it off. If your own component renders `<ChartTooltip>` inside it, pass `tooltip={false}` next to it, or you will see two tooltips. `ChartFrame`/`ChartConfigProvider` `interactions={{ passive: false }}` still silences all hover feedback.

  A `BarChart`'s default tooltip also lists its `overlays` and `comparison` column: a range reads as "lo–hi", a value marker as one figure, each with its legend colour. Before this, a chart drawn only in overlays (a range plot) hovered to an empty box.

  `Sparkline` now shows its values on hover and keyboard focus. A small box names the point and gives its value, plus the baseline, target and normal range when the sparkline draws them. With the sparkline focused, arrow keys step through the points, Home/End jump to the ends, and Escape closes the box. New props: `interactive` (default `true`; pass `false` for a sparkline inside a link or button, or one used as decoration) and `pointLabels` (index-aligned names such as `"Week 34"`). `labels.value` renames the value row.

- 71004b1: Internal only: eight charts now each have one written-down description: `LineChart`, `AreaChart`, `ComposedChart`, `BarChart`, `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart`. Their axis, grid, series and reference-line parts have one too. A description lists every prop the component takes, the values each accepts, a short explanation, and the defaults the component already uses. A test renders each chart and part with its defaults passed in and with none, and the two come out identical. Another test checks that each description agrees with the checks the package's test double already runs. No chart reads these descriptions yet, nothing new is exported from the package, and every chart renders and behaves exactly as before. They are groundwork for building charts from a spec, forms and agent catalogs from one source in a later release.
- a9f4532: An expanded chart now fills the expand dialog. `ChartFrame`'s expand view used to draw the chart at the size it was given inline — its own `plotHeight`, or 2 : 1 of the pane's width — leaving much of the pane empty. The chart now takes the pane's full height, over its own `plotHeight`.

  New host setting: `ChartConfigProvider value={{ plotHeight }}` forces the plot height of every chart inside it — a px number, `{ aspect }`, or `"fill"` (the full height of a parent whose height is definite; where the parent has no height of its own, the chart keeps its own size). It overrides each chart's own `plotHeight`/`aspectRatio`; a fixed `size` on a pie, ring or radar still wins. Nested providers inherit it unless they set their own. New type: `ChartHostPlotHeight`.

- 26cef85: Charts now print every number and date in the locale of the surrounding `LocaleProvider`, and the words they show or announce come from the same message catalogue as the rest of the app. Before, some labels, axis ticks and tooltips used the browser's own locale and fixed English text. Without a `LocaleProvider`, or under an English one, most charts print what they printed before; the last two items below list the outputs that change.
  - The ui message catalogue gains `charts.*` keys for chart words that used to be fixed English: empty-state text, tooltip row labels (Value, Share, Path, Members, IQR, Range, Records, Density, Period, Rank, Start, End, Before, After), the network and heatmap summaries, the heatmap colour key, the Sankey node value, the Bump chart's "rank" in datapoint names (`charts.bump.datapointRank`), the Gantt link announcements, and the chart frame's summary and footer words. `NetworkChart` and `ParallelCoordinatesChart` now read their empty-state text from the existing `charts.chart.emptyTitle` and `charts.chart.emptyMessage` keys. Pass German (or any) text for these keys to `LocaleProvider` `messages` to translate them.
  - `TreeChart`, `TreemapChart`, `NetworkChart`, `HeatmapChart`, `ChoroplethChart`, `SankeyChart`, `DistributionChart`, `BumpChart`, `WaterfallChart`, `DumbbellChart` and `Gantt` gain `messages`: replacement words for that one chart, keyed by the same `charts.*` keys. A word set here wins over the `LocaleProvider` for that chart only, including the shared parts it renders (datapoint-layer name, legend label, loading and fallback text, tree toggles, Gantt timeline and task list); a chart next to it is not affected. The loading text of `TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart`, `ParallelCoordinatesChart` and `HeatmapChart` reads `charts.chart.loading` ("Loading chart…"), so both a chart's `messages` and the `LocaleProvider` reach it; `HeatmapChart` announced a fixed "Loading" before. `ChartLoadingLabel` rendered on its own still defaults to "Loading".
  - `PieChart`, `FunnelChart`, `BulletChart` and `RadarChart` gain `locale`, which formats that chart's numbers in the given locale instead of the provider's. `RadarChart` also gains `maxFractionDigits`. On `PieChart` and `RadarChart`, both settings now also reach the legend's value column; `ChartLegend` gains `locale` and `maxFractionDigits` for the same purpose. `PieChart`'s `locale` also reaches its centre value, through a new `locale` prop on `ChartStatFlow`.
  - Some English outputs change on purpose, so that one chart never mixes "1K" with "800" or "1" with "0.20". Every number on one axis, key or tooltip now shares one style:
    - `WaterfallChart` bar labels, datapoint names and the tooltip's Value, Before and After rows print "1,000" beside smaller values instead of "1K".
    - The `DistributionChart` value axis prints "1,000" instead of "1K" beside smaller ticks.
    - The `DumbbellChart` value axis prints "500 1,000 …" instead of "500 1K …".
    - `DensityScatterChart` axis ticks print "0.00 0.20 … 1.00 1.20" instead of "0 0.20 … 1 1.2".
    - The `HeatmapChart` colour key in `legendLabels="ranges"` mode prints "900–1,200" instead of "900–1.2K", and its screen-reader sentence follows. The default `"endpoints"` key is unchanged.
    - The parallel-coordinates extremes follow the same rule.
  - A chart with no `LocaleProvider` above it, in a browser set to a language other than English, now prints English (US) dates and times where it used to print the browser's own: Date category names in datapoint names (for example "Mar 9"), the weekday date in a time-axis tooltip title, and `LiveXAxis` time labels. Wrap the app in a `LocaleProvider` with the user's locale to keep local formats.

- e0d9da9: `RingChart` now honours `animationDuration`. The prop was accepted but ignored; it now sets how long each ring takes to grow in and sweep its progress arc. Leaving it unset keeps the same 1100 ms enter as before, and an explicit `enterTransition` still wins over it. The gaps between rings stay under `enterStaggerScale`.

  Every chart that animates by duration now takes its default from one shared value, so nothing changes on screen: 1100 ms for line, area, composed, bar, scatter, candlestick, sankey, ring and radar charts, and 800 ms for the choropleth map.

  Several prop descriptions now match what the code already does; no behaviour changes. `CandlestickChart` `animationDuration` defaults to 1100 ms, not 1500. `WaterfallChart` `valueFormat` defaults to `"compact"`. `BumpChart` `palette` also colours the `"lines"` variant unless `highlightKey` is set. `pieLegendItems` sorts largest first by default, while `PieChart` keeps data order unless you pass `sort`. `Line` `loadingStroke` defaults to `var(--chart-foreground)`. `Sparkline` `formatValue` defaults to compact notation for the text it shows. The `aspectRatio` descriptions on `LineChart` and `ParallelCoordinatesChart` now say that narrow containers default to "1.25 / 1".

- ab266a2: Every chart family except `Gantt` now takes the same `palette` prop (`"categorical"`, `"sequential"`, `"diverging"`, `"mono"` or `"accent"`), and the colours it names come from one place. With no `palette` set, every chart draws the colours it drew before; the one exception is the `BarChart` colour-key boundary described below.
  - `LineChart`, `AreaChart`, `ComposedChart`, `ScatterChart`, `LiveLineChart`, `PieChart`, `RingChart`, `RadarChart`, `SankeyChart`, `ChoroplethChart`, `DensityScatterChart`, `BulletChart`, `FunnelChart`, `CandlestickChart` and `WaterfallChart` gain `palette`. On a series chart it colours each series that has no colour of its own, in order; a series with its own `stroke` or `fill` keeps it. `LineChart` and `AreaChart` keep their single lead-line colour when `palette` is unset.
  - On `CandlestickChart` and `WaterfallChart`, `palette="diverging"` draws gains and losses with the two ends of the diverging ramp; any other palette uses its first two colours. On `CandlestickChart` this includes the patterns its candles get at high decoration. An explicit `positiveFill` or `negativeFill` on `WaterfallChart` still wins.
  - `chartCssVars` gains `signPositive` and `signNegative`, the colours of a gain and a loss. They point at the two ends of the existing diverging ramp, so no new token is needed. The two share one lightness, so a chart using them needs a second cue beside colour, such as an arrow's direction.
  - On a `BarChart` with a numeric `colorBy`, a value that lies exactly on a colour-key boundary now falls into the upper bucket, the same as on `ScatterChart`. Before, some such values fell one bucket lower.
  - `resolveColorBy` takes an optional third argument, `ResolveColorByOptions`, and its result now also carries the colour-key `items` beside `legend`. Called with two arguments it behaves exactly as before. `ResolveColorByOptions` and `ResolvedColorBy` are exported.

- 67db2cd: Charts support pinch-to-zoom by default. You can spread two fingers on a touch screen, pinch a trackpad, or hold Ctrl/⌘ and scroll the wheel. This zooms the x axis of `LineChart`, `AreaChart`, `ComposedChart` and `CandlestickChart` (time x or band x), vertical `BarChart` and matrix `HeatmapChart`. A two-finger drag pans. With the chart focused, `+` / `−` / `0` zoom and reset. Zoom-in, zoom-out and reset buttons appear while zoomed. Zoom moves the same window as the navigator strip and reports through `onWindowChange` (`null` when zoomed back out). `zoom={false}` turns it off. Zoom stays off while you drive `xDomain` yourself.

  Charts no longer block the page's own touch gestures. A vertical swipe over any chart now scrolls the page, and one finger still scrubs the tooltip horizontally. Plots with selection gestures, density-scatter and choropleth keep `touch-action: none`.

  `@elabs-ai/components-ui` adds the `charts.zoom.*` locale messages.

- ae26cf6: Internal only: the package now holds one shared description of each family of chart props — motion, plot size, legend, tooltip, palette, value formatting, loading and empty state, data labels, axis, series, reference lines and messages — plus the existing interaction, selection, navigator, selection-gesture and analytics prop sets. Each description records the props' names, the values they accept, a short explanation, and a default only where the charts already share one value (a chart with a different value keeps its own). No chart uses these descriptions yet, nothing is exported from the package, and every chart renders and behaves exactly as before. They are the groundwork for describing each chart kind in one place in a later release.
- a2ac71c: Internal only: the plain values behind a few chart props — `Responsive<T>` and the default plot height, `Margin`, `ChartInteractions`, `ChartA11yProps`, the container legend config, and the selection outline/dash constants — now live in their own dependency-free files instead of inside the React modules that used to own them. Every existing import path keeps working unchanged, and the package's exports are unchanged (verified by diffing the built `.d.ts` before and after).

  The dev-only "once per key" console warning (`warnChartOnce`) now shares its dedupe set with the rest of the design system instead of keeping its own; each chart's warning key is namespaced so it can never collide with a warning from another package.

- 6f45a14: `PieChart`, `RingChart`, `FunnelChart`, `RadarChart`, `UnitChart` and `BulletChart` gain the shared chart props the rest of the package already has: `margin` (a number, or `{ top, right, bottom, left }` — `RadarChart` accepts both too, but keeps resolving to a single radius inset, not a CSS box), a loading `status`, and a not-yet-loaded `empty` state (`PieChart`/`RingChart`/`FunnelChart`/`RadarChart`/`UnitChart`; `BulletChart` has no "nothing to plot" state distinct from loading, so it keeps only `status`). `UnitChart` and `BulletChart` also gain `plotHeight`, so a host or a `ChartFrame` can now size them like every other chart. `UnitChart`'s marks already showed a hover readout; it now also gains `tooltip` (on by default) so a caller can opt out. Every new prop is optional and defaults to today's exact look: no existing prop or default changes.

  Value formatting is narrower and more targeted than a blanket adoption: each family only accepts the members of the shared value-format group that actually change what it prints. `locale` formats that one chart's numbers in the given locale instead of the surrounding `LocaleProvider`'s. `BulletChart` already had `valueFormat`; it now also accepts `currency`/`maxFractionDigits`/`locale`. `PieChart` gains `valueFormat`/`currency`/`maxFractionDigits`/`locale` together, all new; they reach its slice labels and the legend's value column, and `locale` also reaches its centre value. `FunnelChart` gains `valueFormat`/`currency`/`maxFractionDigits`/`locale` together, all new; `maxFractionDigits` alone now rounds the printed value (previously a no-op without an explicit `valueFormat`), defaulting to a plain, uncompacted number so asking only for a fraction-digit tweak never also introduces unwanted compaction. `currency` alone still prints no currency symbol on `FunnelChart`, matching `PieChart`'s identical shape — either needs `valueFormat="currency"` alongside it, since a bare `style: "number"`/`"compact"` preset never reads `currency`. `RadarChart` gains `valueFormat`/`currency`/`locale`/`maxFractionDigits` together, all new and applying only to its container legend's value column (shown with `legend={{ values: true }}`). `RingChart` prints its numbers through its own vocabulary today and gains none of these props.

  The DOM is not byte-for-byte identical. `FunnelChart` now wraps its content in one extra inset `<div>` (every orientation) to carry the new `margin`, and `BulletChart` now wraps its plot in a `<div class="h-full w-full">` to carry the new `plotHeight`. `UnitChart` and `BulletChart` also now register as plot-height consumers, so one sitting inside a `ChartFrame` or a host `ChartConfigProvider` can size differently than before (previously neither read that context at all) — for `UnitChart` this is a real pixel change, not just a DOM one: its plot now reserves a minimum height floor (`plotMinHeight`) rather than being squeezed arbitrarily thin, and it now shrinks or grows with an ambient frame's `plotHeight` instead of ignoring frame context entirely. `UnitChart`'s golden-DOM baseline (`unit-chart.baseline.txt`) moves to match — a `min-height` on the plot box only, no mark coordinates change. `UnitChart` registering as a plot-height consumer also changes a real layout, not just the DOM: a `UnitChart` inside a plain (non-`tile`) `ChartFrame` with no `plotHeight` set anywhere now grows to its own natural aspect-ratio height, however tall that is, instead of sitting in `ChartFrame`'s bounded, scrollable 260px default body — the same trade a `HeatmapChart` or any other plot-height-aware chart already makes inside a frame. An `AutoChart` of type `unit` given a `height` or `plotHeight` now applies it to the plot alone, as `AutoChart` documents for every kind, so its legend and arithmetic stack below that height and the whole chart grows taller (with `plotHeight: 280` at 600 px wide the root is now about 470 px, not 280). `FunnelChart`'s definition-level default for `grid` is now explicitly `false`, matching the hidden grid the component already rendered — this fixes a gap in the definition's declared defaults, not a rendered change. `PieChart`'s `padAngle` was documented with the wrong unit (it takes radians, not degrees) — only the docs changed, the value was always radians.

- d72c650: Internal only: the remaining 18 charts (`PieChart`, `RingChart`, `FunnelChart`, `RadarChart`, `UnitChart`, `BulletChart`, `TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart`, `ParallelCoordinatesChart`, `ChoroplethChart`, `HeatmapChart`, `Gantt`, `DistributionChart`, `DensityScatterChart`, `DumbbellChart`, `BumpChart`) and the four card-like surfaces (`Gauge`, `Sparkline`, `ChartCard`, `MetricGrid`) now each have the same written-down description the first eight charts got in the previous release: every prop, its accepted values, a short explanation and the default already in use. Every chart and part in the package is now covered this way. No chart reads these descriptions yet, nothing new is exported from the package, and every chart and surface renders and behaves exactly as before. Groundwork for building charts from a spec, forms and agent catalogs from one source in a later release.
- aab37a5: Charts on the shared measurement path measure their size, pace their redraws during a resize and decide on reduced motion the same way. `TreeChart`, `Sparkline` and `Gantt` still measure themselves and keep their old timing. With no new props set, every chart draws at the same size as before.
  - `LineChartLoading` and `AreaChartLoading` gain `plotHeight`: pixels, `{ aspect }`, or a value per breakpoint, as on the chart they stand in for. It wins over `aspectRatio`, so the placeholder holds the box the loaded chart will fill.
  - A `DumbbellChart` with `groupBy` inside a `ChartFrame` or host with a fixed plot height now starts from that plot height and adds the room its group headers need, instead of starting from the default 2:1 box. The chart is therefore taller than the plot height by its header rows.
  - Charts redraw as soon as their box first changes size. While it keeps changing, such as while dragging a panel edge, they redraw with the newest size at most every 100 ms, and the final size lands within 100 ms after the resize stops. `AreaChart`, `BarChart` and `RadarChart` used to keep the size of the first step until 100 ms after a drag paused, and `SankeyChart` until 300 ms after; they now follow the drag. Every other chart on the shared measurement path, including `CanvasLayer` and `DensityScatterChart`, used to follow each step of a drag within about 10 ms and now redraws at most every 100 ms.
  - `NetworkChart` nodes, the chart reveal clip and `LiveLineChart` now follow the person's motion setting from the theme before the operating system's, like the other charts.
  - A non-default `enterStaggerScale` on `PieChart`, `RingChart` and `Gauge` now only changes the gap between items. It no longer stretches the delay before the first item starts. The defaults are unchanged.
  - `RadarChart` changes only with a non-default `enterDurationMs`: the wait before the series appear now grows once with the duration, not twice. At the default duration nothing changes, whatever `staggerScale` is.

- fcb884f: Chart tooltips never cover the pointer or the thing you are looking at.
  - `ChartTooltipBox` places itself with a keep-out engine instead of flip-then-clamp. The box is always placed wholly beside the pointer (or a keyboard-focused target) and the hovered mark, never clamped back over them. On a chart too small to hold it (a small multiple, a sparkline-sized panel) it steps outside the chart, beside it, over nearby page content, and stays there while you scrub. If nothing fits, it hides rather than cover the pointer. A finger gets the box above it. It follows reading direction (right-to-left starts on the left).
  - The box renders in the browser's top layer (`popover="manual"`), so a `ChartFrame`, `Card` or dialog that clips its overflow no longer cuts it off. It stays in the chart's own DOM (theme, `data-slot`, export exclusion unchanged). `Esc` hides it until the hover moves on. Under reduced motion the box jumps instead of sliding and has no entrance animation (it used to replay its scale-in on every hover). A side change never slides across the pointer.
  - New optional `ChartTooltipBox` props: `avoid` (the hovered mark(s) to keep clear of: a rect, an element or a ref), `track` (`"x"` crosshair, `"y"` rows, `"free"`) and `pinned`. `left`/`top`/`flipped` are deprecated: they bypass placement and keep the old behaviour. `ChartTooltip` and every chart family with its own box (dumbbell, bump, unit, network, heatmap, treemap, density scatter, sankey, choropleth, distribution, canvas layer, parallel coordinates) pass their hovered mark.
  - The crosshair date pill (and the live chart's time pill) shows only when it fits in the gutter under the plot (bottom margin ≥ 36px); the x-axis labels no longer fade for a pill that is not there. `showDatePill` still forces it either way.
  - `Sparkline`'s readout uses the same placement, above the line first. `ChartTooltip variant="inline"` moves its label below the point when the pointer sits where the label would be.
  - `ChartMultiples` matches a numeric x value to the label a non-time panel reports, so synced panel titles show the hovered reading on a linear or band x axis.
  - The `infographic-small-multiples-01` block plots its weeks as "Week 1"…"Week 13" (the tooltip title read "Thu, Jan 1" before) and shows the tooltip value as a percentage, like the panel title.

- 1b29a1c: `ScatterChart` now shows negative values. Before, its value axis always started at zero, so any point below zero was drawn outside the plot and cut off. When every value is zero or above, the axis is unchanged and still starts at zero. When any value is negative, the axis fits the data with a little room at both ends.

  `CandlestickChart` now fits its value axis to the candles you can see. When the navigator window, pinch zoom or your own `xDomain` narrows the time axis, the price axis rescales to the candles inside that window, the same way `LineChart` and `AreaChart` already do. Before, one spike outside the window could squash every visible candle into a thin band. With no window, or a window that holds no candles, the axis still covers all the data.

- 30b1cc9: `legend={{ values: true }}` now prints real numbers. Before, every entry showed 0. What the number means depends on the chart. `BarChart`, `RadarChart` and `DumbbellChart` show each series' total. `LineChart`, `AreaChart` and `ComposedChart` show each series' last value inside the visible window, and it updates as you move the navigator, zoom or set `xDomain`. `PieChart` shows each slice's value, `TreemapChart` each group's total, and `FunnelChart` the first stage. `ScatterChart` and `DensityScatterChart` show how many points each entry covers.

  Values use the chart's own number format: the `valueFormat` of the value axis each series is drawn on, or the chart's `valueFormat` or `formatValue`. When a chart's series sit on two value axes with different formats, such as currency on the left and percent on the right, the legend prints plain numbers so no series shows the other axis' unit. An entry with no number of its own, such as a bar overlay or a computed trend line, leaves its value blank instead of showing 0. A faceted `AutoChart` also leaves the shared legend's values blank for now, instead of showing 0.

  `ChartLegendEntry` has a new optional `value` field. `ChartLegend` leaves the value blank for an item whose `value` is `NaN`, and a progress-style item with a `NaN` value draws an empty bar with no percentage.

- db4422d: `ChoroplethChart`, `HeatmapChart`, `Gantt`, `DumbbellChart`, `BumpChart`, `DistributionChart` and
  `DensityScatterChart` now resolve their defaults through their own definition (`ADR 0042`), matching
  `LineChart`/`BarChart`/`WaterfallChart` and the rest of the family — no default value changed.

  `margin` now also accepts a single number (one value for every side) on `ChoroplethChart`,
  `HeatmapChart`, `DumbbellChart`, `BumpChart` and `DensityScatterChart` — each already took a
  `Partial<Margin>`. `DistributionChart` gains `margin` and `plotHeight` (px, or `{ aspect }`,
  optionally per breakpoint) for the first time. `Gantt` has no margin or aspect-ratio concept, so it
  is unchanged here.

  `ChoroplethChart`, `DumbbellChart`, `BumpChart`, `DistributionChart` and `DensityScatterChart` gain a
  `status?: "loading" | "ready"` prop: `"loading"` shows a skeleton in the plot box the chart will
  fill, with one polite status announcement, until the data is ready. Default `"ready"` — no visual
  change for an existing caller. `HeatmapChart` and `Gantt` keep their own pre-existing `loading`
  boolean for now; renaming it to the shared `status` name is a follow-up (`ADR 0042` Appendix A,
  row 18–19).

  `DistributionChart` and `WaterfallChart` gain `selectionStates`/`dimExcluded`: a host can now paint
  a selection's tri-state (selected / associated / excluded) back onto a distribution's groups or a
  waterfall's steps, the same seam `BarChart`/`DumbbellChart` already have. Unset, both charts render
  exactly as before. `WaterfallChart`'s selection is typed against a new exported `WaterfallRow` type.

  `Gantt`'s loading announcement now reads the shared "Loading chart…" text (`charts.chart.loading`)
  instead of a generic `"loading"` key, matching `ChartCard`/`ChartFrame`/`AutoChart`.

  `DensityScatterChart`'s axis-range selection is now built on the same primitives the rest of the
  package uses: selection-mode resolution (plain / Shift / Ctrl-Cmd) goes through the shared gesture
  engine's `resolveMode`, and the keyboard range thumbs render on the shared `RangeThumbs` widget in a
  new always-live "immediate" mode (no arm step, every key commits at once) rather than a private
  copy of the same interaction. The keyboard behaviour is unchanged, including Escape on one axis'
  thumb clearing only that axis; the two thumbs' accessible names now follow the shared "Range
  start/end, {axis}" wording by default, and at rest their grip is invisible (as it always was on
  this chart) until a thumb is focused. The pair sits in the axis gutter, unchanged from before. Its
  old `density-scatter-chart-x-sliders`/`density-scatter-chart-y-sliders` data-slots are gone; a
  consumer selecting on them should target `RangeThumbs`' own `chart-selection-range-thumbs` slot
  instead.

  Deprecated: `DensityScatterLabels.xRange`, `yRange`, `from` and `to` no longer drive the range
  thumbs by default, but still compose their old name when set (a one-time dev warning), so a caller
  that localised them keeps working; unset, the shared "Range start/end, {axis}" strings apply.
  Removed in 6.0.0.

- d3acf28: Bar charts can now title their axes: `BarXAxis` and `BarYAxis` accept `title` and `titlePlacement`, drawn the same way `XAxis` and `YAxis` draw theirs.

  Reference lines, trend fits and computed lines are now drawn by one shared painter with one set of dash patterns, so they look the same on every chart. Nothing changes on screen.

  `ScatterChart` and `CandlestickChart` now declare the `annotations` prop they already honoured, so it is typed and documented.

  `CandlestickChart`, `DumbbellChart` and `DistributionChart` now honour `ifOverflow: "extend"` on their analytics: a computed line outside the data grows the value axis to include it, as it already did on bar and line charts. The default (`"clip"`) is unchanged. `CandlestickChart` also now widens its price axis to fit its derived series — a trend, moving window, forecast or error bars (including their upper and lower bounds) — so a fit that runs past the highest high or lowest low is no longer cut off at the plot edge.

  Every zoomable chart now draws its zoom buttons with one shared component. A zoomed time series, `ChoroplethChart`, `TreeChart` and `Gantt` each keep their own look, and every button is a real button with a spoken name, reached with Tab and pressed with Enter or Space. Choropleth's buttons are now announced as a labelled "Chart zoom" group. TreeChart's and Gantt's zoom buttons are now left out of exported images, as the time-series and Choropleth zoom buttons already were, and TreeChart's focus ring is no longer clipped by the button pill.

- 2951367: `configureChartTestDouble` gains a `deprecatedProps` option: `"ignore"` (default, unchanged), `"warn"` (reports every deprecated prop found on a render via `console.warn`, once per prop name), or `"throw"` (fails the render), for a test double that receives a chart prop mid-rename. `resetChartTestDoubleConfig` resets it back to `"ignore"`. Until a prop's rename lands, this has no effect on any chart.
- 6f74a30: `TreeChart` branches now open and close. The tree still starts fully expanded, so a chart you already render looks the same on first paint. Click a branch to close or open it; with an `onDatapointClick` handler, a click on the node drills in as before and the dot does the toggling. From the keyboard, Tab into the tree (the tree itself adds one Tab stop, even without a handler) and use the arrow keys, Space and Enter as in any tree view. A closed branch shows its direct-child count as `Platform (3)` and gets a ring around its dot, so it does not rely on colour alone. Every change animates: nodes grow out of their parent and fold back into it, and opening a branch scrolls its new children into view. Orientation, data and size changes animate the same way, and reduced motion snaps straight to the new layout.

  To keep the old static chart, pass `collapsible={false}`. It draws exactly as before, including the `+k` pill from `collapseDepth`, and its click payload keeps `index` as the node's depth. One correction reaches it: with `collapseDepth`, member counts in accessible names, tooltips and the click payload's `descendantLeafCount` now count the real leaves under a node; before, each `+k` pill counted as a single leaf. `renderNode` needs the collapsible chart: with `collapsible={false}` it is ignored (with a warning in development) and the default dots are drawn.

  `collapseDepth` is deprecated. On a collapsible chart it now means the same as `defaultExpandedDepth`: branches at that depth start closed and show `(n)`, instead of being replaced by a `+k` pill.

  New props:
  - `renderNode` draws each node as your own content, such as a small card, inside a fixed `nodeWidth` × `nodeHeight` box (default 160 × 72). Links attach to the box edges and the chart adds its own open/close pill. The content is presentational: keep it free of focusable elements and restate what it shows through `datapointLabel`.
  - `expandedIds` with `onExpandedChange` control which branches are open. `defaultExpandedIds` or `defaultExpandedDepth` set the starting state instead.
  - `align="center"` centres the tree in a larger container. A tree bigger than its container scrolls, never clips, and opens centred on its root; "Expand all" and orientation switches stay centred on it.
  - `TreeNode` accepts an optional `id` (a stable identity for expand state and animation) and a `data` payload that is handed back to `renderNode` and, on the collapsible chart, to `datapointLabel` and `onDatapointClick`.

  The default accessible name of a branch now states its direct children, plus its leaf count when that is different: `Engineering, 2 children, 5 members` instead of `Engineering, 5 members`. Open or closed is announced through `aria-expanded`, not the name. `collapsible={false}` keeps the old wording.

  `ChartDatapointProvider` takes a new `disabled` prop: it provides nothing, exactly as if it were absent, so a chart can keep one element tree whether or not a handler is set. `TreeChart` uses it, so adding `onDatapointClick` later no longer resets the open branches.

  `@elabs-ai/components-ui` adds the `charts.treeChart.expand` and `charts.treeChart.collapse` locale messages. They name the pointer toggle, which appears when the chart also has an `onDatapointClick` handler.

- fcb884f: Two neutral seams, and the KPI Tree block rebuilt on them.
  - `TreeChart` gains `renderLink`: draw something at the midpoint of every link — the operator a child enters its parent with (`+`, `−`, `×`), a weight, a share. It receives the parent and child nodes (with their `data`), the child's index among its siblings, the depth and the orientation, and it rides along when branches open, close or the tree reorients (`TreeChartLinkRenderProps`; new `Charts/TreeChart/Link Decorations` story).
  - `TreeChart` gains a canvas viewport, the way `CanvasShell` has one in the flow package: `zoomable` (the wheel zooms around the pointer, dragging pans — from the empty canvas or from a node, with a click still opening the node — and the tree can be dragged around even when it fits, since the box leaves room around it; a trackpad pinch zooms, and zoom in / out / fit controls sit in the corner in the flow package's chrome; `zoomRange`, `defaultZoom`, `onZoomChange`) and `minimap` (every node as a box, the part in view as a window; click or drag it to move the view — the `--flow-minimap-*` tokens). Zoom is a `scale()` on the canvas inside the chart's own scroll box, so the scroll-edge fade, the flights, the pills and the keyboard tree keep working at every zoom. Both are off by default. New `Charts/TreeChart/Viewport` story; the controls are localised (`charts.treeChart.zoom*`, `fitView`, `minimap`).
  - `TreeChart` links are visible in dark themes now: they were a `--chart-grid` hairline (0.65px, drawn to disappear behind marks — ~2:1 on dark), and a tree's links are structure, not gridlines. They take the design system's edge token, `--flow-edge`, at 1px, so a tree and a flow canvas draw their connections the same way in every theme.
  - `MetricCard` gains `comparisons`: several named changes side by side as a row of chips under the tile body (month over month beside year over year, actual vs target vs last year). Each chip carries an arrow, the sign and a tone, and a bad-news chip also differs in shape (a dashed outline) so the row survives greyscale; `delta` stays the one headline change beside the value. Default: none; hidden at `size="sm"` (`MetricCardComparison`; new `Core/MetricCard/Comparisons` story).
  - The `infographic-kpi-tree-01` block no longer hand-rolls its cards or its change chips: every node is `MetricCard` with a `Sparkline` and the two `comparisons`, and every connecting line now carries the operator — Revenue **+** and Operating costs **−** (dashed) visibly make Operating profit, Customers **×** ARPU make Revenue — spoken in each tree item's name too ("subtracts from operating profit"). New story `Operators On The Lines` locks it. The block is also a canvas now (`zoomable` + `minimap`), story `Zoom And Minimap`.

- f4eee30: `UnitChart` now honours the six-colour limit when you leave `palette` unset. With seven or more series and no `palette` prop, it draws the neutral grey ladder and logs one development warning, the same as `BarChart` and the other chart families. Before, it always drew twelve category colours, as if you had asked for them. Passing `palette="categorical"` yourself still gives one colour per series at any count, with no warning. Charts with six or fewer series look the same as before.

### Patch Changes

- 382acd3: Chart PNG and SVG exports now show everything the chart shows on screen. Before, an export kept only the first `<svg>` in the chart body plus its HTML text, so a lot went missing. Funnel stages, small-multiple panels, navigator strips and axis-title graphics disappeared, and so did legend dots and swatches, pills, colour ramps, canvas-drawn marks (density scatter), rotated labels and KPI digits drawn by NumberFlow. When the first `<svg>` was a legend marker or icon, the export picked that marker as "the chart".

  The export now does the following:
  - It picks the largest chart `<svg>`.
  - It carries every other `<svg>`, `<canvas>` and `<img>` in the body, and HTML boxes with their fills, gradients, borders, radii and rotation. They paint in the same order as on the page.
  - It keeps each label's rotation, clipping and `…` truncation.
  - A chart that scrolls inside its frame (a wide tree, a long calendar heatmap) exports only the part in view, the same as its labels.
  - It walks open shadow roots.
  - It leaves out transient chrome: tooltips, the crosshair, zoom buttons, the selection toolbar and frame menus.

  The PNG embeds the page's web fonts, so text keeps its font and line breaks. It no longer fails outright on data whose ids contain control characters, which some process maps have.

- 1f69091: `LineChart`/`AreaChart`'s `focusOnHover` (RM-112) spotlight/dim now has a keyboard path with
  no `legend` set at all — the chart's own default configuration. A new `SeriesFocusTargets`
  layer mounts one invisible-until-focused button per series (a positioned sibling of the
  chart's own `aria-hidden` `<svg>`, in the spirit of `ChartDatapointLayer`) whenever the
  container legend isn't actually painting; focusing one spotlights that series exactly like
  hovering it does. Because it reads `focusOnHover` from the shared `ChartSeriesModeProvider`
  context, a standalone `<ChartTooltip focus>` (RM-119, with no container `focusOnHover` or
  `legend`) gets the same keyboard path too, with no changes to `ChartTooltip` itself.

  `LegendItem` (the standalone `Legend`/`LegendItem` compound, e.g. `ProfitLossLegend`) also
  now renders a real, focusable `<button>` with `onFocus`/`onBlur` mirroring its existing
  `onMouseEnter`/`onMouseLeave`, so a keyboard user reaches the same spotlight/dim state
  through an opted-in legend too.

- 8930045: - charts: `SeriesBar` takes `yAxisId` and `name`, so a `ComposedChart` column can sit on the right axis and show its display name in the legend and tooltip; `AutoChart` `type: "dual-axis"` now draws a right-axis column instead of the unsupported fallback (#610).
  - charts: hovering a `ComposedChart` legend item now dims the other series' columns (#610).
  - ai: the A2UI catalog documents `ChartSpec.legend`'s object form (`position`, `layout`, `interactive`, `values`, `title`) and that a dual-axis column may sit on either axis (#610).
- 75f62c2: - `DumbbellChart` `variant="arrow"`: a row's delta label now sits above its own arrow head, its bottom edge derived from the head's width, so a short row's label never paints over the head at narrow widths (#547).
  - `PieSlice`: under reduced motion the entrance skips the per-slice stagger and the sweep, so every slice mounts whole instead of taking about a second (#549). Fixed a regression this introduced: the hover/focus glow (`drop-shadow`) stopped updating once the entrance became effectively instant, because Motion only reliably re-applies a `style` value that is also part of the `animate` target — the glow now moves through `animate`/`transition` on every slice render path (mount-complete, in-flight entrance, and the non-animated `animate={false}` slice), so it updates on every hover/focus change regardless of motion preference.
  - `Scatter`: the default animated point path now carries `data-slot="scatter-point"` and `data-index` on each point, like the static path; `SeriesMarkers` gains an opt-in `pointSlot` so line/area markers stay unnamed (#549).
- 9525e41: Fixed two chart-label bugs. `PieChart`'s `labels={{ matchColor: true }}` now paints slice labels in a contrast-safe mix of the slice's own color instead of the raw series colour, so the text clears 4.5:1 against the chart background in every shipped theme (it previously failed as low as 1.16:1). The `sr-only` restatement for a chart label that could not be painted no longer risks corrupting label text that itself contains a space (for example a pie label like "Direct · 30.8%") when it drops.
- 117f9cf: Charts that size themselves now read their layout size, so a CSS scale on a parent no longer changes it. Before, a chart that mounted while a parent was scaled (the fade-and-grow entrance of `ChartFrame`, or a dialog opening) kept that smaller size after the animation ended. `DensityScatterChart` then drew its dots stretched against its axes and zone outlines: up to about 5 % off in a framed chart, and about 10 % in the frame's expanded view, where the dialog and the frame both scale. `CanvasLayer` and the scatter, bump, bullet, dumbbell, parallel coordinates and funnel charts and the navigator strip stopped short of their box. The treemap, network and unit charts filled it but drew slightly too large, and the treemap's zoom buttons sat off their bands.
- b4b1840: `MetricGrid` now fills the width it is given inside a centered or flex parent. Before, the grid's container-query wrapper had no width of its own there, so the whole grid collapsed to 0 px wide and its tiles and charts drew nothing. The published Storybook showed this on five MetricGrid stories.
- Updated dependencies [8cdcd91]
- Updated dependencies [26cef85]
- Updated dependencies [67db2cd]
- Updated dependencies [8f34fc8]
- Updated dependencies [3ad62fe]
- Updated dependencies [9a200ab]
- Updated dependencies [6e54152]
- Updated dependencies [fd51c5a]
- Updated dependencies [dbcc5a8]
- Updated dependencies [13161b8]
- Updated dependencies [382acd3]
- Updated dependencies [fb6a14e]
- Updated dependencies [59c241f]
- Updated dependencies [7737be6]
- Updated dependencies [6f74a30]
- Updated dependencies [fcb884f]
- Updated dependencies [3dcc396]
- Updated dependencies [12955fb]
- Updated dependencies [5c8f488]
- Updated dependencies [e667eb2]
  - @elabs-ai/components-tokens@5.6.0
  - @elabs-ai/components-ui@5.6.0

## 5.5.0

### Minor Changes

- 6825d53: Legends: a faceted `AutoChart`'s shared legend now drives every panel — hovering an item dims the other series (pie: slices) in each panel, and `legend: { interactive: "toggle" }` hides a series from all of them. Radar and funnel charts (and `AutoChart` specs of those types) now use the same container legend as every other chart, via a new `legend` prop on `RadarChart` and `legend` + `seriesLabel` on `FunnelChart`. `ChartSpec` gains an optional `valueKeys` (dumbbell `variant: "dots"`), so an `AutoChart` dots dumbbell draws those keys and gets the shared legend.
- 92b8935: `DensityScatterChart` — a point plot for 10⁵–10⁶ rows. Every point is always drawn (WebGL point sprites, Canvas-2D fallback); its colour is the density around it, binned in screen pixels so zooming in resolves the shape into individual dots with no mode switch; `zones` on the axes (a per-axis `min`/`max` or an `upper`/`lower` envelope along x) classify each point and feed the legend, the tooltip and the accessible summary. Selection is an intersection: an x range (drag the bottom axis, or `role="slider"` thumbs by keyboard), a y range, a range box or a lasso from the selection toolbar (`ChartSelectionToolbar`: Pointer / Range / Lasso, in `ChartFrame`'s action slot when framed) and a zone pick (a Shift/Ctrl-click on a legend entry, or the zone's in-plot tag) — each gesture also emits a `ChartSelectionIntent`. Columnar input (`{ x, y, values, categories }`) or rows; `colorBy` a zone, a continuous column (cell means on the sequential ramp) or a category. `useContainerLegend` gains an `onItemClick` pass-through and `useContainerSelection`'s host a `selectedCount` (both unchanged when unset). Registry: three chart stories — `chart-story-density-envelope-01` (a flight-test envelope), `chart-story-density-wafer-01` (a wafer map by test bin) and `chart-story-density-fills-01` (order fills against latency SLA bands) — each with selection tiles from the shared `density-parts` item.
- 0f409ef: `DumbbellChart` — the `"dumbbell"`, `"slope"` and `"arrow"` variants now take the shared container legend too: two entries keyed by marker shape (hollow start, filled end) in neutral ink, labelled by the new `startLabel` / `endLabel` props (default: `startKey` / `endKey`). `AutoChart` routes every dumbbell variant through the shared legend, using each series' `label`, and retires its old before/after list for dumbbell. `LegendItem.marker` and `ChartLegendEntry.marker` gain `"hollow"` (a ring swatch, `data-marker="hollow"`), so a hollow/filled pair stays distinguishable in greyscale.

### Patch Changes

- c3a1454: `<ChartTooltip valueInTitle />` now swaps an enclosing `ChartFrame`’s title for the hovered row (“Apr: Revenue 18,500”) with no consumer wiring (#610). Pointer hover, a tap-pinned tooltip and keyboard focus on a datapoint all drive it; leaving restores the title. The change is announced once through a single polite `role="status"` in the frame header (the tooltip’s own pin announcement defers to it inside a frame). The value travels through a small store the frame provides, so only the title re-renders, and only when the shown text changes — a pointer moving within one category does nothing. Frames with no title to replace (`chrome="bare"`, a tile with a custom `headerSlot`, the expanded dialog) and charts outside any frame behave exactly as before. The tooltip’s pin announcement now also carries each row’s `unit`, matching the box.
- 2935b04: Hover-only chart legend items (Pie, Scatter, Treemap, Dumbbell, and any `ChartLegend`/container legend left at the default `interactive: "hover"`) are now real, focusable buttons instead of plain unfocusable rows. Tab reaches every legend item and focusing one applies the same highlight hovering it with a mouse does; these items are not toggles, so they still carry no `aria-pressed` and no click behaviour.
- 52ab89f: Fix two chart polish issues (#609): a y-axis tick could briefly render on top of a neighbouring tick mid-transition after a domain change (e.g. a legend toggle) — ticks now tween via `transform` instead of `top`, so every tick's move stays in lockstep instead of drifting out of sync under load. Also stop calling `preventDefault()` inside the chart's passive touch handlers (a browser console warning on every tap; `touchAction: "none"` already blocks the native gesture) and commit a touchstart's tooltip synchronously so a very fast tap can still be pinned open on a touch device.
- 74fa5b4: Fix two chart-shell bugs: a narrow tile (e.g. a 390px tile, or any box smaller than the chart's own margins) could render an SVG `<rect>` with a negative height/width, logging a console error (`innerWidth`/`innerHeight` are now clamped to `>= 0` in `grid.tsx` and in every chart shell that computes them: `time-series-chart-shell`, `bar-chart`, `candlestick-chart`, `scatter-chart-shell`, `sankey-chart`); and hiding every series through an `interactive: "toggle"` legend used to leave a blank, unexplained axis grid — it now shows the shared "nothing to show" empty state while the legend stays usable to bring a series back.
- 10d4802: Legend labels, titles, and values now use the semantic `text-meta` typography role instead of raw `text-sm` utilities. Waffle legend labels now inherit the same styling as container-legend-engine legends, and all engine-mounted legend rows (labels, titles, values) respect the density dial through their typography role.
- da74254: `ScatterChart`'s legend now dims non-matching series on hover, matching `BarChart`/`LineChart`/`AreaChart`: hovering (or keyboard-focusing) a legend row fades every other series' points via the existing `ChartLegendHoverProvider` seam.
- a619db9: Fix `WaterfallChart`'s `labels` value labels dropping every checkpoint (total/subtotal) at narrow container widths instead of the lower-priority step labels, by clamping each label's fixed axis into the plot bounds at construction time so a checkpoint's own headroom, not a priority reweight, decides what stays on screen.
- Updated dependencies [d0a075d]
- Updated dependencies [d0a075d]
- Updated dependencies [144375d]
  - @elabs-ai/components-ui@5.5.0
  - @elabs-ai/components-tokens@5.5.0

## 5.4.0

### Minor Changes

- 9476064: ADR 0040 (RM-136): the `analytics[]`, navigator window and selection-gesture contracts — `ChartAnalytic`, `NavigatorWindow` / `ChartNavigatorProps` and `ChartSelectionIntent` / `ChartSelectionGestureProps` types are exported; `d3-regression` and `d3-polygon` become direct dependencies.
- 28f73f0: RM-137 (ADR 0040 §1): the framework-free `analytics/` stats core — `resolveAnalyticValue` / `spreadBand` (mean, median, min, max, sum, R-7 percentiles, sample/population std-dev, t-based confidence interval), `fitModel` (linear, log, exp, pow, poly 2–6, loess on d3-regression, with r², coefficients and a mean-response confidence band for the linear family), `windowReduce` (the notebook plotting library window semantics, plus an `ewm` reducer) and `forecastHoltWinters` (additive trend/season, grid-fitted parameters, widening prediction interval). `fitTrend` now delegates to `fitModel`; its API is unchanged.
- be8ddcf: RM-138 / RM-139: `analytics[]` on the chart containers (ADR 0040 §1). `LineChart`, `AreaChart`, `BarChart`, `ComposedChart`, `DumbbellChart`, `WaterfallChart`, `CandlestickChart`, `ScatterChart` (both axes) and `DistributionChart` accept `analytics`:
  - **Computed lines and bands** — `{ kind: "line", value: "mean" | "median" | "min" | "max" | "sum" | number | { percentile } | { stddev } | (rows, key) => number }` and `{ kind: "band", from, to }` / `{ kind: "band", spread: { percentiles } | { stddev } | { ci } }`, resolved with the RM-137 maths and drawn through the annotation layer (a dashed `--chart-foreground` line; a band under the series). `of` names a series or `"all"` (pooled); `axis` the drawn axis; `when(rows)` is a show-condition; `ifOverflow: "extend"` widens the value domain, `"clip"` (default) keeps it. Labels: `"computation"` ("Average 73.8", localised), `"value"`, `"none"` or your own text; the axis' own `valueFormat`/`unit` formats the value.
  - **Derived series** — `trend` (linear, log, exp, pow, `{ poly }`, `{ loess }`, optional `ci` band, `extent`), `window` (mean, median, sum, min, max, ewm; `replace: true` stands in for its measure in the series token), `forecast` (additive Holt-Winters, `horizon`, `season`, `interval`; the time-series x domain grows to show the horizon) and `errorBars` (from fields or `{ percent }`; whiskers, or `band: true` on lines). Model paths are dashed in `--chart-foreground-muted`, each with its own dash rhythm; bands wash under the marks. Each derived series joins the container legend (dashed marker, "Trend (r² 0.82)", toggleable), adds a muted tooltip row, and adds one sentence to the figure description (appended after the auto summary, never replacing it).
  - `ReferenceLine value` and `DistributionReferenceLine value` (plus a new `to` for a band) accept an `AnalyticValue`; `ChartSpec.analytics` carries the serialisable form and `AutoChart` renders it; the A2UI catalog describes the kinds and the value union.
  - `<Scatter trend>` is now a deprecated alias of a `trend` analytic: it keeps its painted output and gains the legend entry; a dev warning names the replacement.
  - New exports: `resolveAnalytics`, `widenDomainForAnalytics`, `derivedSeries`, `deriveAllSeries`, `describeAnalytics`, the label helpers, `AnalyticSeriesLayer`, `ErrorBars`, `useChartAnalytics`, `resolveDistributionReferenceLines`. `LegendItem.marker: "dashed"` and `TooltipRow.muted` / `dashed` support the new entries. `@elabs-ai/components-ui` registers the `charts.analytics.*` messages.

  With `analytics` unset every container renders exactly as before.

- 28f73f0: `ChartNavigator` (RM-140, ADR 0040 §2): an overview strip below the plot, outside `plotHeight` — a min/max-preserving condensed shadow in `--chart-grid` ink, a compound-outlined window and two keyboard-operable `role="slider"` handles (arrows, Shift+arrows, Home/End, PageUp/PageDown, live-region announcements), with drag, click-to-locate and wheel panning. `LineChart`, `AreaChart`, `ComposedChart` and `CandlestickChart` accept `scrollbar` (`"miniChart" | "bar" | "none"`), `window` / `defaultWindow` / `onWindowChange`, `minSpan`, `align` and `maxVisiblePoints` (default 2 000): the strip appears automatically above `maxVisiblePoints` rows or when a window is given, and drives the existing `xDomain`. With `scrollbar="none"` (or nothing set on smaller data) the DOM is unchanged. `condenseOverview` and the pure window helpers (`clampWindow`, `shiftWindow`, `zoomWindow`, `indexToTime`, …) are exported. `ChartBrushLayout` is deprecated in favour of the navigator.
- be8ddcf: Overflow scrolling on the category families (RM-141, ADR 0040 §2). `BarChart` (vertical and horizontal), `ComposedChart` / `LineChart` / `AreaChart` on a category x, and `HeatmapChart` (a column window) accept `scrollbar` (`"miniChart" | "bar" | "auto" | "none"`, default `"none"`), `maxVisibleItems` (`Responsive<number | "auto">`, default `"auto"` — as many categories as keep a readable band), `window` / `defaultWindow` / `onWindowChange` (kind `"index"`), `minSpan`, `align` and `windowDomain` (`"all" | "visible"`). With a scrollbar set, the strip appears once the categories overflow `maxVisibleItems` (or whenever a window is given): the band scale is built for the visible slice, rows outside the window are not drawn but stay in `data` (table flip, honesty gate, and every datapoint / tooltip index still address the full data), and the value axis keeps the full data's zero-based domain unless `windowDomain="visible"`. Vertical charts get the strip below the plot, outside `plotHeight`; horizontal bars get a vertical strip on the right edge whose handles announce "Row n of N" (ArrowDown moves a vertical handle down). A chart whose categories fit renders byte-identical DOM. `ChartSpec` gains `scrollbar` and `maxVisibleItems`, and the A2UI catalog tells agents to set `maxVisibleItems` for more than 30 categories.
- 28f73f0: RM-142: the selection gesture engine (ADR 0040). `ScatterChart`, `BarChart` and the time-series shell accept `selectionGestures` + `onSelectionIntent` (plus `selectionConfirm`, `selectionField`, `selectionHitRule`): a rectangle, lasso, axis range (plot drag or axis gutter) or click resolves to ONE `ChartSelectionIntent` — `field`, distinct `values`, a modifier-driven `mode` (plain replace, Shift add, Ctrl/Cmd toggle; `explicit` confirm toggles), the gesture in data units and the hit `datapoints`. Rect/lasso hit visible marks only (`overlap` default); a time-axis range also takes hidden values; a measure-axis range yields dimension values. Touch: tap = click, 400 ms long-press arms the lasso. New exports: the pure `gestureReducer` / `resolveMode`, `hitsInRect` / `hitsInPolygon` / `hitsInBand` / `visibleOnly`, the geometry helpers (`pixelRangeToData`, `bandCategoriesInRange`, `simplifyPath`, `snapToClose`, `radialToPolygon`), `resolveSelectionIntent`, `useChartGesture`, `GestureOverlay`, the mark registry (`useRegisterMarkGeometry`) and `ChartSelectionGestureScope` / `ChartSelectionGestureLayer`. The canvas `SpatialGrid` gains `queryRect` / `queryPolygon`. With the props unset every chart renders byte-identical DOM.

  The dead drag-range state is gone from `useChartInteraction` / `useScatterChartInteraction` and from the chart context (`selection`, `clearSelection`, and the `onMouseDown` / `onMouseUp` handlers they set); `ChartSelection` stays exported as a deprecated type. `SegmentBackground` / `SegmentLine` now paint the engine's in-flight x range (a chart with `selectionGestures`) instead of any mouse drag, and a drag no longer widens the line highlight band.

- be8ddcf: Selection gestures: axis ranges, area, lasso and radial (RM-143, RM-144, ADR 0040 §3–5).
  - **Axis range** (`selectionGestures` includes `"range"`): press in an axis's tick-label zone and drag along it. A dimension axis selects the categories in the band (a time axis every row in range, visible or not); a measure axis selects the DIMENSION values whose measure — of the first series, reported as `gesture.of` — lies in the band. The band stays painted with a range bubble at each end; on a measure or time axis a click turns the bubble into an `Input` (Enter applies, Esc reverts). Stacked bars arm the dimension axis only. Keyboard: "Select a range on the X / Y axis" buttons open two `role="slider"` thumbs (arrows, Shift ×10, Home/End, PageUp/PageDown, Enter selects, Esc cancels) with `aria-valuetext` in data terms. With `"range"` listed first the plot stays a pointer.
  - **Area** (`"rect"`, `"lasso"`, `"radial"`): plain drag in the engine's mode; Shift+drag draws a rectangle from pointer mode and Shift+Alt+drag a lasso from any mode; `selectionHitRule` `"overlap"` (now also catching a lasso band that crosses a bar) or `"contain"`; visible marks only. The keyboard rectangle — S, arrows, hold Space to draw, release to select (Shift add, Ctrl toggle), Esc cancels, a live region announcing the count — is the keyboard equivalent of all three.
  - Mounted on the time-series shell (`LineChart`, `AreaChart`, `ComposedChart`), `BarChart`, `ScatterChart`, `DistributionChart` (value range; area gestures on strips), `HeatmapChart` (column / row ranges — a row range reports the `y` field) and `CanvasLayer` (new `selectionMark` / `selectionAxes` register the canvas points in the selection registry). `DistributionChart` and `HeatmapChart` gain the `ChartSelectionGestureProps`.
  - New exports: `ChartSelectionGestureHost`, `ChartSelectionGesturePlotLayer`, `ChartSelectionGestureHitArea`, `useChartSelectionGesturesEnabled`, the range model helpers (`buildRangeAxisModel`, `rangeBandForKey`, …), `keyboardRectReducer` / `useKeyboardRect`, `resolveAreaDragMode`; `useChartGesture` returns `emitGesture`. With the props unset every family's DOM is unchanged.
  - Fixes in the RM-142 engine: re-asserting the current mode no longer cancels a gesture in flight, marks register and listeners bind at commit, and `contain` tolerates a rectangle clamped to the plot edge.

- 759439f: Selection chrome and intent (RM-145, ADR 0040 §4). A chart that lists `selectionGestures` now gets a `ChartSelectionToolbar` — Pointer / Range / Rectangle / Lasso toggles, the live count and, with `selectionConfirm="explicit"`, ✓ / ✕ — in `ChartFrame`'s action row when framed (new `selection` frame prop: `{ confirm, toolbar }` defaults) or above the plot on a raw container (`selectionToolbar: "none"` hides it). `explicit` confirm accumulates a provisional set (click toggles, gestures add) painted through `selectionStates` with `data-selection-provisional="true"` on the chart root; ✓, Enter or a press outside commits ONE `replace` intent, ✕ or Esc cancels, and each step is announced. A keyboard datapoint activation also feeds the session (`onDatapointClick` is unchanged). New exports: `useSelectionSession`, `ChartSelectionToolbar`, `useContainerSelection`, `createLocalSelectionDriver` / `useSelectionDriver` (the parked dashboard core's `select` / `clear` / `states` shape). `ChartSpec.selection: { gestures, confirm, field }` and `AutoChart`'s `onSelectionIntent` (A2UI event `selectionIntent`) let an agent ask for "a bar chart with range and lasso selection". The test double's `assertChartContract` throws on an `onSelectionIntent` without `selectionGestures`.
- cb0a0d9: Chart interaction track closure (RM-146, ADR 0040): `brand-ui docs` now lists `analytics`, `scrollbar`, `maxVisibleItems`, `selectionGestures`, `onSelectionIntent` and `selectionConfirm` on every chart that takes them (restated on each container's own props interface); the manifest extractor no longer records a comment between `extends` bases as a base; `brand-ui chart-for` prints "also consider" prop hints (analytics, scrolling, selection) when the query names them; `brand-ui audit` gains the advisory `charts/gestures-need-intent` and `charts/analytic-line-unlabelled` rules; new copy-own registry block `analytics-dashboard-01`.

### Patch Changes

- 40ee152: Fix the chart tooltip box overflowing the container's left edge (e.g. the `table` tooltip preset at narrow widths) by clamping the X placement into the container the same way Y already was.
- 81f1c61: A time-series navigator's axis now reaches a `forecast` analytic's horizon (RM-139 × RM-140): the end handle travels past the last reading and a `window`/`defaultWindow` ending there paints the projection instead of clipping it. The strip's shadow still condenses the rows alone — the tail past the data stays empty. Four "lived-in" family stories (`LineChart` growth desk, `BarChart` sales desk, `ScatterChart` ticket triage, `AreaChart` demand desk) show analytics, the navigator and selection gestures composed the way an app uses them.
- 8c7d180: Visual pass over the chart interaction track (RM-137…145). `Line` / `Area` `name` now reaches every family's legend key and tooltip row (`LineConfig.name`, RM-110) — `ComposedChart` used to print the raw `dataKey`. Hiding a series through an interactive legend also dims the trend / window / forecast entries derived from it (`useAnalyticsLegend` returns `displayHidden`); a dimmed derived entry is inert until its source returns. `useSelectionSession` restarts its tool mode when the gesture list changes (a controlled `mode` is untouched). `ChartFrame` groups its action buttons in one `data-slot="chart-frame-actions"` row beside the selection toolbar and lets the title column shrink (`min-w-0 flex-1`). `MetricGrid` sizes its columns by its own container (container queries) rather than the viewport. Range bubbles keep to the plot, horizontal-bar annotation labels sit above their rule, and immediate-confirm counts follow the host's painted `selectedCount`.
- Updated dependencies [be8ddcf]
  - @elabs-ai/components-ui@5.4.0
  - @elabs-ai/components-tokens@5.4.0

## 5.3.1

### Patch Changes

- @elabs-ai/components-tokens@5.3.1
  - @elabs-ai/components-ui@5.3.1

## 5.3.0

### Minor Changes

- 066fa5b: Withdraw the dashboard sheet surface while its authoring experience is reworked.

  `@elabs-ai/components-charts/dashboard`, `@elabs-ai/components-charts/dashboard/test` and
  `@elabs-ai/components-charts/dashboard/schema.json` shipped in 5.0.0, 5.1.0 and 5.2.0 and are
  **not published from this release on**. This is a deliberate, quiet withdrawal of a published
  export, not an accident: the spec-driven data model is sound, but the drag-and-drop authoring
  experience is not good enough to carry the library's name, so it is being rebuilt rather than
  patched. The decision behind it (ADR 0037) is parked, not reversed.

  Removed with it: the `brand-ui dashboard-spec` command group (`schema`, `validate`, `kinds`,
  `layout`), the five `dashboard-*` copy-own registry blocks, and the `dashboard-sheet` starter
  template. `@dnd-kit/core` and `zustand` are no longer dependencies of
  `@elabs-ai/components-charts`.

  **If you import any of the above**, pin `@elabs-ai/components-charts@5.2.0` (and
  `@elabs-ai/components-cli@5.2.0`) until the surface returns; there is no replacement API in this
  release, and no deprecation period was possible without shipping a surface the maintainer does
  not stand behind.

  **The static KPI dashboard is unaffected.** `MetricGrid`, `MetricCard`, `ChartFrame`,
  `AutoChart` and the rest of the main `@elabs-ai/components-charts` barrel are unchanged, the
  `dashboard` archetype template and playbook still ship, and `brand-ui create --template
dashboard` still scaffolds it.

### Patch Changes

- @elabs-ai/components-tokens@5.3.0
  - @elabs-ai/components-ui@5.3.0

## 5.2.0

### Minor Changes

- 04be140: Dashboard pack rebuild — the sheet editor now behaves like a BI authoring surface.
  - Engine: `fit` placement pushes neighbours to the nearest free cells (biased away from the drag), swaps a same-size neighbour, and grows an `extendable` sheet without shrinking its cells; new `TileLayout.static` locks a tile (never moved, never pushed, an obstacle for compaction).
  - Edit layer: the dragged tile follows the pointer 1:1 and a resize edge follows the cursor while a dashed ghost shows the snapped cell; dotted cell grid (`ui.showGrid`); corner/edge grips centred on the tile edge; size badge only during a gesture; lock badge; handles on single selections only; align toolbar flips inside the selection when there is no room above.
  - Chrome: rebuilt `DashboardToolbar` (segmented View/Edit, undo/redo, Add, Grid with Show-grid switch and live density summary, Layout menu with Tidy up / Select all / selection actions / layout target, save state, Assets and Properties toggles, Export, shortcuts; new `features.layout|panels|export`), edit-mode tile hover chrome (Duplicate · Delete · ⋮ → full context menu with icons, shortcut hints, Properties, Lock), `DashboardSelectionBar` empty state and right-aligned actions, `DashboardAssetPanel` rows with icon + description and a full-height list, `DashboardPropertiesPanel` Layout section (column/row/width/height, lock), empty-sheet state.
  - Tiles: `DashboardTileKind.description`, `capabilities.padding`, `capabilities.surface: "plain"` (heading, divider); built-ins ship icons and descriptions; metric tiles show the number on two-row tiles; untitled tiles get a muted placeholder title in edit mode.
  - `ChartFrame chrome="tile"` floats the menu over the top-end corner when a frame has no header content instead of spending a header row on it.
  - `ui/Toolbar`: `ToolbarSeparator` was rendered as a horizontal dash inside horizontal toolbars (Radix flips the separator's orientation); fixed.
  - Filter tile: hierarchies — `levels` (2–6 fields, `rows` → Country → Region → City) or a `parentChild` table (org chart, bill of materials) render as a tri-state tree (`selected | associated | excluded` per node, counts, match-highlighting search that auto-expands, Expand all / Collapse all, `expandLevel`, `leafOnly`, `selectWithChildren`, `dense`); `confirm` turns clicks into a pending session with Confirm/Cancel; under 100 px tall (`xs`) the tile collapses to a bar that opens the full list in a popover. `filter-tree.ts` (`buildLevelTree`, `buildParentChildTree`, `filterTree`, `expandedToLevel`, `descendantsOf`) is exported. `useDashboardContext` is exported from `/dashboard`.
  - `ui/Tree`: `expandOn="row" | "chevron"` — `"chevron"` makes a row click select only, so a branch value is selectable in its own right (expanding stays on the chevron and ArrowRight/ArrowLeft).
  - `editor/MarkdownEditor`: inline `word:Word` text (a `${{msr:id:Title}}` placeholder, a ratio, an emoji shortcode) no longer crashes the editor or serializes as `word\:Word` — only the block directive forms (`::leaf`, `:::container`) are parsed; `insertAtCursor` with a one-line fragment now lands inline at the caret instead of as a new block.
  - Registry: new `dashboard-tile-markdown` block — a `DashboardTileKind` rendering GFM markdown (`MarkdownView`) and editing it in a full-screen rail + `MarkdownEditor` + live-preview dialog with `${{variables.x}}`, `${{selection.Field}}`, `${{selection.count('Field')}}`, `${{=expression}}` and `${{msr:ID:Title}}`/`${{dim:ID:Title}}` placeholders resolved locally or through `host.markdown.evaluate`; `dashboard-sheet-app` registers it as its `text` tile.

- 3ac9678: Gantt: a real zoom model and the schedule-insight layers the leading Gantt products ship.
  - Zoom: `actions.zoomTo / zoomBy / zoomToFit / scrollToDate`, `meta.zoom`; toolbar Zoom out · Zoom in · Fit to width · Today. Every zoom step and scale-preset switch is anchored (the date at the pane centre, or under the pointer for Ctrl/⌘ + wheel, stays put) and animated — bars, milestones, baselines, gaps, markers, time ranges and timescale cells morph to their new place (off under reduced motion, never during a drag). Uncontrolled density can always zoom; controlled density needs `onPixelsPerDayChange`.
  - `showCriticalPath` (CPM over finish-to-start links; solid destructive ring + "on the critical path" in the name; solid critical links), `progressLine` (status date or `true`; bends to each task's reached point), `timeRanges` (labelled spans behind the bars), `rollups` (child marks on collapsed summaries), and a scroll-to-task button when the selected bar is off-screen.
  - Sticky inside labels while a bar's start is scrolled out; day/week/month tick labels drop to their short form in narrow cells.
  - `gantt-schedule.ts` exports `computeCriticalPath` / `progressPointAt`.

### Patch Changes

- 71aa69e: Gantt: switching the scale (Day / Week / Month / Quarter) now switches the density too. A `defaultPixelsPerDay` seed or an earlier wheel-zoom no longer pins the bars while only the header relabels — uncontrolled density drops back to the new scale's preset, controlled density receives it through `onPixelsPerDayChange`. The preset is floored at "the whole domain fits the timeline pane" (the pane is measured), so a coarse scale fills the width instead of a 600 px strip, and the first header cell of a scale that starts before the domain is clamped into view (its label was off-canvas). `ui` exports `mergeRefs`.
- Updated dependencies [04be140]
- Updated dependencies [71aa69e]
- Updated dependencies [3ac9678]
  - @elabs-ai/components-ui@5.2.0
  - @elabs-ai/components-tokens@5.2.0

## 5.1.0

### Patch Changes

- a9613ea: First-user journey, wave 1 (from the 2026-09-21 new-user test).
  - **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
  - **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
  - **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
  - **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.

- 2be575f: Hairline rails become corner marks, and a new striped header ground.
  - **tokens** — `hairline-rails` now inks its rails and seam rules only near the corners where they cross (`--hairline-rail-reach`, default `7rem`) and fades to nothing in between and toward the viewport edge; `hairline-rails-full` restores the whole lines. New `bg-hairline-stripes`: diagonal stripes that stream out of one corner (`--hairline-stripe-origin`, top-right by default) and thin as they fade — heavy at the corner, a hairline by the end of their reach — as the structured ground of a hero or header band (`--hairline-stripe-ink | -pitch | -weight | -angle | -reach`).
  - **charts** — `LiveLine` pins its live dot, guide line and value badge to the plot. While the smoothed y-domain had not caught up (first frames, or paused off-screen) the badge could paint thousands of pixels above its chart.

- Updated dependencies [2be575f]
- Updated dependencies [a9613ea]
- Updated dependencies [2be575f]
- Updated dependencies [b45250c]
  - @elabs-ai/components-ui@5.1.0
  - @elabs-ai/components-tokens@5.1.0

## 5.0.0

### Major Changes

- c1e6226: **BREAKING.** Two exports deprecated in the 4.x line are gone, on the schedule `docs/DEPRECATION.md` sets: deprecate in a minor, remove in the next major.
  1. **`YAxis`'s `formatLargeNumbers` prop is removed.** Use `valueFormat`, which knows about millions as well as thousands — the old boolean rendered 1 500 000 as `1500k`. `formatLargeNumbers={false}` becomes `valueFormat="number"` (every digit). `formatLargeNumbers` or `formatLargeNumbers={true}` is simply deleted: compact formatting is the default, so `1.5M` is what you already get.
  2. **`@elabs-ai/components-ai`'s `Toolbar` and `ToolbarProps` are removed.** They were aliases of `NodeToolbar` / `NodeToolbarProps`, renamed because `Toolbar` is the WAI-ARIA toolbar in `@elabs-ai/components-ui` and two different components under one name in one import line is a trap. Rename the import; nothing else changes.

  Both are type-level or prop-level, so TypeScript points at every call site. Nothing in this release is deprecated AND removed: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart`, and the numeric `scale` on `ChoroplethChart`, are deprecated here and stay working until the next major.

  The **shadcn registry** also moves: it is served by the website at `https://elabs-ai.com/r/<item>.json` (and identically on `https://elabs-components.vercel.app`). The `gh-pages` copy under `/r/<version>/` and `/r/latest/` is gone — it was never reachable, so no working URL changes, but a `components.json` that registered the old base needs the new one.

### Minor Changes

- 3951d51: A2UI — the generative-UI path — ships. `@elabs-ai/components-ai` gains `<A2uiSurface>`: an agent describes a screen as JSON (`{ "a2ui": "1", "root": node }` of catalog types), the surface validates it against the catalog and renders it with the real components; `on.<event>` bindings reach the host's `onAction`, streaming prefixes build up node by node, and a settled invalid surface reports every problem with its path. The shipped catalog (`uiCatalog`, 62 ui types + `Stack`/`Grid`) is generated from the manifest; apps extend it with `createA2uiCatalog`/`defineA2uiType`. `@elabs-ai/components-charts` exports its half (`CHARTS_A2UI_BINDINGS`, `CHARTS_A2UI_CATALOG_SCHEMA`: `AutoChart`, `ChartCard`, `MetricGrid`, `Sparkline`, `BulletChart`, `Gauge`). The CLI adds `brand-ui a2ui catalog | schema | validate | example`, the MCP server the `a2ui` tool, and the JSON Schema is published as `@elabs-ai/components-ai/a2ui/schema.json`. `CardHeader` now lays a `CardAction` out top-right (it rendered below the description before).
- 5646c7f: Components for agent-operations surfaces. `@elabs-ai/components-ui` gains `Meter` — a word-sized read-only quantity with the ARIA `meter` role (not a `progressbar`): `foreground` ink by default, the status tones for a quantity that is a verdict, `size` xs/sm/md, a `marker` reference tick (same construction as `Progress.marker`) and `segments` for a countable "4 of 5" strip. `Descriptions` takes `labelWidth` (`"1/3"` default, `"1/4"`, `"1/5"`). `@elabs-ai/components-tokens` adds three additive type rungs — `kpi-sm` (24px tile values, pair with `tabular-nums`), `eyebrow` (meta size, 500, +0.06em; pair with `uppercase`) and `display-lg` (48px hero/deck headline) — exposed as `text-<role>` utilities, `Text variant="kpi-sm" | "eyebrow"` and `Heading size="display-lg"`; `SectionHeader`'s eyebrow slot now reads the `eyebrow` rung (tracking +0.025em → +0.06em). `@elabs-ai/components-charts` gains `ReferenceLine`, a labelled horizontal threshold that composes inside `LineChart`/`AreaChart`/`ComposedChart` on the series' own y-scale (dashed `--chart-foreground`, haloed label, outside the reveal clip like `Grid`; a value outside the y-domain draws nothing rather than stretching it). The registry adds an `agent-ops` category: `agent-ops-parts` plus twelve copy-own blocks (provenance KPI strip, insight feed, provenance record, score explanation, spend against limit, escalation boundary, decision record, audit log, agent trace waterfall, finding cards, verdict side by side, handoff inspector), four of which are also published as A2UI agent-designed surfaces.
- 6e6ae19: HeatmapChart: the empty state now renders inside the chart's plot box (no layout jump when data arrives) with a title, message and optional `emptyAction`; a measured zero and a missing value draw different marks with separate legend keys; in-cell value labels pick their ink from the step they sit on instead of one fixed ink.
- ca1a674: `BarChart`, `LineChart` and `AreaChart` all take `revealOn="inView"` and `replayOnClick`, with the
  same types and defaults: all three read one shared reveal gate, so a below-the-fold chart can hold
  its enter reveal until it is scrolled into view without reaching for `ChartRevealClip` directly.
  Before this, a held reveal settled off-screen once the animation duration had passed, so a visitor
  scrolling down found the chart already drawn. `replayOnClick` also replays a reveal that has
  already settled. Reduced motion never holds a chart back. `stagger()` now reads the live
  `--t-chart-stagger-dot` token instead of a hardcoded constant when no explicit step is given.
- 51f8113: New subpath: `@elabs-ai/components-charts/dashboard` (+ `/dashboard/test`, `/dashboard/schema.json`) — the dashboard SHEET surface: a spec-driven, drag-and-drop grid of tiles with selection, edit mode, an interaction graph and bookmarks. `DashboardProvider`/`DashboardSheet`/`DashboardTile` render a `DashboardSpec`; built-in tile kinds cover `kpi`/`metric`, `chart`, `filter`, `text`, `heading`, `image`, `button`, `divider`, `container` and `variable` (`builtInTiles`); `DashboardToolbar`, `DashboardSelectionBar`, `DashboardAssetPanel` and `DashboardPropertiesPanel` are the chrome; `DashboardInteractionsEditor` configures the emitter → consumer graph (`resolveInteractions`, `fromTileId` routing); `createLocalSelectionDriver`/`SelectionDriver` is the swappable selection engine for embedding in a larger BI host (worked examples: `dashboard/examples/engine-driver`, `dashboard/examples/qlik-object-tile`); `autoLayout` and `core/schema.ts` (JSON Schema at the `/dashboard/schema.json` export) round out authoring and validating a spec outside React. `@elabs-ai/components-charts/dashboard/test` is the engine-free test double.

  Three cross-package tile kinds ship as copy-own registry blocks, not package imports (`dashboard-reuse` keeps `data`/`ai`/`process` out of the subpath itself): `dashboard-tile-table` (`DataTable`), `dashboard-tile-chat` (`ChatShell`), `dashboard-tile-process-map` (`ProcessMap`), plus `dashboard-sheet-app` — the full template (nav shell + toolbar + selection bar + panels + sheet) as an installable block.

  `@elabs-ai/components-charts` (main barrel, used outside the sheet too): `ChartFrame`'s `chrome` prop (`"tile" | "bare"`), the shared `ChartInteractions` shape (`passive`/`active`/`select`/`edit`) and `ChartDensity` tiers, `hoverCategory` on the chart hover-link, and `MetricCard`'s `size` (`sm`/`md`/`lg`) and `sparkline` props (sized for a dashboard tile, useful anywhere a `MetricCard` renders small).

  `@elabs-ai/components-ui`: `FormSpec.sections` — grouped sections in a schema-driven form, used by every dashboard tile kind's `configForm` and reusable anywhere a `SchemaForm` renders.

  `@elabs-ai/components-cli`: `brand-ui dashboard-spec schema|validate|kinds|layout` — inspect the JSON Schema, validate a spec file, list registered tile kinds, or run the auto-layout engine from the command line, without a React runtime.

- b5bdea7: Charts: every chart now measures its own container and adapts at two widths — `narrow` below 480 px and `medium` below 768 px, else `wide` — published as `data-chart-breakpoint` and readable with `useChartBreakpoint()`. At `narrow` a chart takes the `sm` density (legend and value axis hidden, at most four ticks) unless the host passes `density={{ base, narrow }}` or an explicit legend/axis. New `plotHeight` prop on every container, `ChartFrame` and `AutoChart` sizes the drawing area only (a number, `{ aspect }`, or per-breakpoint `{ base, medium?, narrow? }`); the title, legend, notes and source row stack around it. New exports: `Responsive<T>`, `resolveResponsive`, `useResponsiveValue`, `useChartBreakpoint`, `breakpointForWidth`, `CHART_BREAKPOINTS`, `CHART_BREAKPOINT_THRESHOLDS`, `DEFAULT_CHART_PLOT_HEIGHT`.

  Migration: framed charts now grow with width (an 800 px wide `ChartFrame` draws a ~400 px plot instead of a fixed 260 px body); pass `plotHeight={260}` to keep the old look. Dashboard tiles (`chrome="tile"`) are unchanged.

  Deprecated: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart` — use `plotHeight`. It still works as an alias, logs one development warning per page, and is removed in the next major.

- 819d41e: Axis engine. `YAxis` takes `domain` (`[lower, upper]`, either end `"auto"`), `scale` (`"linear" | "log" | "sqrt"`), `ticks`, `tickCount`, `title`, `titlePlacement` and `labelPlacement` (`"inside" | "outside"`). `XAxis` takes `tickCount`, `ticks`, `title`, `titlePlacement`, `orientation="top"`, and on a numeric x (`ScatterChart`) `domain` and `scale`. `Grid` takes `mode="lines" | "ticks" | "off"`, and `BarXAxis` takes `fit="wrap"`. `ChartSpec` gains `axes: { x?, y?, y2? }`, which `AutoChart` forwards to those props (`y2` is accepted but not used yet). Honesty rules still win: bars (and a `ComposedChart` with bars) keep a zero-based linear value axis, so a raised lower bound or a log scale on bars falls back with a dev warning, and a log scale falls back to linear when the data touches 0.

  Visible default changes, with no props set: the x axis paints about one tick per 90 px of plot width (2 to 10, and never more than there are data rows on a time axis) instead of a fixed 5, so a 900 px chart shows about 9 ticks and a 380 px chart about 3; the y axis paints 3 ticks when the plot is under 200 px tall (5 otherwise); y tick labels share one notation across the whole set (no `900` beside `1K`); and long bar category labels wrap onto two lines before they tilt. Pass `numTicks` to pin the old counts, or `BarXAxis fit="tilt"` for the old bar cascade.

- 8a807dc: Chart and metric value formatting now accepts an object spec, not just the 4 preset strings: `valueFormat={{ decimals: 1, abbreviate: true, sign: "always", suffix: "%" }}` works anywhere a `ChartValueFormat` was accepted before (`YAxis`, `ChartLegend`, `AutoChart`'s `ChartSpec`, tooltip values) and on `MetricCard`'s `valueFormat` in `@elabs-ai/components-ui`. The 4 preset strings (`"number" | "compact" | "currency" | "percent"`) are unchanged and render byte-identically.

  `YAxis` gains `unit`/`unitOn` to paint a unit suffix on one, or every, tick.

  `XAxis` date labels now pick their granularity from the series' own time span and tick count (year down to minute) instead of always rendering the same "Mon d" shape — a 36-hour series now reads hours, a decade-long one reads years. This is a visible default change for any chart with a very short or very long time domain; pass the new `dateFormat` prop (or `ChartSpec.dateFormat`) to pin a specific rung.

- 3429c5c: Charts: a label engine. **Visible default change:** in a `LineChart`, `AreaChart` or `ComposedChart` with two or more `Line`/`Area` series, each series that has a real display name (a `name` that is set and differs from its `dataKey`) now names itself at the end of its line, and the plot gives up the right margin the longest name needs. A single-series chart, and a series known only by its column name, look exactly as before. When a `ChartLegend` is composed into the chart, the names move into a key row above the plot below 480 px; names that would take more than a third of the plot move there at any width. The name is painted in a contrast-safe mix of the series colour (`color-mix(in oklab, <stroke> 41%, var(--chart-label))`, at least 4.5:1 on the chart background for every built-in series in light and dark); the leader line keeps the pure series colour. Stacked area charts (`offset`) are unchanged. An `AutoChart` line/area spec hides its legend only when every series gets an end label this way; otherwise the legend stays. To keep the previous look, set `seriesLabel="none"` on the series (or `labels: { series: "none" }` in an `AutoChart` spec); an explicit `seriesLabel` always wins, so `seriesLabel="end"` labels a single series too.

  New: `seriesLabel` (`"end"` | `"key"` | `"none"`, or a responsive value) and `valueLabels` (`{ placement: "first" | "last" | "all" | "peaks", count?, format?, … }`) on `Line`/`Area`; `labels` on `Scatter` (point labels culled by chart width); a `showValues` object on `Bar` (`{ placement: "inside" | "outside" | "auto", visibility: "always" | "hover" }`); `ChartSpec.labels` and its `ChartLabelsSpec` type; `layoutLabels`, the collision solver. A label the solver cannot place is restated in a screen-reader-only span beside the chart. A chart with an `accessibleLabel` and no `accessibleDescription` now gets a generated description (`describeSeries`), e.g. "Line chart, 4 series over 2017–2025; E-bikes peaks at +214 % in 2023".

- c068bf4: Charts take declarative annotations. `LineChart`, `AreaChart`, `BarChart`, `ComposedChart`, `DumbbellChart` and `WaterfallChart` accept `annotations`, and `ChartSpec` accepts `annotations` too, so `AutoChart` renders them for line, area, stream, bar, dumbbell and waterfall specs. There are four kinds, all placed in data units: `text` notes (with a 9-point anchor, a width as a % of the plot, a connector with an optional arrow head, series-coloured ink and `showAt`), `range` highlights on either axis (solid or striped), `line` reference lines (solid, dashed or dotted), and `row` notes that stay with their category on horizontal bars and dumbbell rows, whatever the sort. Ranges paint under the series in the pale band ink (`--chart-ring-background`), and the rest paint over them. Series-coloured note text is mixed toward the label ink with the shared `seriesLabelInk` helper so it stays at 4.5:1 or better, while connectors and marker rings keep the pure series stroke. At the `narrow` tier each note becomes a numbered marker, and a new `AnnotationKey` lists the notes under the plot. Every annotation is restated once in the chart's accessible description. The pieces are exported for composition: `ChartAnnotations` (as a child of a cartesian container, including `ScatterChart`), `AnnotationKey`, `withAnnotationDescription` and `resolveAnnotationPosition`. `Leader` gains `arrow`. `Marginalia` makes `anchor` optional and gains `arrow`, `noteFill`, `leaderStroke` and inline `**bold**`. `Grid`'s `highlightRowValues`/`highlightColumnValues` now draw through the same line renderer, and their output is unchanged.
- f838188: `Line` and `Area` (and their `LineChart`/`AreaChart` containers) gain the line/area richness a publication-grade chart toolkit is expected to have.

  **Breaking visual defaults:**
  - `nulls` (new, on `LineChart`/`AreaChart` and per-`Line`/`Area`) defaults to `"gap"` — a `null`/non-numeric value now breaks the path instead of silently drawing as pixel `0`. Set `nulls="zero"` to keep the old behaviour, or `nulls="connect"` to draw a straight segment across the gap.
  - `Line`'s default `curve` changes from `curveNatural` to `curveMonotoneX` (`"monotone"`) — the established guidance for publication charts is that natural/cardinal splines overshoot past the data; monotone never does. Pass `curve={curveNatural}` (or `curve="natural"`) to keep the old look.

  **Added:**
  - `curve` on `Line`/`Area`/`AreaBand` accepts string aliases (`"linear" | "monotone" | "natural" | "step" | "step-before" | "step-after"`) alongside a `@visx/curve` factory.
  - `Line outline?: boolean | number` paints a `--chart-background` halo under the stroke so crossing lines stay legible.
  - `symbols?: { placement, shape, style, size }` on `Line`/`Area` wraps the existing marker system with the standard point-symbol vocabulary (all points / line ends / first / last, filled or hollow).
  - `focusOnHover?: boolean` on `LineChart`/`AreaChart`: hovering (or tapping, on touch) a series dims every other series to the shared selection-excluded opacity.
  - `AreaBand` gains `from="zero"` (bracket a single series against the value-axis zero line — `lowKey` becomes optional) and `negativeFill` (a second colour for any segment where the high edge dips below the low edge).

- ecabd9b: `BarChart` gains the full bar/column vocabulary: `stacked="percent"` (each category normalised to 100 %, a format-less `YAxis` prints percent) and `stacked="diverging"` with `divergingCenter` for Likert rows; `stackOrder` and `showTotals`; `sort` / `reverse`; `groupBy` with group headers and separators; `colorBy` (categorical, sequential or diverging, with a colour key); `track` background bars; value and range `overlays`; and `comparison` columns with `comparisonLabel`. `Bar showValues` keeps the one label spec from the label engine (`{ placement, visibility }`); in a percent, diverging, ordered or totalled stack each segment centres its label, and a percent segment prints its share. The chart context exposes `legendItems` (series, colour key, comparison, overlays). `ChartSpec` gains the `stacked` union plus `divergingCenter`, `sort`, `groupBy`, `colorBy`, `overlays` and `comparison`, `ChartLabelsSpec` gains `comparison` (the grey label mode), and AutoChart infers `diverging-bar` for a Likert spec with a named middle series.

  Deprecated: nothing. No existing default changes — a chart that sets none of the new props renders as before.

- 5c6c306: `PieChart` gains slice labels, automatic small-slice grouping, sort order and a half-donut preset. `labels={{ placement: "inside" | "outside" | "none", show: ("label"|"value"|"percent")[], matchColor?, minAngle? }}` draws inside labels centred on each wedge (hidden under `minAngle`, default `0.2` radians) or outside labels on a ring with leader lines, decluttered so same-side labels never overlap; `placement` is `Responsive`, defaulting to `{ base: "outside", narrow: "none" }`. `groupSmall={{ threshold?, max?, label? }}` folds the smallest slices into one "Other" slice (never folding every slice away); PieChart auto-renders its slices instead of the caller's manually-supplied `PieSlice` children only when `groupSmall` is set. `pieLegendItems(data, options)` (new export from `pie-grouping.ts`) mirrors the same fold for a paired `ChartLegend`. `sort="desc" | "none"` controls wedge angle order (never the `<PieSlice index>` datum, per d3-shape); default stays `"none"` so every existing pie/donut renders byte-identical. `half` renders a 180° arc (top half, data order) with the centre value slot moved below the arc, matching an election-donut layout. `RingChart`'s `labels` prop accepts `{ placement: "outside" }` as an alias of its existing `"outside"` string, for API parity only — every other `labels` field is a no-op on `RingChart`. `ChartSpec` gains `labels`/`groupSmall`/`sort`/`half` for `type: "pie"`, forwarded by `AutoChart`.
- 164f0e2: Scatter depth. `Scatter` gains `sizeKey`/`sizeRange` (bubble radius scaled by `sqrt(value / max)`, never linearly, so area encodes the value rather than the radius), `colorBy` (fixed/categorical/sequential/diverging column colouring, capped at six categories with a neutral-ladder fallback) and `shapeBy` (a categorical column cycled through up to six marker shapes), plus a `trend` prop (`"linear"` or `"log"` least-squares fit, drawn as a dashed line, with its direction and r² exposed as `data-trend`/`data-r2`). A new `CustomShapes` component draws constant reference lines (`{ kind: "line", y }` / `{ kind: "line", x }`) or multi-point lines/areas (`{ kind: "path", points }`) in data space, behind the marks. `ChartSpec` (`AutoChart`) gains matching `size`, `colorBy`, `shapeBy`, `trend` and `shapes` fields for the `"scatter"` type. `resolveColorBy`/`resolveShapeBy` are exported so a consumer can build a size, colour or shape legend from the same config.
- 7aeed5b: `DumbbellChart` gains two variants and the sort, group and delta controls an arrow plot and a dot plot need. `variant="arrow"` draws a single connector with an arrow head at `endKey`, sign-coloured via `--chart-div-pos-2`/`--chart-div-neg-2` and readable in greyscale (the head direction is the non-colour channel); `arrowWidth?` tunes the head. `variant="dots"` plots N `valueKeys` per row as dots with an optional connecting `range` bar and a colour-key legend. `sortBy` grows `"start" | "end" | "delta" | "deltaPercent" | "data" | "label"` (plus `reverse?`), `groupBy?` buckets rows under group headers with separators, and a new `delta?: { show, mode: "absolute" | "percent", format? }` config supersedes `showDelta`/`deltaLabelFormat`; a new `valueAxis?: { position, range }` supersedes `showValueAxis`. `AutoChart`/`ChartSpec` gain a matching `variant`/`sort`/`groupBy`/`delta` surface and a `kind: "change"` hint that infers `variant="arrow"` for a two-measure before/after spec. Every new prop is opt-in — an unset chart renders byte-identical to before.

  Deprecated: `showDelta` and `deltaLabelFormat` are superseded by `delta={{ show, mode }}`; `showValueAxis` is superseded by `valueAxis`. The old props still work unchanged — migrate at your own pace.

- 14374e6: `ChartFrame` now carries the editorial chrome a published chart needs, and its image export is the whole frame, not just the plot.
  - **Notes, byline and a linked source.** `notes` renders an italic line above the footer. `byline={{ kind: "chart" | "map" | "table", author }}` reads "Chart: Author". `source` also accepts `{ name, href }`, rendered as "Source: Name" with a link. With any of these (or `actions`), the footer becomes one row, "Chart: Author • Source: Name • Get the data • Download image", which wraps on a narrow frame without changing the plot height. The footer words come from `footerLabels`, with English defaults. A frame that sets only a plain `source` keeps its current all-caps source row.
  - **Footer actions.** `actions={["data", "svg", "png", <YourLink />]}` adds footer links in the conventional order: data, your own nodes, SVG, then PNG.
  - **`altText`.** Describes the chart for screen readers. A labelled chart takes it as its description ahead of its generated summary; the chart's own `accessibleDescription` still wins. A chart with no figure of its own gets the frame body as a described figure.
  - **`InlineChip`.** Put `<InlineChip series="ram">short-term RAM</InlineChip>` in a `description` and it takes the series' colour from the chart inside the frame, so the prose can stand in for a legend. The swatch is named by `label`, else the chart's series name, else the key. It is exported, with a stand-in in `@elabs-ai/components-charts/test`.
  - **Complete export.** Download SVG/PNG now draws the title, description, axis tick labels, axis titles, legend labels, notes and footer text into the file, at the positions and colours shown on screen. The footer's action links are not drawn. The export is built from measured positions, not a screenshot. `exportOptions={{ scale: 1 | 2 | 3 | 4, plain }}` sets the PNG pixel ratio (default 2; scale 3 gives 3× the frame's CSS width), and `plain` exports the chart body with no header or footer text. `ChartFrameMenuApi.exportSvg` and `exportPng` also accept `{ scale, plain }`. `onExport(kind, blob, filename)` is unchanged.
  - **Dashboard export.** Each chart tile in a dashboard sheet export now includes its tick and legend text. The tile's size and marks are unchanged.
  - **`ChartSpec`** gains `notes`, `byline`, `source` and `altText`. An `AutoChart` inside a `ChartFrame` hands the first three to the frame, and uses `altText` as the chart description when `description` is unset.

  Deprecated: nothing. Visible change: a `ChartFrame` SVG/PNG export used to contain the chart `<svg>` plus an optional source row, and is now frame-sized with the header and footer text. If you need the old plot-only file, use `exportOptions={{ plain: true }}`; `plain` still includes axis and legend text.

- 649438d: Legend engine. `ChartLegend` gains toggle interactivity — `hiddenKeys`/`onToggleKey`
  turn each item into a real `<button aria-pressed>` (dimmed with both opacity and a line-through,
  never colour alone), and a new `hideAtDensity` prop lets a caller opt an instance out of the
  density `sm` legend-hiding default without touching it for direct `ChartLegend` callers. Two new
  ramp keys land: `RampLegend` (continuous/stepped `--chart-seq-*`/`--chart-div-*` ramps, ruler/
  range/custom labels, an optional hover marker, horizontal or vertical) and `SizeLegend` (sqrt-
  scaled sample circles for a bubble radius scale). `useContainerLegend` is the new hook a container
  mounts to read `legend` (`boolean | { position, layout, interactive, values, title }`) and place a
  `ChartLegend` in the measured box next to the plot. `HeatmapChart`'s stepped key
  (`HeatmapLegend`) gains `hover` (moves a marker to that value's position, sharing `RampLegend`'s
  positioning math) and `labelMode: "ranges"` (one from–to label per swatch instead of the lo/hi
  bookends) — both additive and off by default. `ChartSpec.legend` widens to also accept the
  `useContainerLegend` config object (containers that wire the hook read it; `AutoChart` still
  reads only the boolean form for now).

  `BarChart` mounts the engine with full toggle interactivity (`legend`, hiding a series on click).
  `PieChart`, `ScatterChart`, `TreemapChart` and `DumbbellChart` mount it too, capped at hover-only
  (`maxInteractive: "hover"`) — a legend row highlights on hover/focus but never hides anything,
  since none of these families has a per-item show/hide. `ScatterChart` lists a `colorBy`-resolved
  colour key in place of the plain per-series rows when one is set. `TreemapChart` lists one row per
  top-level group for `palette="categorical"` (real hover-dim on the group's tiles) and renders
  `RampLegend` instead for `palette="sequential"` (nothing for `"mono"`). `DumbbellChart` lists one
  row per `valueKeys` entry for `variant="dots"` (real hover-dim on that key's dots across every
  row), replacing its own pre-existing, always-on corner colour-key badge when `legend` is set (that
  badge is unchanged when `legend` stays unset). `AutoChart` forwards `spec.legend` to `bar`, `pie`,
  `scatter` and `treemap`, retiring its own `AutoLegend` fallback for those four.

  **Visible default change — the `AutoChart` legend look for `bar`, `pie`, `scatter` and
  `treemap`.** Before: a wrapping `<ul>` BELOW the plot, outside the box the chart measured,
  with 10 px square swatches in muted ink. After: a `ChartLegend` INSIDE the measured box and
  ABOVE the plot, with round dot markers, wrapped in a row at `wide`/`medium` and stacked at
  `narrow` — and hidden entirely at `narrow` or density `sm`, where the old list stayed
  visible. Which series are listed, their order, their colours and the legend's accessible
  name ("Chart legend") are unchanged. No flag restores the old list: a spec that wants the
  legend gone sets `legend: false`, and a spec that wants the old below-the-plot placement, or
  a legend that survives the `narrow` tier, drops the spec's `legend` and composes
  `<ChartLegend layout="row" hideAtDensity={[]}>` under the chart itself. `dumbbell` stays on
  `AutoLegend`: `ChartSpec` has no `valueKeys`/`variant` field, so `DumbbellChart`'s own `legend`
  (dots-only) would render nothing for any AutoChart-driven spec today — wiring it in would have
  silently dropped the existing before/after key on every multi-series AutoChart dumbbell.
  `AutoLegend` itself stays for the rest, since `radar`/`funnel`/`waterfall`, `dumbbell` and the
  other families outside this wave can still reach it through a multi-series spec.

  **Small multiples.** A faceted `AutoChart` spec (`ChartSpec.facet`) of type `bar` or `pie`
  whose legend is shown now gets ONE shared `ChartLegend` above the grid — never one legend per
  panel, which is what faceted `line`/`area` already did. A faceted pie's shared legend lists the
  slice categories, deduped across panels: the same items the old legend listed.

- 6d94753: `ChartTooltip` gains three presets: `variant="rows"` (default, today's stacked box, unchanged), `"table"` (`ChartTooltipTable` — one column per series with a header row, the hovered date/category in the `<caption>`), and `"inline"` (`ChartTooltipInline` — the hovered/nearest series' value painted directly at the mark with `HaloText`, no box). `focus` drives the per-series dim from the tooltip's own nearest-series resolution instead of only a direct hover on a series' own stroke, and works standalone — `<ChartTooltip focus />` alone registers the request on the shared series-mode context, no `focusOnHover` needed on the `LineChart`/`AreaChart` container (a container `focusOnHover` still works exactly as before and composes with it). `pin` (default: on when the pointer is coarse) keeps a touch-tapped tooltip open until a second tap on the mark, `Esc`, or a tap outside the chart releases it; a release is announced once via `role="status" aria-live="polite"`. `valueInTitle` suppresses the box's own title so a `ChartFrame`/facet-panel integration can show the hovered value in its own title instead (the `ChartFrame` side of that integration is not in this change). `ChartSpec.tooltip` (`{ variant, focus, pin }`) forwards to `AutoChart`'s own `<ChartTooltip>`.

  Deprecated: none. Migration: no action needed — every new prop defaults to today's behaviour (`variant="rows"`, `focus`/`pin`/`valueInTitle` unset), so an existing `<ChartTooltip>` or `ChartSpec` renders byte-identical.

- a24a038: Add `ChartMultiples` (small multiples): one chart per facet value (`by` column, `{ series: true }` or explicit `panels`) in a responsive grid, with shared or range-rounded independent y scales, panel sort (start / end / delta / % change / range / title), a muted repeated baseline, synced hover with the hovered value in each panel title (Line, Area and Composed panels), and per-breakpoint panel visibility (`showAt`). `ChartSpec.facet` renders the same grid through `AutoChart` (split bars: `facet.by = { series: true }`; multiple pies: `facet.by = "region"`), and a line spec with six or more series logs a dev hint suggesting `facet`. Nothing is deprecated; charts outside a `ChartMultiples` panel render unchanged.
- a2aff19: Dual-axis `ComposedChart`. New `yAxes={{ align, proportional, zero }}` prop: `align: "ticks"` (the default once `yAxes` is set) gives both value axes the same tick count on the same pixel rows and draws the grid on those rows; `proportional` makes both scales grow by the same factor from one shared origin; `zero: "both" | "auto"` applies the "both or neither" baseline rule. Columns and areas stay zero-based whatever is asked. `YAxis` gains `matchSeriesColor` (tick labels and title in the axis' series colour when it carries exactly one series) and `sideLabel` (`"auto"` reads "Left scale" / "Right scale" from the new `charts.axis.leftScale` / `charts.axis.rightScale` messages in `@elabs-ai/components-ui`). The container legend gains `layout: "split"`, one row per axis led by its side label (side by side at medium and wide widths, stacked at narrow), and `ChartTooltip variant="table"` groups its columns under the same side headers. `ComposedChart stacked="percent"` stacks each x's columns to 100 %, pins the primary `YAxis` to 0–100 % and prints percent unless the axis sets its own format; the tooltip keeps the raw values.

  No default changes: a `ComposedChart` without `yAxes`, `stacked="percent"` or the new `YAxis` props renders as before.

- 5be893d: `WaterfallChart` gains full support for real financial-bridge data: `dataFormat="runningTotals"` reads every row as the running total instead of a signed delta; `subtotalBy` auto-inserts a subtotal checkpoint after each run of rows sharing a group field; `sort="increasesFirst" | "decreasesFirst"` reorders steps within each checkpoint-bounded group; `start`/`end` relabel or drop the chart's own first/last row; `zoomToDifferences` drops the zero baseline when a checkpoint sits far above the steps' own swing, rendering `"total"`/`"subtotal"` rows as points on a dashed stem instead of zero-based bars (a bar's length must be zero-based — a checkpoint's absolute value, once zero is off-screen, can only honestly be a position); `connectors="thick"` weights the hand-off hairlines; and `labels` replaces the `showValues` default with per-row control over which rows are labelled and whether a step's own label reads as an absolute value or a signed percent of the running total it left off. `AutoChart`'s `waterfall` spec gains matching `dataFormat`, `subtotalBy`, `sort` and `zoomToDifferences` fields. Every new prop defaults to the chart's pre-existing behaviour — published stories are unaffected.
- 87e58d7: New `colorScaleFor(values, spec)` in `@elabs-ai/components-ui`: one pure value → colour decision for thematic encodings, shared by charts, data tables and maps. Continuous scales place the ramp by `linear`, `median`, `quartiles`, `quintiles`, `deciles` or `natural` (Jenks) stops; stepped scales cut classes by `equidistant`, `rounded`, `quantile`, `jenks` or `custom` breaks. A `[min, center, max]` domain pins the ramp's middle colour; `palette` picks `sequential`, `diverging` or `categorical`. Every colour it returns is a `var(--chart-…)` token reference, so fills follow the active theme. The result lists its classes (`steps`), gradient stops and categories for a legend, and answers `colorOf`, `indexOf` and `positionOf` for any value. Nothing existing changes.

  `ChoroplethChart` becomes a thematic map. A colour `scale` (`{ key?, type, method?, steps?, domain?, palette? }`, resolved by `colorScaleFor`) fills each region from the theme's ramps; `getFeatureColor` still wins when given. `legend` draws the matching `RampLegend` (or category swatches), titled, with `ruler`, `ranges` or `custom` labels, in a plot corner at wide and medium and below the map at narrow; its marker follows the hovered or focused region. `fitToData` frames the regions that carry data (`hideNoData` removes the rest), `inset` adds a locator map, `labels` places up to 30 region names through the label solver (none at narrow), `overlayBy` stripes regions by a category, `symbols` draws proportional symbols (area encodes the value; they shrink on plots narrower than 700 px) with a size key, `zoomControls` adds real zoom-in / zoom-out / reset buttons, and `annotations` pins text notes by longitude / latitude (a numbered key at narrow). With `hideNoData` and no data left, the chart shows an empty state. A chart that sets none of these renders exactly as before.

  `AutoChart` gains `type: "choropleth"`: a spec names its map with `geo` (a GeoJSON FeatureCollection, or the bundled `"world"` / `"us-states"`), joins its rows to regions with `match` (`row` defaults to `x`, `feature` to the region id), colours them with `scale`, names them with `labels.places` and sizes proportional symbols with `symbols`. The type is explicit only — no data shape is ever inferred as a map — and a spec with no `geo` renders the unsupported fallback. A bundled map is fetched only when a spec asks for one, so specs that draw other charts carry none of it.

  Deprecated: `ChoroplethChart`'s numeric `scale` (the projection zoom) — use `projectionScale`. `scale` now takes a colour-scale object; a number keeps working as the projection scale until the next major.

  Migration: replace `scale={560}` with `projectionScale={560}`; nothing else changes.

- 6565b53: Chart selection now follows the editorial rules it documents, and the River recipes ship as stories.

  `AutoChart`'s type inference changed in two ways when you omit `type`:
  - **A pie is capped at five wedges**, counted after `groupSmall` folds its "Other" slice. A share table with six or more categories and no `groupSmall` now infers `bar` instead of `pie`. Migration: if you want the pie back, either pass `type: "pie"` explicitly (an explicit type always wins and is never capped) or add `groupSmall: { max: 4 }`, which folds the tail and reads as a pie again.
  - **`area` is now inferred**, but only for two or more temporal series that compose one total — either `stacked: "percent"`, or values that sum to ~100 on every row. Everything else stays `line`. Migration: none for a single series or for series that do not add up; a percent-stacked temporal spec that used to draw as a line now draws as an area, which is the honest reading. Pass `type: "line"` to keep the old picture.

  No published story's inferred type changes.

  Also: `brand-ui chart-for "many overlapping lines over time"` now returns `ChartMultiples` first and `"two measures per category with a direction"` returns `DumbbellChart` first; every `ChartSpec` field added in the chart-parity waves carries a "when to use" paragraph; and five River recipes ship as stories under `Charts/Recipes/River`.

  Deprecated: nothing.

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).
- c3a8948: `TreemapChart` gains `showValues` (default `false`): each labelled tile prints its formatted value under its name when it is tall and wide enough for the whole number, with one notation shared across the tiles — fixes #247. `ChartSpec` gains `palette` (`"mono"` | `"sequential"` | `"categorical"`, default `"mono"`) so a spec-driven `AutoChart` treemap can colour leaves by value or by group; an unknown value renders mono, and the `/test` double rejects an unknown palette or a palette on a non-treemap spec. New exports: `ChartSpecPalette`, `CHART_SPEC_PALETTES`, `isChartSpecPalette` — fixes #306.
- fb04bc5: The hairline decoration family: the quiet line-work of a calm product page, as opt-in, token-driven gestures that work in every theme.
  - **tokens** — new `--hairline-*` tokens and utilities: `bg-hairline-hatch` (a faded diagonal hatch well), `hairline-stack` (two sheet edges stacked behind a card), `hairline-slot` (dashed placeholder), `hairline-frame` (dashed rails that run past a box's corners and fade), `hairline-rails` (rails down the content column of a full-bleed section), `hairline-corners` (crop marks), `hairline-ticks-x` / `hairline-ticks-y` (a tick ruler) and `hairline-rule` / `hairline-rule-y` (a dashed separator). Lines take the theme's own `--rule` / `--rule-strong`; the hatch is a translucent tint of `--foreground`. Like the paper grounds they are not on the decoration dial, paint only on inert pseudo-element layers, and never touch a control.
  - **ui** — `CardMedia`, the card's media well (faded hairline hatch by default; `ground="dots" | "none"`, `fade`), and `<Card stacked>`.
  - **charts** — `fillStyle="hatch"` on `Bar` and `SeriesBar` draws a series as an outlined hairline hatch in its own colour at any decoration level (default `"solid"` is unchanged), plus `makeHairlineHatch` / `hairlineHatchId` / `isHatchableFill` and the scale-free `Ruler` mark.
  - **marketing** — `FeatureGrid ruled` rules the grid with dashed hairline dividers (default `false`). The Marketing starter template adopts `hairline-rails`, `hairline-frame` and the ruled grid.

### Patch Changes

- A chart carrying BOTH value labels and annotations no longer renders in a loop. `WaterfallChart`'s label solver treated annotation notes as obstacles while `ChartAnnotations` places its notes around that chart's value labels, so each pass moved the other's boxes and React aborted the tree with "Maximum update depth exceeded". The value labels now place first and the notes place around them, demoting what will not fit — the mechanism annotations already have. Publishing an unchanged set of obstacle boxes also no longer wakes every reader.
- 779c040: Theme seams for brand fidelity. Every addition is opt-in: each new token defaults to today's rendering, so existing themes look the same.

  `@elabs-ai/components-tokens` adds 30 contract tokens, which every `[data-theme]` block now has to define:
  - Sidebar active bar: `--sidebar-indicator`, `--sidebar-indicator-width` (`0` = no bar), `--sidebar-indicator-radius`, `--sidebar-indicator-inset`.
  - App shell: `--shell-secondary-width`.
  - Buttons: `--button-outline-border`, `--secondary-border`, `--secondary-text`.
  - Table header: `--table-header-background`, `--table-header-foreground`, `--table-header-size`, `--table-header-transform`, `--table-header-tracking`.
  - Surfaces: `--card-shadow`, `--card-border`, `--card-title-leading`, `--popover-shadow`, `--dialog-shadow`.
  - Badges: `--badge-radius`, `--badge-appearance` (`auto` | `tint` | `solid` | `outline` | `neutral`).
  - Tabs: `--tabs-variant` (`segmented` | `underline`), `--tabs-indicator-width`, `--tabs-active-weight`.
  - Focus: `--focus-ring-width`, `--focus-ring-offset` (a negative value pulls the ring inside the edge), `--input-focus-border`.
  - Icons: `--icon-fill` (`outline` | `solid`).
  - Selection: `--selection`, `--selection-foreground`, `--selection-muted`.

  It also adds a `heading-xs` type role (`text-heading-xs`, caption size at 600), the utilities these tokens drive (`bg-sidebar-indicator`, `bg-table-header-background`, `text-table-header`, `shadow-card`, `shadow-popover`, `shadow-dialog`, `rounded-badge`, `font-tabs-active`, `border-input-focus`, `bg-selection`, …), and the `badge-*` and `tabs-underline` custom variants. Keyword tokens are read with container style queries. A browser without style queries renders the default.

  `@elabs-ai/components-ui`:
  - `AppShell` gains `brandPlacement` (`"sidebar"` | `"topbar"`), `topBar={{ start, center, end }}`, `navigation` (`"sidebar"` | `"topbar"`) and `secondaryPanel`. `TopNav` gains `center`, which keeps its slot truly centred.
  - `Badge` and `StatusBadge` gain `appearance` (`"tint"` | `"solid"` | `"outline"` | `"neutral"`); the prop is named `appearance`, not `tone`, because `StatusBadge` already has a `tone`. Leave it unset and `--badge-appearance` decides. A custom-tone `StatusBadge` never goes solid.
  - `TabsList` without a `variant` follows `--tabs-variant`, and it no longer renders `data-variant="segmented"` when the prop is unset.
  - Sidebar, buttons, cards, menus, dialogs, form fields, tables and trees now read the tokens above.
  - `cn()` now recognises the `eyebrow`, `kpi-sm`, `display-lg` and `heading-xs` type roles, the new token utilities, and the `leading-(--x)` / `tracking-(--x)` shorthand. Before this, `cn("text-eyebrow", "text-muted-foreground")` silently dropped the role.

  `@elabs-ai/components-icons`: `Icon` gains `variant` (`"outline"` | `"solid"`), and `createIcon(node, name, { solid })` takes an optional filled glyph. Leave `variant` unset and `--icon-fill` picks the glyph. An icon without a solid glyph always draws its outline.

  `@elabs-ai/components-data`: `DataTable` headers read the `--table-header-*` tokens, and selected rows read `--selection`.

  `@elabs-ai/components-ai`, `-charts`, `-editor`, `-marketing`: hand-rolled uppercase labels now use the `eyebrow` role. Their letter spacing moves to the role's `0.06em`.

- f0155e5: Charts: every keyboard datapoint target now has a real accessible name even when no `datapointLabel` is passed. The shared default (localised through `t()`) drops an absent part instead of announcing a dangling `:` (`"Revenue, Jan"`, `"Engineering"`), names a target with no category by position (`"Data point 3"`), formats values with locale grouping (`"Visitors: 12,000"`, previously `"Visitors: 12000"`), formats date categories with the active locale (year included, and time when present), and never repeats a group that is both series and category. A `datapointLabel` that returns an empty string now falls back to the default. `DumbbellChart` targets announce both ends (`"Verify email: 82 to 94"`). New `DEFAULT_MESSAGES` keys: `charts.datapoint.labelNoValue`, `charts.datapoint.labelNoSeriesNoValue`, `charts.datapoint.position`, `charts.datapoint.labelRange`.
- 2dea325: CandlestickChart, ChoroplethChart, TreemapChart, WaterfallChart, DumbbellChart and DistributionChart now join the high-decoration pattern channel: at `--decoration` 8–10 their palette-filled marks (candle bodies, regions, leaf tiles, step bars, filled dumbbell markers, histogram bars / box capsules / violin bodies) draw a series hatch/dot pattern, so marks that differ by hue also differ by texture. Author literal or `url()` fills are left as drawn, and nothing changes at decoration 0–7.
- 12419fb: **`ChartFrame`** no longer keeps an extra keyboard tab stop on a chart that has stopped scrolling. The frame adds a tab stop (with a "Scrollable chart" label) while its content is wider or taller than its box. When the box shrank, the chart redrew itself at the new size a moment later. The frame did not notice, so the tab stop could stay for good. This happened in a dashboard tile when a side panel opened. The frame now watches the chart's own drawing, canvas or table too.
- 7e404da: **Dashboard tiles:** closing **Full screen** now always returns keyboard focus to the tile, even if the full-screen view is closed very quickly. The tile's "More actions" menu restores focus to its own button after its closing animation ends. When the view was closed before that, focus landed on "More actions" instead of the tile. That happened on slow machines and under load. The menu now leaves focus to the full-screen view when you choose Full screen.
- 7804b51: `AreaChart`'s streamgraph bands (`offset`) no longer fade to transparent at their own lower edge — a stacked band's thickness is the value, so both edges now hold the band's `fillOpacity` unless you pass `gradientToOpacity` explicitly. `seams` now actually renders: the paper gap is drawn on top of the band's own crest stroke instead of being painted over by it — fixes #245.
- 80cf5b7: `ChartCard`'s and `ChartFrame`'s `source` row no longer truncates a long string with no way to read the rest: a string `source` now gets a native `title` and, once the row measurably overflows, a keyboard-reachable tooltip. `ChartFrame`'s expand modal now places the source row with the chart (matching the inline card) instead of appended under the summary statistics, and both containers share the same truncate-and-recover behaviour — fixes #184.
- 1163db2: `PieChart`'s `referenceRings` labels no longer collide or sit on top of a slice. Each label now lives on a dotted leader outside the plot, spaced by a fixed minimum instead of the rings' own (compressible) radii — fixes #246.
- 4386ae3: Tokens: add `--chart-ink-on-light` and `--chart-ink-on-dark` (every theme), the anchor inks for text and ticks printed on a filled chart mark.

  Charts: HeatmapChart value labels and the DistributionChart box/violin median tick now pick their ink from the fill they actually sit on, resolved from the rendered theme (semi-transparent bodies composited over the chart ground), so every ramp step clears 4.5:1 in light and dark and in consumer themes. Before the DOM is readable (SSR, first paint) they fall back to a foreground/background estimate.

- ced122c: `XAxis`'s `periodTicks` long tick now lands on a real calendar boundary (the first day of the week for `"day"`, the first week of the month for `"week"`, January for `"month"`) instead of an index stride counted from wherever your data happens to start — so it lines up with a boundary you'd actually recognise no matter what date your series begins on. The long tick also renders in its own higher-contrast ink instead of the grid's faint weight, so it reads as a mark rather than texture.
- 7c3815d: Closure fixes for the chart, table and map parity track.

  **`DataTable` — pinned rows are placed for screen readers.** A virtualised table with
  `stickyRows` mounted its pinned rows outside the virtual window with no `aria-rowindex`,
  and built `aria-rowcount` from the centre row model only. Before: a screen reader heard
  unplaced extra rows and an under-reported total ("row — of 98" beside 100 real rows).
  After: a top-pinned row takes the first index slots, a bottom-pinned row the last, and both
  join the count. No opt-out and none needed — the DOM, the visual order and the spoken order
  now agree. A table without `stickyRows`, or without virtualisation, is unchanged.

  **`DataTable` — row reorder in the card layout says so.** `enableRowReorder` has always been
  table-only: a card list has no grip column and no row to drop onto, so `onRowReorder` never
  fires there. Before: silence. After: one development warning per mount naming the limit, and
  the prop's documentation says it. Production is unchanged. To reorder, keep `layout="table"`,
  or offer the move as a row action in cards.

  **`MapControls` — a static map shows no zoom chrome.** Before: `showZoom` defaulted to `true`
  everywhere, so an editorial map with `interactive={false}` painted zoom buttons that invite a
  gesture the map will not answer. After: `showZoom` defaults to the map's own interactivity —
  zoom on an interactive map, nothing on a static one — and a control cluster with no enabled
  group renders no box at all. Pass `showZoom` explicitly to get either behaviour back; an
  interactive map is unchanged, and no shipped story rendered both.

  **`ChartLegend` — the root is named.** Its root now carries `data-slot="chart-legend"`, so the
  frame's image export roles a bare legend's labels as legend text rather than plain chart
  labels. Classes, layout and accessible name are unchanged.

  **Registry blocks — two infographics now compose the new chart props.** Both are copy-own
  items, so an existing copy is untouched until you re-run `npx shadcn add`.

  `infographic-annotated-trend-01`: before, a `Card` with a hand-drawn `Leader` + `HaloText`
  per event and a fixed 288 px plot. After, a `ChartFrame` (the finding as the title, the
  method note, a byline and the source row, plus flip-to-table and CSV of the same weeks)
  around a `LineChart` whose events are declarative `annotations` — so under 480 px the notes
  become numbered markers with a key under the plot, and every note is restated in the
  figure's description. The value axis is now framed around the series instead of including
  zero, which is what makes the outage week read as a drop rather than a ripple; pass your own
  `domain` to change it.

  `infographic-small-multiples-01`: before, a bespoke grid of inline-SVG mini charts. After, a
  `ChartMultiples` grid — same shared y-axis and same ringed outlier, plus the value in every
  panel title, swapped for the hovered week's reading so one hover reads the same week across
  all twelve panels. Two columns on a phone, packed to the container above that.

  Also: the bundled choropleth world fixture now credits Natural Earth (public domain) and
  `world-atlas` (ISC) in the attribution panel.

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [015b988]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [f024c7a]
- Updated dependencies [4386ae3]
- Updated dependencies [8a807dc]
- Updated dependencies [a2aff19]
- Updated dependencies [87e58d7]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [94f1e0e]
- Updated dependencies [18f063e]
- Updated dependencies [6271b00]
  - @elabs-ai/components-ui@5.0.0
  - @elabs-ai/components-tokens@5.0.0

## 4.2.0

### Minor Changes

- a3a69f7: Security, streaming-performance, form-control and consistency fixes from the 2026-09-15 review.

  **Security:** `SchemaDisplayPath` no longer injects model or tool paths as HTML. `JSXPreview` blocks `script`, `style`, `iframe`, `form`, `object`, `embed`, `link`, `meta`, `base` and unknown elements. `WebPreviewBody` leaves `allow-same-origin` out of the iframe sandbox unless you set `allowSameOrigin`.

  **Check your app when upgrading:**
  - **Monaco export moved.** Import `monaco` from `@elabs-ai/components-editor/monaco` instead of the root import. Monaco now loads only when an editor mounts.
  - **`NumberInput` changed.** It renders a locale-aware text spinbutton, and its `ref` (and `BoundedNumber`'s) now points at the `<input>` instead of the wrapper.
  - **Pickers fill their column.** `Combobox`, `DatePicker`, `DateRangePicker`, `VirtualSelect` and `TreeSelect` triggers default to full width. Pass a width class to narrow one.
  - **Some styles changed.**
    - Disabled `Button` and `Input` fade to 50% opacity.
    - Dropdown and context menus are at least `12rem` wide.
    - Sheet, AlertDialog and Drawer titles match `DialogTitle`.

  **Added:**
  - `FileUpload`:
    - `onFilesRejected` reports files rejected by `accept`, size, count or `multiple`. These rules now also apply to dropped files.
    - A `describeFileRejection` helper.
  - `Conversation`: `isStreaming`.
  - `MessageTable`, `MessageForm` and `MessageFormProvider`: `isStreaming`. The old `streaming` prop still works but is deprecated.
  - `ResizableHandle`: `hitAreaMargins`.
  - The `--scrim` theme token (`bg-scrim`), used for the Gantt progress fill. `THEME_TOKEN_NAMES` now has 209 names, so add `--scrim` to any custom theme that is checked against it.
  - About 250 locale keys replace hard-coded English across ui, data, ai, charts, maps, flow, terminal and editor.

  **Fixed, ai:**
  - `CodeBlock` no longer shows stale code or grows its cache without limit.
  - `DiffView` tokenizes the old and new sides separately.
  - `PromptInput` restores your text when a submit fails and ignores double submits.
  - `SpeechInput` releases the microphone on unmount.
  - `Tool` survives output it can't serialize.
  - `AssetPreview` parses quoted CSV fields.
  - The math and CJK plugins load lazily.

  **Fixed, ui:**
  - `Tree` no longer jumps while you scroll.
  - `Combobox` and the date pickers handle controlled and uncontrolled values correctly.
  - `FileUpload` custom drop zones work from the keyboard.
  - `SchemaForm` re-renders only the field you edit.
  - Sheet and AlertDialog scroll tall content.
  - `useIsMobile` returns the right value on first render.
  - `Carousel` no longer leaks a listener and no longer blocks arrow keys inside inputs.

  **Fixed, other packages:**
  - data: `SearchInput` forwards refs.
  - charts: charts skip recalculating when their data hasn't changed, and `LiveLineChart` pauses while off-screen.
  - maps: `MapMarker` is safe to render on the server.
  - editor: `CodeEditor` follows `path` and `options` changes and keeps undo history. `MermaidDiagram` renders one diagram at a time.

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
