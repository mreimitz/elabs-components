"use client";
/**
 * The chart gallery's renders (metadata lives in `chart-tile-meta.ts`, which a server component
 * can read): one entry per chart container the charts package ships, each a
 * real render over the Ashgrove gallery fixtures (`content/fixtures/gallery.ts`). The home page
 * shows the `featured` ones; `/charts` shows all of them, grouped by the question they answer.
 * Compositions follow the package's own `Charts/ByDataShape` index, so a tile here is the same
 * code a reader finds in Storybook.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarXAxis,
  BulletChart,
  BumpChart,
  Candlestick,
  CandlestickChart,
  ChartTooltip,
  ComposedChart,
  DistributionChart,
  DumbbellChart,
  FunnelChart,
  Gauge,
  Grid,
  HeatmapChart,
  Line,
  LineChart,
  LiveLine,
  LiveLineChart,
  LiveXAxis,
  LiveYAxis,
  NetworkChart,
  ParallelCoordinatesChart,
  PieChart,
  PieSlice,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  Ring,
  RingCenter,
  RingChart,
  SankeyChart,
  SankeyNode,
  SankeyThreadLinks,
  SankeyTooltip,
  Scatter,
  ScatterChart,
  SeriesBar,
  TreeChart,
  TreemapChart,
  UnitChart,
  WaterfallChart,
  XAxis,
} from "@elabs-ai/components-charts";
import { galleryCopy } from "../../content/copy";
import {
  GALLERY_ARR_BRIDGE,
  GALLERY_ARR_TREE,
  GALLERY_ATTAINMENT,
  GALLERY_BOOKINGS,
  GALLERY_CHURN_BY_REGION,
  GALLERY_DAYS_TO_PAY,
  GALLERY_DEALS,
  GALLERY_FUNNEL,
  GALLERY_HEALTH,
  GALLERY_INVOICE_HEAT,
  GALLERY_INVOICE_ROUTES,
  GALLERY_LIVE_SEED,
  GALLERY_NET_NEW_ARR,
  GALLERY_OHLC,
  GALLERY_ORG_TREE,
  GALLERY_PLANS,
  GALLERY_PRODUCT_RANK,
  GALLERY_RENEWALS,
  GALLERY_RENEWALS_CLOSED,
  GALLERY_REVENUE_MIX,
  GALLERY_SERVICES,
} from "../../content/fixtures/gallery";

import type { ChartTileId } from "./chart-tile-meta";

const a11y = galleryCopy.charts.tiles;

/** A trailing-window stream: one new point a second, seeded from the fixture's shape. */
function LiveTile() {
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [points, setPoints] = useState(() =>
    GALLERY_LIVE_SEED.map((p) => ({ time: now + p.offset, value: p.value })),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setPoints((prev) => {
        const t = (prev.at(-1)?.time ?? now) + 1;
        const value = Math.round((60 + Math.sin(t / 4) * 18 + Math.cos(t / 2) * 6) * 10) / 10;
        return [...prev.slice(-59), { time: t, value }];
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [now]);
  return (
    <LiveLineChart
      accessibleLabel={a11y.live.label}
      data={points}
      value={points.at(-1)?.value ?? 0}
      window={30}
    >
      <LiveLine dataKey="value" />
      <LiveXAxis />
      <LiveYAxis />
      <ChartTooltip />
    </LiveLineChart>
  );
}

export const CHART_RENDERS: Record<ChartTileId, () => ReactNode> = {
  line: () => (
    <LineChart
      accessibleLabel={a11y.line.label}
      aspectRatio={undefined}
      data={GALLERY_CHURN_BY_REGION}
    >
      <Grid horizontal />
      <Line curve="monotone" dataKey="EMEA" stroke="var(--chart-1)" />
      <Line curve="monotone" dataKey="AMER" stroke="var(--chart-2)" />
      <Line curve="monotone" dataKey="APAC" stroke="var(--chart-3)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  ),
  area: () => (
    <AreaChart
      accessibleLabel={a11y.area.label}
      aspectRatio={undefined}
      data={GALLERY_CHURN_BY_REGION}
    >
      <Grid horizontal />
      <Area curve="monotone" dataKey="EMEA" fill="var(--chart-1)" fillOpacity={0.35} />
      <Area curve="monotone" dataKey="LATAM" fill="var(--chart-2)" fillOpacity={0.35} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  ),
  composed: () => (
    <ComposedChart accessibleLabel={a11y.composed.label} data={GALLERY_NET_NEW_ARR}>
      <Grid horizontal />
      <SeriesBar dataKey="netNew" fill="var(--chart-1)" />
      <Line curve="monotone" dataKey="trailing" stroke="var(--chart-2)" />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  ),
  live: () => <LiveTile />,
  candlestick: () => (
    <CandlestickChart accessibleLabel={a11y.candlestick.label} data={GALLERY_OHLC}>
      <Grid horizontal />
      <Candlestick />
      <XAxis />
      <ChartTooltip />
    </CandlestickChart>
  ),
  bump: () => (
    <BumpChart
      accessibleLabel={a11y.bump.label}
      data={GALLERY_PRODUCT_RANK}
      entity="product"
      period="month"
      valueKey="arr"
    />
  ),
  bar: () => (
    <BarChart accessibleLabel={a11y.bar.label} data={GALLERY_BOOKINGS} xDataKey="region">
      <Grid horizontal />
      <Bar dataKey="newBusiness" fill="var(--chart-1)" lineCap="round" />
      <Bar dataKey="expansion" fill="var(--chart-2)" fillStyle="hatch" lineCap="round" />
      <Bar dataKey="renewal" fill="var(--chart-3)" fillStyle="hatch" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  ),
  dumbbell: () => (
    <DumbbellChart
      accessibleLabel={a11y.dumbbell.label}
      category="region"
      data={GALLERY_RENEWALS}
      endKey="after"
      showDelta
      startKey="before"
    />
  ),
  waterfall: () => (
    <WaterfallChart accessibleLabel={a11y.waterfall.label} data={GALLERY_ARR_BRIDGE} />
  ),
  radar: () => (
    <div className="flex size-full items-center justify-center">
      <RadarChart
        accessibleLabel={a11y.radar.label}
        data={GALLERY_HEALTH.data}
        metrics={GALLERY_HEALTH.metrics}
        size={240}
      >
        <RadarGrid />
        <RadarAxis />
        <RadarLabels fontSize={11} offset={12} />
        {GALLERY_HEALTH.data.map((row, i) => (
          <RadarArea index={i} key={row.label} />
        ))}
      </RadarChart>
    </div>
  ),
  parallel: () => (
    <ParallelCoordinatesChart
      accessibleLabel={a11y.parallel.label}
      data={GALLERY_PLANS.rows}
      dimensions={GALLERY_PLANS.dimensions}
      entity="plan"
    />
  ),
  bullet: () => (
    <div className="flex size-full flex-col justify-center gap-5">
      {GALLERY_ATTAINMENT.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-meta text-muted-foreground">{row.label}</span>
          <div className="min-w-0 flex-1">
            <BulletChart
              bands={[
                { to: 60, label: a11y.bullet.bands.below },
                { to: 85, label: a11y.bullet.bands.near },
                { to: 110, label: a11y.bullet.bands.ahead },
              ]}
              labels={{ value: row.label }}
              max={110}
              target={100}
              value={row.value}
              valueFormat="number"
            />
          </div>
        </div>
      ))}
    </div>
  ),
  pie: () => (
    <div className="flex size-full items-center justify-center">
      <PieChart accessibleLabel={a11y.pie.label} data={GALLERY_REVENUE_MIX} size={208}>
        {GALLERY_REVENUE_MIX.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>
    </div>
  ),
  ring: () => (
    <div className="mx-auto h-full w-56">
      <RingChart accessibleLabel={a11y.ring.label} data={GALLERY_RENEWALS_CLOSED} strokeWidth={12}>
        {GALLERY_RENEWALS_CLOSED.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel={a11y.ring.center} />
      </RingChart>
    </div>
  ),
  unit: () => (
    <div className="mx-auto w-64">
      <UnitChart data={GALLERY_REVENUE_MIX} layout="waffle" unit={1} />
    </div>
  ),
  treemap: () => (
    <TreemapChart
      accessibleDescription={a11y.treemap.description}
      accessibleLabel={a11y.treemap.label}
      data={GALLERY_ARR_TREE}
      palette="categorical"
    />
  ),
  funnel: () => (
    <FunnelChart
      accessibleLabel={a11y.funnel.label}
      data={GALLERY_FUNNEL}
      orientation="horizontal"
      showLabels
      showValues
    />
  ),
  heatmap: () => (
    <HeatmapChart
      data={GALLERY_INVOICE_HEAT.rows}
      valueFormat="compact"
      valueKey="count"
      x="hour"
      xOrder={GALLERY_INVOICE_HEAT.hours}
      y="day"
      yOrder={GALLERY_INVOICE_HEAT.days}
    />
  ),
  scatter: () => (
    <ScatterChart accessibleLabel={a11y.scatter.label} data={GALLERY_DEALS}>
      <Grid horizontal />
      <Scatter dataKey="dealSize" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  ),
  strip: () => (
    <DistributionChart
      accessibleLabel={a11y.strip.label}
      data={GALLERY_DAYS_TO_PAY}
      groupKey="region"
      kind="strip"
      valueFormat="number"
      valueKey="days"
    />
  ),
  box: () => (
    <DistributionChart
      accessibleLabel={a11y.box.label}
      data={GALLERY_DAYS_TO_PAY}
      groupKey="region"
      kind="box"
      valueFormat="number"
      valueKey="days"
    />
  ),
  sankey: () => (
    <SankeyChart aspectRatio="21 / 9" data={GALLERY_INVOICE_ROUTES} mode="threads">
      <SankeyNode formatValue={a11y.sankey.value} />
      <SankeyThreadLinks />
      <SankeyTooltip />
    </SankeyChart>
  ),
  network: () => (
    <NetworkChart
      accessibleDescription={a11y.network.description}
      layout="circular"
      links={GALLERY_SERVICES.links}
      nodes={GALLERY_SERVICES.nodes}
    />
  ),
  tree: () => (
    <div className="size-full overflow-auto">
      <TreeChart accessibleLabel={a11y.tree.label} data={GALLERY_ORG_TREE} />
    </div>
  ),
  gauge: () => (
    <div className="mx-auto h-full w-72">
      <Gauge
        centerValue={GALLERY_ATTAINMENT[0]!.value}
        defaultLabel={a11y.gauge.center}
        minWidth={200}
        suffix="%"
        target={100}
        value={GALLERY_ATTAINMENT[0]!.value}
      />
    </div>
  ),
};
