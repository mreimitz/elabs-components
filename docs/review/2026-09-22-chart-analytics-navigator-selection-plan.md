# Charts — statistical reference lines, mini-chart navigator, selection gestures (2026-09-22)

Trigger: "my charts miss some substantial features: (1) no statistical reference lines
(average, exponential, …) — Qlik, Tableau and Power BI have lots of these; (2) no mini chart
as a scroll option like Qlik Sense; (3) no standard selection gestures — range select along
an axis, area select in a scatter, lasso. Research and come back with an implementation plan."

Outcome: three gaps confirmed, but none starts from zero — each has a seam in the package
that the plan extends rather than replaces. Track: `roadmap/chart-interaction/` (RM-136 … RM-146).

## 1. What the package has today (evidence)

| Seam                                 | Where                                                                         | What it covers                                                                                            | What it does not                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ReferenceLine`                      | `src/charts/reference-line.tsx`                                               | one horizontal rule at a literal `value`, time-series shell only, dashed, `HaloText` label                | no computed value, no vertical, no band, no bar/scatter/distribution                                                                     |
| `annotations[{kind:"line"            | "range"}]` (RM-111)                                                           | `annotations/annotation-types.ts`; accepted by line, area, bar, composed, dumbbell, waterfall, choropleth | literal `x` or `y` line with `style`/`width`/`label`; literal band `x1..x2`/`y1..y2` with pattern/colour                                 | value must be a number the caller computed; no average/median/percentile, no confidence band |
| `TrendLine` (RM-115)                 | `trend-line.tsx`, `Scatter trend`                                             | least-squares `linear`/`log`, r² and direction reach the a11y summary                                     | scatter only; no exponential/power/polynomial/loess, no CI band, not on line/bar                                                         |
| `DistributionReferenceLines`         | `distribution/distribution-reference-line.tsx`                                | literal lines on the distribution value axis                                                              | not computed, own API                                                                                                                    |
| Bar `overlays` (RM-113)              | `bar-overlays.tsx`                                                            | per-bar value marker / range span from data fields                                                        | per-datum, not a chart-level statistic; the shape Power BI calls _error bars_ is close                                                   |
| `ChartBrush`                         | `chart-brush.tsx` (visx `Brush`)                                              | drag a time window INSIDE the plot, handles, dimmed track, one story                                      | not an overview strip; time only; no keyboard; no auto-show                                                                              |
| `ChartBrushLayout`                   | `chart-brush-layout.tsx`                                                      | a layout seam: main chart + `brushStrip` render-prop below, feeds `xDomain`/`xDomainSlotCount`            | exported, but no container, block or story uses it — a stub                                                                              |
| `xDomain` window                     | `time-series-chart-shell.tsx` §`filterDataByXDomain`, `xDomainSlotCount`      | the shell already renders a sub-range of `data` on a padded scale                                         | only time-series families; `BarChart` trims categories to fit ("the cascade trims/hides to fit", `bar-chart.tsx` ~914) and never scrolls |
| LTTB                                 | `decimate-time-series.ts`                                                     | downsampling for long paths                                                                               | keeps "visually significant" points, not guaranteed min/max per bucket (Qlik's condensed overview keeps extremes)                        |
| `onDatapointClick` (#349)            | `chart-datapoint.ts`, `ChartDatapointLayer`                                   | one click/keyboard activation contract on every family, real `<button>`s outside the SVG                  | one datum at a time; no gesture, no multi-select payload                                                                                 |
| `selectionStates` tri-state (RM-073) | `chart-selection.ts`                                                          | INPUT: host says selected / associated / excluded, every family paints it                                 | no OUTPUT beyond a single click; nothing emits a set of categories                                                                       |
| hidden drag range                    | `use-chart-interaction.ts` `ChartSelection {startX,endX,startIndex,endIndex}` | mouse-down/move tracks a range and puts it in context                                                     | nothing paints or emits it — dead state                                                                                                  |
| parked dashboard `SelectionDriver`   | `parked/dashboard-pack/charts-dashboard/core/selection.ts`                    | `select(field, values, {toggle                                                                            | replace})`, snapshot `states()`, history, lock                                                                                           | parked; the charts have no way to produce a `SelectionIntent` from a gesture                 |
| Canvas hit-test                      | `canvas-layer/hit-test.ts`                                                    | nearest-point lookup for the canvas mark layer                                                            | not used for area/lasso containment                                                                                                      |

So: the _paint_ side of selection and the _window_ side of scrolling exist; the missing pieces
are the statistics, the overview strip, and the gesture → intent layer.

## 2. Reference products (researched 2026-09-22, sources in §7)

### 2.1 Statistical reference lines / analytics

| Capability                | Qlik Sense                                                                                                                                   | Tableau (Analytics pane)                                                                                                                                                         | Power BI (Analytics pane)                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Constant line             | expression; only drawn inside the axis range; multiple per chart; label, show value, solid/dashed, coloured label background, show-condition | Constant (table/pane/cell scope), tooltip none/auto/custom, fill above/below                                                                                                     | X- and Y-axis constant line; solid/dashed/dotted, transparency, behind/in-front, data label name+value+position |
| Vertical (dimension) line | bar, combo, line; text values on discrete axes                                                                                               | constant on date dims                                                                                                                                                            | X-axis constant line on most cartesian visuals                                                                  |
| Computed lines            | average via _Average trend line_; anything else by expression                                                                                | Sum, Average, Median, Min, Max, Total, Constant; "recalculate for selected marks"                                                                                                | Min, Max, Average, Median, Percentile — each bound to a measure                                                 |
| Bands                     | —                                                                                                                                            | reference band from–to; distribution band: percentages, percentiles, quantiles (3–10), std-dev (k, sample/population, symmetric), 95 % CI; box plot; average/median with 95 % CI | — (symmetry shading on scatter only)                                                                            |
| Trend models              | Average, Linear, Poly 2/3/4, Exponential, Logarithmic, Power; per measure, dashed option                                                     | Linear, Log, Exp, Power, Poly 2–8; per colour; 95 % confidence bands; force intercept 0                                                                                          | Linear only (time axis)                                                                                         |
| Rolling / transforms      | measure _modifiers_: accumulation, difference, moving average (`steps`, full/custom range), relative numbers, time-series decomposition      | table calcs                                                                                                                                                                      | —                                                                                                               |
| Forecast                  | line chart                                                                                                                                   | ETS, additive/multiplicative season, PI 90/95/99                                                                                                                                 | length + confidence interval, seasonality                                                                       |
| Error bars                | —                                                                                                                                            | —                                                                                                                                                                                | by field (abs/rel, symmetric) or by %; band on line charts                                                      |
| Anomalies / clusters      | —                                                                                                                                            | k-means clusters                                                                                                                                                                 | anomaly detection with expected range                                                                           |

Library API shapes worth copying: Recharts `ifOverflow: "discard"|"hidden"|"visible"|"extendDomain"`;
ECharts `markLine.data[{type:"average"|"min"|"max"|"median"}]`; Vega-Lite `regression`
(`linear|log|exp|pow|quad|poly`, `order`, `extent`) and `loess` (`bandwidth`) as **transforms**
that feed an ordinary `rule`/`line` mark; Observable Plot `windowY({k, reduce, anchor, strict})`
and `linearRegressionY({ci})`; Plotly `trendline_options` for `rolling|expanding|ewm`;
d3-regression (`.predict`, `.rSquared`, `coefficients`) covers every model the three BI tools ship.

### 2.2 Mini chart / overview navigator

| Capability      | Qlik Sense                                                                                                                                                  | Highcharts Stock navigator                           | ECharts `dataZoom` slider                                                       | Recharts `Brush`                   | MUI X (Pro)                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------ | -------- | --------------------- |
| When shown      | automatically "when the number of dimension values exceeds the width"; bar/line/combo; both orientations; `scrollbar: "miniChart"                           | "bar"                                                | "none"`                                                                         | always when enabled                | always                                           | always   | `zoom.slider.enabled` |
| Overview        | scaled copy; for large data a **condensed grey overview that still shows the very low and very high values**                                                | areaspline of series 0, data-grouped at 2 px         | `dataBackground` shadow                                                         | child chart re-rendered small      | `preview`                                        |
| Window model    | discrete index scroll (`scrollStartPos` 0 = start, 1 = end; `dimensionAxis.maxVisibleItems` = "Number of bars") or continuous zoom/pan on a continuous axis | x-axis `min/max` with `minRange`                     | percent or value (`rangeMode`), `minSpan`, `zoomLock`, `realtime`, `filterMode` | `startIndex/endIndex`, `gap`       | percent `start/end`, `minSpan`, `filterMode keep | discard` |
| Gestures        | drag window, wheel, two-finger swipe                                                                                                                        | handles, mask drag, scrollbar                        | handles, move-handle, `brushSelect`, click-to-locate                            | travellers                         | slider, brush, wheel, pinch                      |
| Keyboard / ARIA | not documented                                                                                                                                              | "Axis zoom" group with two percent `slider`s (v11.2) | none                                                                            | `role=slider` travellers, ←/→ only | `+ - 0`, Shift+arrows                            |
| Limits          | 2 000 visible points default (max 50 000); 12 lines; selections skip hidden points                                                                          | `minRange` = 5× smallest interval                    | `minValueSpan`                                                                  | —                                  | `minSpan`                                        |

### 2.3 Selection gestures

| Gesture               | Qlik Sense                                                                                                                                                                                  | Tableau                                | Power BI                                                                          | Vega-Lite                       | Plotly                | ECharts brush   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- | --------------------- | --------------- | --------------- |
| Click                 | toggle, accumulates while unconfirmed                                                                                                                                                       | Ctrl/Cmd multi                         | Ctrl multi (AND)                                                                  | shift-click `toggle`            | `clickmode`           | `selectchanged` |
| Axis range            | **Range selection on the x- or y-axis; measure axis has an editable numeric "range bubble"**; bar, box, combo, distribution, histogram, line, scatter (dimension axis only on stacked bars) | —                                      | —                                                                                 | interval with `encodings:["x"]` | `selectdirection: h   | v`              | `lineX`/`lineY` |
| Rectangle             | —                                                                                                                                                                                           | Rectangular (default)                  | Ctrl+drag; **overlap** rule; line, area, scatter, treemap, maps; 3 500 points max | interval                        | `select`              | `rect`          |
| Lasso                 | freehand loop; toolbar toggle or **Shift**; **only visible data points**; bar, line, scatter, pie, map, treemap, box, histogram, distribution                                               | Lasso, Radial                          | polygon on Azure Maps                                                             | —                               | `lasso` (path coords) | `polygon`       |
| Draw across marks     | yes (line through bars/points)                                                                                                                                                              | —                                      | —                                                                                 | —                               | —                     | —               |
| Provisional + confirm | ✓ / ✕, Enter / Esc, click outside                                                                                                                                                           | immediate; tooltip Keep-only / Exclude | immediate                                                                         | —                               | —                     | —               |
| Keyboard              | Space / Shift+arrows / Ctrl+Space in cells                                                                                                                                                  | legend only                            | **`S` → crosshair, arrows, hold Space to grow, release commits**                  | —                               | —                     | —               |

Implementation semantics from Qlik's own renderer (picasso.js): `brush-range` is a brush on a
linear scale with `rangeStart/Move/End` + `bubbleStart/End` (the editable bubble); `brush-lasso`
closes "if within snap threshold"; brushes link across charts (`link()`), and each trigger has an
`action` (`toggle` …). That is exactly the `SelectionIntent` shape the parked dashboard core defines.

## 3. Decisions the plan takes (proposed → ADR 0040, RM-136)

1. **Analytics are transforms, not new marks.** A framework-free `src/charts/analytics/` module
   computes; the result is drawn by what exists: a computed line/band becomes a `line`/`range`
   annotation, a trend/window/forecast becomes a derived series (line + optional band) on the
   family's own scales. No new tokens, no new ink: computed furniture keeps `--chart-foreground`
   / `--chart-foreground-muted` (a statistic is commentary, never a series colour), a derived
   series that _replaces_ a measure (moving average) takes that measure's series token.
2. **One declarative prop, `analytics[]`, beside `annotations[]`**, on every container that
   accepts annotations plus `ScatterChart` and `DistributionChart`; the same array lands in
   `ChartSpec.analytics` so AutoChart and A2UI get it for free. Value union:
   `number | "mean" | "median" | "min" | "max" | "sum" | { percentile: n } | { stddev: k } | ((rows) => number)`.
   Overflow policy `ifOverflow: "clip" | "extend"` (default `clip`, today's behaviour).
   `ReferenceLine` and `TrendLine` stay as thin wrappers over the same maths.
3. **Regression maths is vendored from d3-regression** (MIT, ~6 kB, tree-shakes; same
   `predict`/`rSquared` API our `fitTrend` already mimics) instead of hand-rolling polynomial
   solvers; polynomial degree capped at 6 with a "degree ≥ n rows" guard. Forecast is
   additive Holt-Winters (ETS AAA/AAN) implemented locally with a prediction band; anomaly
   detection and clustering are out of scope (P3, noted, not planned).
4. **Navigator = overview strip + window model, one component (`ChartNavigator`).** Two window
   kinds: `time` (continuous `[Date, Date]`, feeds the existing `xDomain`) and `index`
   (`[start, end]` over categories, Qlik's discrete scroll). Auto-shows on overflow
   (`scrollbar: "miniChart" | "bar" | "none"`, default `miniChart` like Qlik), fixed 40 px strip
   below the plot, the overview is a **min/max-preserving condensed shadow** in `--chart-grid`
   ink (never the series ramp), never re-rendering the full chart. `ChartBrushLayout` is
   retired into it; `ChartBrush` stays as the in-plot zoom gesture.
5. **Selection output is an intent, not a payload of points.** `onSelectionIntent(intent)` with
   `{ field, values, mode: "add" | "toggle" | "replace", gesture: { kind, geometry }, datapoints }`
   — `field`/`values`/`mode` are the parked dashboard `SelectionIntent`, so the pack's driver
   plugs in unchanged when it is revived; `datapoints` reuses `ChartDatapoint`. A measure-axis
   range still resolves to **dimension values** (Qlik's rule: "select the values whose measure
   falls in the range"), so the vocabulary stays one field/values pair.
6. **Provisional-then-confirm is opt-in.** `selectionConfirm: "immediate" | "explicit"` (default
   `immediate` — Tableau/Power BI/Vega); `explicit` paints the provisional set through the
   existing `selectionStates` seam, shows ✓ / ✕ in the `ChartFrame` action slot, Enter/Esc,
   click-outside confirms. A Qlik theme flips the default to `explicit` via the frame, never
   via product-specific code in the library (the rule from the theme-fidelity review).
7. **Hit-test rules are explicit per gesture:** bars/cells — overlap (Power BI); points — inside
   polygon (d3-polygon `polygonContains`, already in the lockfile as a transitive dep; promote
   to a direct dep); lasso and area only consider **visible** datapoints (Qlik); axis range on a
   time axis selects all values in range, visible or not (Qlik "time-aware charts"). Canvas-layer
   marks reuse the same containment through `hit-test.ts`.
8. **Keyboard parity is a gate, not a follow-up.** Axis range = two `role="slider"` thumbs (APG
   multi-thumb: arrows, Home/End, PageUp/Down); rectangle = Power BI's crosshair model (`S`,
   arrows, hold Space, release commits); lasso has no keyboard form anywhere — the rectangle is
   its keyboard equivalent, and the datapoint layer's real buttons remain the per-point path.
   Targets live outside the `<svg>` (rule in `.claude/rules/charts.md` §Drill-down).
9. **Modifiers:** Shift = add, Ctrl/Cmd = toggle, plain = replace (the Vega/Power BI/Tableau
   consensus); `explicit` confirm mode makes plain click toggle like Qlik.

## 4. Scope by family

| Family                                                                                 | analytics[]                                       | navigator                                    | axis range                                | area / lasso                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- | ----------------------------------------- | -------------------------------- |
| Line / Area / Composed (time + category)                                               | line, band, trend, window, forecast, errorBars    | time + index                                 | x + y                                     | rect + lasso on points           |
| Bar (vertical + horizontal, stacked)                                                   | line, band, trend (per series), window, errorBars | index (Qlik scroll)                          | dimension axis; measure axis on unstacked | rect + lasso (overlap)           |
| Scatter                                                                                | line, band (x and y), trend (all models, CI)      | — (2-D zoom stays `@visx/zoom`, P3 mini-map) | x + y                                     | rect + lasso (the headline case) |
| Distribution (histogram/box/violin/strip)                                              | line, band (percentile/stddev)                    | —                                            | value axis                                | rect on strips                   |
| Heatmap / Calendar                                                                     | —                                                 | index (columns)                              | column range                              | rect                             |
| Candlestick / LiveLine                                                                 | line, window (SMA/EMA), band                      | time                                         | x                                         | —                                |
| Waterfall / Dumbbell / Bump / Pie / Ring / Funnel / Treemap / Sankey / Network / Gantt | line (waterfall, dumbbell)                        | —                                            | —                                         | lasso on pie/treemap (P2)        |

## 5. Work packages (summary — the RM files are the spec)

| ID     | Item                                                                                                                                                                                                                   | Wave | Effort |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| RM-136 | ADR 0040 decision gate: analytics value union + `analytics[]`, navigator window model, `SelectionIntent` output, confirm modes, keyboard contract                                                                      | 0    | S      |
| RM-137 | `analytics/` stats core: reference computations, d3-regression models + loess, window reduce, quantile/std-dev/CI, Holt-Winters; pure, golden-tested                                                                   | 0    | M      |
| RM-138 | `analytics[]` lines and bands on every annotation-bearing container + scatter + distribution; `ChartSpec.analytics`; A2UI catalog                                                                                      | 1    | M      |
| RM-139 | Trend, window, forecast and error-bar overlays as derived series (legend entry, tooltip row, a11y summary with r² / window / horizon)                                                                                  | 1    | M–L    |
| RM-140 | `ChartNavigator`: overview strip, time + index window, condensed min/max shadow, wheel/touch, multi-thumb keyboard, `minSpan`, `align`                                                                                 | 1    | L      |
| RM-141 | Overflow scrolling on category families: `scrollbar` + `maxVisibleItems` on Bar/Composed/Heatmap, vertical + horizontal, auto-navigator on long time series                                                            | 2    | M      |
| RM-142 | Gesture engine `selection/`: pointer state machine (pointer / range / rect / lasso), containment + overlap hit-testing, visible-only rule, provisional state, modifiers, touch                                         | 1    | M–L    |
| RM-143 | Axis range selection: x and y, editable range bubbles, measure→dimension resolution, multi-thumb keyboard, on line/area/bar/composed/scatter/distribution/heatmap                                                      | 2    | M      |
| RM-144 | Area + lasso selection: rectangle and polygon on points and marks, snap-to-close, Power BI keyboard rectangle, canvas-layer parity                                                                                     | 2    | M      |
| RM-145 | Selection chrome + intent: `ChartSelectionToolbar` (mode, ✓/✕), `selectionConfirm`, `onSelectionIntent`, linked-charts story on a local driver, `SelectionState` paint of provisional sets                             | 3    | M      |
| RM-146 | Closure: `charts.md` rules (Analytics, Navigator, Selection), CLI manifest + `chart-selection.md` guidance, A2UI schema regen, `analytics-dashboard` registry block, home chart detail pages, CHANGELOG, browser sweep | 3    | S–M    |

Critical path: RM-136 → RM-137 → RM-139 → RM-146 and RM-136 → RM-142 → RM-143/144 → RM-145 → RM-146
(≈ 14–16 agent-days). RM-138 is the item to demo first: an average line and a percentile band
on the existing River recipes is what makes the difference visible on the site in a day.

## 6. Not planned (and why)

- Anomaly detection, k-means clusters, time-series decomposition: statistics that need a model
  choice the chart should not make silently; revisit once `analytics[]` exists (P3 note in RM-139).
- Qlik "draw selection" (a freehand line through marks): lasso covers the intent; a stroke
  hit-test is a small add-on to RM-144 if asked for.
- Radial selection (Tableau): rectangle + lasso cover it; radial is a polygon preset.
- Scatter zoom mini-map (Qlik's locator): `@visx/zoom` already pans/zooms; a locator is P3.
- Selection over 3 500 datapoints: we cap the intent's `datapoints` at the visible set and
  always send `values`; no hard limit.

## 7. Sources

Qlik: [Reference lines](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Visualizations/reference-lines.htm) ·
[Trend lines](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Measures/trend-lines.htm) ·
[Modifiers](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Measures/modifiers.htm) ·
[Bar chart (mini chart)](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Visualizations/Bar-Chart/bar-chart.htm) ·
[Line chart](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Visualizations/LineChart/line-chart.htm) ·
[sn-bar-chart properties (`scrollbar`, `scrollStartPos`, `maxVisibleItems`)](https://qlik.dev/apis/javascript/sn-bar-chart/) ·
[Types of selections](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Selections/selection-in-visualization.htm) ·
[Range selection](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Selections/range-selection.htm) ·
[Lasso selection](https://help.qlik.com/en-US/sense/November2024/Subsystems/Hub/Content/Sense_Hub/Selections/lasso-selection.htm) ·
[Time-aware charts](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Visualizations/time-aware-charts.htm) ·
[picasso.js brush-range](https://qlik.dev/extend/extensions/picasso-js/components/brush-range/) ·
[picasso.js brush-lasso](https://qlik.dev/extend/extensions/picasso-js/components/brush-lasso/).
Tableau: [Analytics pane](https://help.tableau.com/current/pro/desktop/en-us/environ_workspace_analytics_pane.htm) ·
[Reference lines, bands, distributions](https://help.tableau.com/current/pro/desktop/en-us/reference_lines.htm) ·
[Trend lines](https://help.tableau.com/current/pro/desktop/en-us/trendlines_add.htm) ·
[Forecast options](https://help.tableau.com/current/pro/desktop/en-us/forecast_options.htm) ·
[Select marks](https://help.tableau.com/current/pro/desktop/en-us/inspectdata_pan_zoom.htm).
Power BI: [Analytics pane](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-analytics-pane) ·
[Anomaly detection](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-anomaly-detection) ·
[Multi-select and rectangle select (keyboard `S`)](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-multi-select).
Libraries: [ECharts markLine](https://echarts.apache.org/en/option.html#series-line.markLine) ·
[ECharts dataZoom](https://echarts.apache.org/en/option.html#dataZoom) ·
[ECharts brush](https://echarts.apache.org/en/option.html#brush) ·
[Highcharts navigator](https://api.highcharts.com/highstock/navigator) ·
[Highcharts plotLines](https://api.highcharts.com/highcharts/yAxis.plotLines) ·
[Recharts ReferenceLine `ifOverflow`](https://recharts.github.io/en-US/api/ReferenceLine/) ·
[Recharts Brush](https://recharts.github.io/en-US/api/Brush/) ·
[Vega-Lite regression](https://vega.github.io/vega-lite/docs/regression.html) ·
[Vega-Lite selection](https://vega.github.io/vega-lite/docs/selection.html) ·
[Observable Plot window](https://observablehq.com/plot/transforms/window) ·
[Plotly selections](https://plotly.com/javascript/reference/layout/) ·
[d3-regression](https://github.com/HarryStevens/d3-regression) ·
[d3-brush](https://d3js.org/d3-brush) · [d3-polygon](https://d3js.org/d3-polygon) ·
[visx Brush](https://airbnb.io/visx/docs/brush) ·
[MUI X zoom and pan](https://mui.com/x/react-charts/zoom-and-pan/).
A11y: [APG multi-thumb slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/) ·
[Highcharts navigator a11y strings](https://api.highcharts.com/highstock/lang.accessibility.navigator).
