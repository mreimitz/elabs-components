# Charts (@elabs-ai/components-charts)

Load this when the task draws a chart, a KPI tile or a `ChartFrame`. To pick a chart
for a data shape, run `brand-ui chart-for "<data shape>"` or read
[chart-selection.md](chart-selection.md); for a whole dashboard sheet, read
[sheet-for.md](sheet-for.md).

`@elabs-ai/components-charts` provides composable chart containers, `ChartFrame` (an
expand/flip-to-table/download-CSV wrapper), and the KPI tile primitives
(`MetricCard`, `MetricGrid`, `ChartCard`). All visuals are token-driven —
series colors come from `--chart-1..5` so every chart is theme-safe without
any inline styles. The package depends only on `@elabs-ai/components-ui` and `@elabs-ai/components-tokens`;
it must NOT import from `@elabs-ai/components-data` (sibling dep rule).

## Which chart when

For the full 25-container data-shape table (which axis/measure combination maps
to which container, alternatives, and when to avoid each), the four
chart-selection rules (judge the shape first, compare ≥ 3 candidates, cap a page
at 6 charts, never repeat a silhouette), and palette-by-cardinality guidance, see
[reference/chart-selection.md](reference/chart-selection.md) — or query it
directly with `brand-ui chart-for "<data shape>"` (also exposed as the `chart_for`
MCP tool). The quick table below is a shorter, pre-RM-038 cheat sheet covering
13 of the 25 containers.

| Chart              | Use when                                                       |
| ------------------ | -------------------------------------------------------------- |
| `AreaChart`        | Trend over time with magnitude / filled area emphasis          |
| `LineChart`        | Trend or multi-series comparison over time                     |
| `BarChart`         | Categorical comparison; supports vertical, horizontal, stacked |
| `ScatterChart`     | Correlation between two continuous variables                   |
| `PieChart`         | Part-to-whole for a small number of categories                 |
| `RingChart`        | Part-to-whole with a center slot for a summary value           |
| `FunnelChart`      | Stage drop-off / conversion funnel                             |
| `RadarChart`       | Multivariate attribute comparison across categories            |
| `CandlestickChart` | OHLC financial / time-series open-high-low-close data          |
| `ComposedChart`    | Mixed bar columns + lines on a shared time scale               |
| `LiveLineChart`    | Streaming / real-time data updated at high frequency           |
| `ChoroplethChart`  | Geographic data mapped to regions (world/country polygons)     |
| `SankeyChart`      | Flow allocation between nodes (budget, traffic, energy)        |

## Composition pattern

Charts follow a provider-children model: the chart container owns a
`ChartProvider` internally; composition primitives (`Area`, `Line`, `Bar`, …)
are passed as children and read scale/data from context.

```tsx
// Verified against the @elabs-ai/components-charts area-chart example
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from "@elabs-ai/components-charts";
import { curveNatural } from "@visx/curve";

const data = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 80 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 140 },
];

<div className="h-72 w-full">
  <AreaChart data={data} style={{ height: "100%" }}>
    <Grid horizontal />
    <Area
      dataKey="desktop"
      curve={curveNatural}
      stroke="var(--chart-1)"
      fill="var(--chart-1)"
      fillOpacity={0.4}
    />
    <Area
      dataKey="mobile"
      curve={curveNatural}
      stroke="var(--chart-2)"
      fill="var(--chart-2)"
      fillOpacity={0.4}
    />
    <XAxis />
    <ChartTooltip />
  </AreaChart>
</div>;
```

Key composition primitives per chart family:

- **Area/Line/Composed** — `Area`, `Line`, `SeriesBar`, `XAxis`, `YAxis`, `Grid`, `ChartTooltip`
- **Bar** — `Bar`, `BarXAxis`, `BarYAxis`, `Grid`, `ChartTooltip`
- **Pie/Ring** — `PieSlice`/`Ring`, `PieCenter`/`RingCenter`, `ChartTooltip`
- **Scatter** — `Scatter`, `XAxis`, `YAxis`, `Grid`, `ChartTooltip`
- **Radar** — `RadarArea`, `RadarAxis`, `RadarGrid`, `RadarLabels`
- **Candlestick** — `Candlestick`, `XAxis`, `YAxis`, `Grid`, `ChartTooltip`
- **LiveLine** — `LiveLine`, `LiveXAxis`, `LiveYAxis`
- **Sankey** — `SankeyNode`, `SankeyLink`, `SankeyTooltip`
- **Choropleth** — `ChoroplethFeatureComponent`, `ChoroplethGraticule`, `ChoroplethTooltip`

