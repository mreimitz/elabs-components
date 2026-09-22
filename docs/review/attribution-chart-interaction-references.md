# Chart interaction track — reference products and sources (attribution)

Companion to `docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md`. This file is the
one place the track names the products it learned from; the plan, the ADR, the roadmap items and the
code describe the behaviour instead. Legend used everywhere else:

| Generic name in the plan             | Product                 |
| ------------------------------------ | ----------------------- |
| the associative BI suite             | Qlik Sense / Qlik Cloud |
| the analytics-pane BI suite          | Tableau                 |
| the report-builder BI suite          | Power BI                |
| the React chart library              | Recharts                |
| the canvas chart library             | Apache ECharts          |
| the commercial stock-chart library   | Highcharts              |
| the grammar-of-graphics library      | Vega-Lite               |
| the scientific plotting library      | Plotly                  |
| the notebook plotting library        | Observable Plot         |
| the embedded-scrollbar chart library | amCharts 5              |
| the monitoring dashboard             | Grafana                 |

## Reference products (researched 2026-09-22)

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

## Sources

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
