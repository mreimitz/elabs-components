---
archetype: dashboard
intent: "KPI overview screen — metrics first, charts second, records last"
keywords: [dashboard, kpi, metrics, overview, analytics, charts, reporting, summary, drill-down]
packages: ["@elabs/components-ui", "@elabs/components-charts", "@elabs/components-data"]
---

# Playbook — Dashboard

Metrics-first overview screen: KPI tiles on top, charts in the middle,
a records table below. Template source: `templates/dashboard.tsx` (generated from this Storybook story by `pnpm gen:templates`).

## Building blocks

| Layer  | Components                                                                                | From                       |
| ------ | ----------------------------------------------------------------------------------------- | -------------------------- |
| Shell  | `SidebarProvider` + `Sidebar` + `SidebarInset`                                            | `@elabs/components-ui`     |
| KPIs   | `MetricGrid` + `MetricCard` (×3–5)                                                        | `@elabs/components-charts` |
| Charts | `ChartFrame` wrapping `BarChart` / `LineChart` / `AreaChart` (or `AutoChart` from a spec) | `@elabs/components-charts` |
| Table  | `DataTable` + `FilterBar` + `SearchInput`                                                 | `@elabs/components-data`   |
| States | `Skeleton` (loading) · `EmptyState` (no results)                                          | `@elabs/components-ui`     |

## Wiring diagram

```
SidebarProvider
├── Sidebar (nav items)
└── SidebarInset
    ├── header (SidebarTrigger + title)
    └── main  (flex-col gap-6 p-6)
        ├── MetricGrid columns={4} → MetricCard ×4      ← KPI hook
        ├── grid lg:grid-cols-2
        │   ├── ChartFrame → BarChart                    ← series hook
        │   └── ChartFrame → LineChart                   ← series hook
        └── DataTable + FilterBar (optional)             ← rows hook
```

Order matters: KPIs answer "how are we doing", charts answer "what's the
trend", the table answers "which records" — top to bottom, summary to detail.

## Minimal example (chart row)

```tsx
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartFrame,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
} from "@elabs/components-charts";

<div className="grid gap-6 lg:grid-cols-2">
  <ChartFrame title="Revenue by quarter" data={revenue}>
    <BarChart data={revenue} xDataKey="quarter">
      <Grid horizontal />
      <Bar dataKey="thisYear" fill="var(--chart-1)" />
      <Bar dataKey="lastYear" fill="var(--chart-2)" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  </ChartFrame>
  <ChartFrame title="Win rate trend" data={winRate}>
    <LineChart data={winRate} xDataKey="month">
      <Grid horizontal />
      <Line dataKey="rate" stroke="var(--chart-1)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  </ChartFrame>
</div>;
```

`ChartFrame` adds expand / table-view / CSV-download for free when you pass
`data`. Series colors are `var(--chart-1..5)` only — they retheme with the app.

KPI tiles:

```tsx
<MetricGrid columns={4}>
  <MetricCard label="Pipeline value" value="$4.2M" delta="+8.2%" deltaDirection="up" />
  <MetricCard
    label="Cycle time"
    value="32d"
    delta="+2d"
    deltaDirection="up"
    positiveIsGood={false}
  />
</MetricGrid>
```

## Decisions you own

Theme · nav sections · which 3–5 KPIs · chart types per question
(comparison → bar, trend → line/area, share → ring/pie) · table columns,
default sort, page size.

## Decisions already made — don't re-make

Shell composition (`SidebarProvider` wraps everything) · spacing rhythm
(`gap-6 p-6`) · chart colors (`--chart-N` tokens) · `ChartFrame` for any
chart a user might want to expand/export · `tabular-nums` on numeric cells ·
loading = `Skeleton` per tile, never a blank grid.

## Common mistakes

- Charts without `ChartFrame` — you lose expand/CSV and the card chrome.
- Raw hex series colors — breaks both themes; use `var(--chart-N)`.
- Hand-rolling the KPI tile — `MetricCard` is the canonical tile (ADR 0012).
- Skipping the empty state when filters return zero rows.