## `useChart` hooks

Three hooks give composition primitives access to the chart's internal state.
**They throw when called outside a `ChartProvider`** — which means they throw
inside `ChartFrame` (ChartFrame renders above the chart's provider). Never
call them from a `ChartFrame` prop or a parent component; instead pass
`data`/`columns` as props directly to `ChartFrame`.

| Hook               | Re-renders on hover?   | Use for                                                         |
| ------------------ | ---------------------- | --------------------------------------------------------------- |
| `useChartStable()` | No                     | Axes, grids, fill primitives — cold consumers                   |
| `useChartHover()`  | Yes (every mouse move) | Tooltip, crosshair — hot consumers                              |
| `useChart()`       | Yes                    | Convenience: merged stable + hover; use only when you need both |

Return shape (selected fields from `ChartContextValue`):

```ts
const { data, xScale, yScale, width, height, tooltipData } = useChart();
// tooltipData: { point, index, x, yPositions } | null
```

## ChartFrame

`ChartFrame` wraps any chart child and adds three toolbar controls — expand
(full-screen modal), flip-to-table, and download CSV. Controls are hidden
automatically when `data` is absent or empty (feature degradation).

```tsx
import {
  ChartFrame,
  BarChart,
  Bar,
  BarXAxis,
  Grid,
  ChartTooltip,
} from "@elabs-ai/components-charts";

const data = [
  { month: "Jan", revenue: 12000 },
  { month: "Feb", revenue: 15500 },
];
const columns = [
  { key: "month", header: "Month" },
  { key: "revenue", header: "Revenue ($)" },
];

// Pass the SAME data to both ChartFrame and the chart — they can't share context.
<ChartFrame title="Revenue" description="Jan–Jun 2025" data={data} columns={columns}>
  <BarChart data={data} xDataKey="month">
    <Grid horizontal />
    <Bar dataKey="revenue" fill="var(--chart-1)" />
    <BarXAxis />
    <ChartTooltip />
  </BarChart>
</ChartFrame>;
```

Key props: `title`, `description`, `data`, `columns` (`{ key, header? }[]`),
`features` (`["expand","table","download"]` — default all), `plotHeight` (the
chart's own drawing height: px or `{ aspect }`, optionally per breakpoint; the older
`height` is deprecated), `detail` (right-pane content in the modal), `onDownload`
(custom CSV handler; default is a local RFC-4180 serializer), `renderTable`
(custom table renderer; default is `@elabs-ai/components-ui` `Table`).

## KPI tiles

**`MetricCard`** — compact KPI tile. Props: `label`, `value`, `description?`,
`delta?` (signed string, e.g. `"+12.4%"`), `deltaDirection?`
(`"up"|"down"|"neutral"`), `positiveIsGood?` (flip color for metrics where down
is good), `icon?`, `visual?` (inline slot for a sparkline or chart).

**`MetricGrid`** — responsive grid wrapper for a row of `MetricCard`s. Props:
`columns` (2|3|4, default 4), `reveal` (stagger-in animation, default false).

**`ChartCard`** — presentational Card shell for any chart child. Props: `title`,
`description?`, `actions?` (header-right slot for pickers/menus), `children`
(the chart), `height` (body px, default 260). Chart-library-agnostic — pass any
chart as children and use `--chart-1..5` tokens for series colors.

**Stat-card registry blocks** — copy-own compositions of a `MetricCard` +
embedded sparkline chart, for dashboards that need chart-backed KPI tiles:

```
npx shadcn@latest add <registry-url>/stat-card-area-01.json
npx shadcn@latest add <registry-url>/stat-card-line-01.json
npx shadcn@latest add <registry-url>/stat-card-choropleth-01.json
```

After adding, read the copied files and fix `@/…` aliases to your project path.

## Token surface

Series colors: `var(--chart-1)` through `var(--chart-5)` (five slots defined in
every theme). Supporting tokens: `--chart-label` (axis/legend text),
`--chart-grid` (grid lines), `--chart-background` (chart area), `--chart-foreground`,
`--chart-foreground-muted`, `--chart-crosshair`, `--chart-tooltip-background`.

Pass series colors as `stroke="var(--chart-1)"` / `fill="var(--chart-1)"` — never
raw hex. A monochrome theme renders chart series as a lightness ramp; use the
tokens and every theme renders correctly for free.
