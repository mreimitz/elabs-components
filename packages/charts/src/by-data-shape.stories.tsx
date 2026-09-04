"use client";

/**
 * Charts / By data shape (RM-041).
 *
 * lieflat-charts (see `docs/review/2026-09-04-lieflat-charts-gap-analysis.md`)
 * is navigated by DATA SHAPE, not by component name — a reader looking for
 * "two time points per category" lands on the right template without ever
 * knowing it is called a dumbbell chart. The rest of this Storybook is
 * organised by package/component (`docs/STORYBOOK_GUIDELINES.md`), which is
 * right for maintainers and wrong for the "what chart do I need" moment.
 *
 * This file is that second index: one story per data shape, each rendering
 * the recommended `@elabs-ai/components-charts` container against a small
 * illustrative dataset, with the alternatives named in its docs description.
 * It renders every container this package ships from `charts/index.ts` at
 * least once (24, enumerated 2026-09-04) — it introduces NO new package
 * code, only new example compositions of existing exports.
 *
 * This is an INDEX, not a catalogue of variants — each container's own
 * `Charts/<Name>` story is still the place for its full API surface. Keep
 * this file to one story per data shape.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveMonotoneX, curveNatural } from "@visx/curve";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
// Vite/Storybook resolve JSON imports natively.
import worldAtlas from "world-atlas/countries-110m.json";

import { Area } from "./charts/area";
import { AreaChart } from "./charts/area-chart";
import { Bar } from "./charts/bar";
import { BarChart } from "./charts/bar-chart";
import { BarXAxis } from "./charts/bar-x-axis";
import { BumpChart } from "./charts/bump-chart";
import { Candlestick } from "./charts/candlestick";
import { CandlestickChart } from "./charts/candlestick-chart";
import { ChoroplethChart } from "./charts/choropleth/choropleth-chart";
import type {
  ChoroplethFeature,
  ChoroplethFeatureProperties,
} from "./charts/choropleth/choropleth-context";
import { ChoroplethFeature as ChoroplethFeatureComponent } from "./charts/choropleth/choropleth-feature";
import { ChoroplethTooltip } from "./charts/choropleth/choropleth-tooltip";
import { ComposedChart } from "./charts/composed-chart";
import { DistributionChart } from "./charts/distribution/distribution-chart";
import { DumbbellChart } from "./charts/dumbbell-chart";
import { FunnelChart } from "./charts/funnel-chart";
import { Gauge } from "./charts/gauge";
import { Grid } from "./charts/grid";
import { HeatmapChart } from "./charts/heatmap/heatmap-chart";
import { Line } from "./charts/line";
import { LineChart } from "./charts/line-chart";
import { LiveLine } from "./charts/live-line";
import { LiveLineChart } from "./charts/live-line-chart";
import { LiveXAxis } from "./charts/live-x-axis";
import { LiveYAxis } from "./charts/live-y-axis";
import { NetworkChart } from "./charts/network/network-chart";
import type { NetworkLinkDatum, NetworkNodeDatum } from "./charts/network/network-types";
import { ParallelCoordinatesChart } from "./charts/parallel-coordinates/parallel-coordinates-chart";
import type { ParallelCoordinatesDimension } from "./charts/parallel-coordinates/parallel-coordinates-chart";
import { PieChart } from "./charts/pie-chart";
import { RadarArea } from "./charts/radar-area";
import { RadarAxis } from "./charts/radar-axis";
import type { RadarData, RadarMetric } from "./charts/radar-context";
import { RadarChart } from "./charts/radar-chart";
import { RadarGrid } from "./charts/radar-grid";
import { RadarLabels } from "./charts/radar-labels";
import { Ring } from "./charts/ring";
import { RingCenter } from "./charts/ring-center";
import { RingChart } from "./charts/ring-chart";
import { SankeyChart } from "./charts/sankey/sankey-chart";
import { SankeyNode } from "./charts/sankey/sankey-node";
import { SankeyThreadLinks } from "./charts/sankey/sankey-threads";
import { SankeyTooltip } from "./charts/sankey/sankey-tooltip";
import { Scatter } from "./charts/scatter";
import { ScatterChart } from "./charts/scatter-chart";
import { SeriesBar } from "./charts/series-bar";
import { ChartTooltip } from "./charts/tooltip";
import type { TreeNode } from "./charts/tree-chart";
import { TreeChart } from "./charts/tree-chart";
import type { TreemapNode } from "./charts/treemap/treemap-layout";
import { TreemapChart } from "./charts/treemap/treemap-chart";
import { UnitChart } from "./charts/unit-chart";
import { WaterfallChart } from "./charts/waterfall-chart";
import type { WaterfallDatum } from "./charts/waterfall-chart";
import { XAxis } from "./charts/x-axis";

const meta: Meta = {
  title: "Charts/ByDataShape",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'One story per data shape, not per component — the answer to "what chart do I ' +
          "need for X\" without knowing a container's name first. Each story names its " +
          "recommended container and, in its own description, the alternatives that also fit " +
          "the shape. See `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §2 for the " +
          "full comparison table this index is drawn from.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function story(name: string, alternatives: string, node: React.ReactNode): Story {
  return {
    name,
    parameters: {
      docs: {
        description: {
          story: alternatives,
        },
      },
    },
    render: () => node,
  };
}

// ── Few categories, compare ─────────────────────────────────────────────────
const monthlyRevenue = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  { month: "Jun", revenue: 21200, profit: 8800 },
];

export const FewCategoriesCompare: Story = story(
  "Few categories, compare",
  "**BarChart** (grouped) is the recommended container. Alternatives: `UnitChart` " +
    'layout="row" when the unit itself carries meaning ("one rung = $1k"); `RadarChart` ' +
    "when comparing 3+ dimensions per category rather than one value.",
  <div className="h-72 w-[560px]">
    <BarChart data={monthlyRevenue} xDataKey="month">
      <Grid horizontal />
      <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
      <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  </div>,
);

// ── 100 % composition, counted ──────────────────────────────────────────────
const trafficSources = [
  { label: "Search", value: 41 },
  { label: "Direct", value: 35 },
  { label: "Referral", value: 12 },
  { label: "Social", value: 12 },
];

export const HundredPercentComposition: Story = story(
  "100% composition, counted",
  '**UnitChart** (`layout="waffle"`) is the recommended container — each dot is a stated ' +
    "unit, so the share reads as an arithmetic sentence, not a slice you have to measure. " +
    "Alternatives: `PieChart` / `RingChart` for a familiar silhouette when unit-counting " +
    "isn't the point.",
  <div className="h-72 w-[280px]">
    <UnitChart data={trafficSources} layout="waffle" unit={1} />
  </div>,
);

// ── Two time points per category ────────────────────────────────────────────
const onboardingSteps = [
  { step: "Sign up", before: 100, after: 100 },
  { step: "Verify email", before: 82, after: 94 },
  { step: "Add payment method", before: 41, after: 68 },
  { step: "Invite a teammate", before: 12, after: 39 },
  { step: "Ship first project", before: 19, after: 51 },
];

export const TwoTimePointsPerCategory: Story = story(
  "Two time points per category",
  "**DumbbellChart** is the recommended container — hollow (before) to filled (after) on " +
    "one line, so the change is the shape rather than a computed delta bar. Alternative: " +
    '`DumbbellChart variant="slope"` for a bipolar this-year-vs-last read; grouped `BarChart` ' +
    "when there are 3+ time points, not 2.",
  <div className="h-80 w-[640px]">
    <DumbbellChart
      beads={{ unit: 4 }}
      category="step"
      data={onboardingSteps}
      endKey="after"
      showDelta
      startKey="before"
    />
  </div>,
);

// ── Daily series over time ──────────────────────────────────────────────────
const dailyUsers = [
  { date: new Date("2024-01-01"), users: 1200, sessions: 3400 },
  { date: new Date("2024-02-01"), users: 1350, sessions: 3800 },
  { date: new Date("2024-03-01"), users: 1100, sessions: 3100 },
  { date: new Date("2024-04-01"), users: 1450, sessions: 4100 },
  { date: new Date("2024-05-01"), users: 1380, sessions: 3900 },
  { date: new Date("2024-06-01"), users: 1520, sessions: 4300 },
];

export const DailySeriesOverTime: Story = story(
  "Daily series over time",
  "**LineChart** is the recommended container. Alternatives: `AreaChart` when the " +
    "cumulative volume under the line matters as much as its shape; `LiveLineChart` once " +
    "the series is arriving in real time rather than settled.",
  <div className="h-72 w-[560px]">
    <LineChart aspectRatio={undefined} data={dailyUsers}>
      <Grid horizontal />
      <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  </div>,
);

// ── Composition over continuous time ────────────────────────────────────────
const deviceSplit = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 80 },
  { date: new Date("2024-02-01"), desktop: 305, mobile: 200 },
  { date: new Date("2024-03-01"), desktop: 237, mobile: 120 },
  { date: new Date("2024-04-01"), desktop: 73, mobile: 190 },
  { date: new Date("2024-05-01"), desktop: 209, mobile: 130 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 140 },
];

export const CompositionOverContinuousTime: Story = story(
  "Composition over continuous time",
  "**AreaChart** (stacked) is the recommended container. Alternative: a `HeatmapChart` " +
    'variant="calendar" when the composition is per-day counts across a whole year rather ' +
    "than a handful of stacked series.",
  <div className="h-72 w-[560px]">
    <AreaChart animationDuration={0} aspectRatio={undefined} data={deviceSplit}>
      <Grid horizontal />
      <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" fillOpacity={0.35} />
      <Area curve={curveNatural} dataKey="mobile" fill="var(--chart-2)" fillOpacity={0.35} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  </div>,
);

// ── Real-time series ─────────────────────────────────────────────────────────
const NOW_SEC = Math.floor(Date.now() / 1000);
const liveSample = Array.from({ length: 30 }, (_, i) => ({
  time: NOW_SEC - (29 - i),
  value: 60 + Math.sin(i / 4) * 18 + Math.cos(i / 2) * 6,
}));
const liveLatest = liveSample.at(-1)?.value ?? 60;

export const RealTimeSeries: Story = story(
  "Real-time series",
  "**LiveLineChart** is the recommended container — a fixed trailing window that scrolls " +
    "as new points arrive. Alternative: plain `LineChart` once the stream has settled into " +
    "static, already-collected data.",
  <div className="h-72 w-[560px]">
    <LiveLineChart data={liveSample} value={liveLatest} window={30}>
      <LiveLine curve={curveMonotoneX} dataKey="value" />
      <LiveXAxis />
      <LiveYAxis />
      <ChartTooltip />
    </LiveLineChart>
  </div>,
);

// ── Two linked series (input vs output) ─────────────────────────────────────
const revenueRunRate = [
  { date: new Date("2024-01-01"), revenue: 4200, runRate: 3800 },
  { date: new Date("2024-02-01"), revenue: 5100, runRate: 4600 },
  { date: new Date("2024-03-01"), revenue: 4800, runRate: 5200 },
  { date: new Date("2024-04-01"), revenue: 5500, runRate: 5000 },
  { date: new Date("2024-05-01"), revenue: 6100, runRate: 5700 },
  { date: new Date("2024-06-01"), revenue: 5800, runRate: 6200 },
];

export const TwoLinkedSeries: Story = story(
  "Two linked series (input vs output)",
  "**ComposedChart** is the recommended container — a bar, an area and a line on one shared " +
    "time scale. Alternative: two stacked `LineChart`s when the series live on genuinely " +
    "different scales and should not share one y-axis.",
  <div className="h-72 w-[560px]">
    <ComposedChart data={revenueRunRate}>
      <Grid horizontal />
      <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
      <Area curve={curveNatural} dataKey="runRate" fill="var(--chart-4)" fillOpacity={0.35} />
      <Line curve={curveNatural} dataKey="runRate" stroke="var(--chart-2)" />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  </div>,
);

// ── Rank over time ───────────────────────────────────────────────────────────
const quarterlyShare = [
  { quarter: "Q1", product: "Atlas", share: 28 },
  { quarter: "Q1", product: "Nimbus", share: 34 },
  { quarter: "Q1", product: "Forge", share: 19 },
  { quarter: "Q1", product: "Origin", share: 22 },
  { quarter: "Q2", product: "Atlas", share: 31 },
  { quarter: "Q2", product: "Nimbus", share: 30 },
  { quarter: "Q2", product: "Forge", share: 21 },
  { quarter: "Q2", product: "Origin", share: 20 },
  { quarter: "Q3", product: "Atlas", share: 35 },
  { quarter: "Q3", product: "Nimbus", share: 27 },
  { quarter: "Q3", product: "Forge", share: 23 },
  { quarter: "Q3", product: "Origin", share: 18 },
  { quarter: "Q4", product: "Atlas", share: 38 },
  { quarter: "Q4", product: "Nimbus", share: 25 },
  { quarter: "Q4", product: "Forge", share: 24 },
  { quarter: "Q4", product: "Origin", share: 15 },
];

export const RankOverTime: Story = story(
  "Rank over time",
  "**BumpChart** is the recommended container — rank, not raw value, is what's plotted, so " +
    "crossovers read as literal crossing lines. There is no supported alternative for this " +
    "shape; a bar-race animation was explicitly declined (see the gap-analysis §3).",
  <div className="h-72 w-[560px]">
    <BumpChart data={quarterlyShare} entity="product" period="quarter" valueKey="share" />
  </div>,
);

// ── Category × category + value ─────────────────────────────────────────────
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
function punchCard(): { day: string; hour: string; count: number }[] {
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const rows: { day: string; hour: string; count: number }[] = [];
  for (const day of WEEKDAYS) {
    const weekend = day === "Sat" || day === "Sun";
    for (const hour of HOURS) {
      const h = Number(hour);
      const office = h >= 8 && h <= 18 ? 1 : 0.12;
      const base = weekend ? 6 : 44;
      rows.push({ day, hour, count: Math.round(base * office * (0.55 + next() * 0.9)) });
    }
  }
  return rows;
}
const PUNCH_CARD = punchCard();

export const CategoryByCategoryMatrix: Story = story(
  "Category × category + value",
  '**HeatmapChart** (`mode="cell"`) is the recommended container. Alternative: ' +
    '`variant="calendar"` for the day-of-year special case (52 × 7 with month ticks); ' +
    '`mode="dot"` when cell density, not a filled colour, should carry the value.',
  <div className="w-[720px]">
    <HeatmapChart
      data={PUNCH_CARD}
      valueFormat="compact"
      valueKey="count"
      x="hour"
      xOrder={HOURS}
      y="day"
      yOrder={WEEKDAYS}
    />
  </div>,
);

// ── Single value progress ───────────────────────────────────────────────────
export const SingleValueProgress: Story = story(
  "Single value progress",
  "**Gauge** is the recommended container — a notched arc with milestone markers. " +
    "Alternative: `RingChart` (single ring) for a quieter, non-dashboard read.",
  <div className="h-56 w-[360px]">
    <Gauge centerValue={62} defaultLabel="Score" suffix="%" value={62} />
  </div>,
);

// ── 2-D scatter, few points ──────────────────────────────────────────────────
const sessionConversions = [
  { date: new Date("2024-01-01"), sessions: 420, conversions: 28 },
  { date: new Date("2024-02-01"), sessions: 510, conversions: 34 },
  { date: new Date("2024-03-01"), sessions: 390, conversions: 22 },
  { date: new Date("2024-04-01"), sessions: 580, conversions: 41 },
  { date: new Date("2024-05-01"), sessions: 620, conversions: 38 },
  { date: new Date("2024-06-01"), sessions: 710, conversions: 52 },
];

export const TwoDScatterFewPoints: Story = story(
  "2-D scatter ≤ 20 points",
  "**ScatterChart** is the recommended container. Alternative: `DistributionChart " +
    'kind="strip"` when the y-axis is categorical rather than a second numeric measure.',
  <div className="h-72 w-[560px]">
    <ScatterChart data={sessionConversions}>
      <Grid horizontal />
      <Scatter dataKey="sessions" />
      <Scatter dataKey="conversions" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  </div>,
);

// ── Distribution, record-level ──────────────────────────────────────────────
function seededRnd(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function replyTimes(n: number, seed: number, team: string, shape: (u: number) => number) {
  return Array.from({ length: n }, (_value, index) => ({
    id: `${team}-${index}`,
    team,
    minutes: Math.round(shape(seededRnd(index, seed)) * 10) / 10,
  }));
}
const REPLIES = [
  ...replyTimes(60, 3, "Support", (u) => 4 + u * u * 190),
  ...replyTimes(60, 11, "Billing", (u) => (u < 0.4 ? 95 + u * 70 : 6 + u * 34)),
  ...replyTimes(60, 23, "Onboarding", (u) => 3 + u * 26),
];

export const DistributionRecordLevel: Story = story(
  "Distribution, record-level",
  '**DistributionChart** (`kind="strip"`) is the recommended container for record-level ' +
    'jitter. Alternatives: `kind="histogram"` for a binned frequency count, `kind="box"` for ' +
    'the five-number summary, `kind="violin"` when the shape is bimodal and a box plot would ' +
    "hide it.",
  <div className="h-72 w-[640px]">
    <DistributionChart
      accessibleLabel="First-reply time by team"
      data={REPLIES}
      groupKey="team"
      kind="strip"
      valueFormat="number"
      valueKey="minutes"
    />
  </div>,
);

// ── Hierarchy, show membership ──────────────────────────────────────────────
const smallOrgChart: TreeNode = {
  name: "Engineering",
  children: [
    { name: "Platform", children: [{ name: "CI" }, { name: "Infra" }, { name: "Release" }] },
    {
      name: "Product",
      children: [{ name: "Onboarding" }, { name: "Billing" }, { name: "Search" }],
    },
  ],
};

export const HierarchyMembership: Story = story(
  "Hierarchy, show membership",
  "**TreeChart** is the recommended container — a left-to-right orthogonal tree, one node " +
    "per member. Alternative: `TreemapChart` when SIZE (a share of a total) matters more " +
    "than the membership lines themselves.",
  <div className="h-[280px] w-[420px] overflow-auto rounded-md border border-border">
    <TreeChart accessibleLabel="Engineering org chart" data={smallOrgChart} />
  </div>,
);

// ── Hierarchy + share of whole ──────────────────────────────────────────────
const whereTheWorkWent: TreemapNode = {
  name: "Work",
  children: [
    {
      name: "Platform",
      children: [
        { name: "CI", value: 40 },
        { name: "Infra", value: 30 },
        { name: "Release", value: 10 },
      ],
    },
    {
      name: "Product",
      children: [
        { name: "Onboarding", value: 25 },
        { name: "Billing", value: 15 },
        { name: "Search", value: 5 },
      ],
    },
  ],
};

export const HierarchyShare: Story = story(
  "Hierarchy + share of whole",
  "**TreemapChart** is the recommended container — area encodes value at every level. " +
    "Alternative: `TreeChart` when the membership LINES, not the relative size, are the " +
    "point.",
  <div className="h-[360px] w-[560px]">
    <TreemapChart
      accessibleDescription="Platform (CI, Infra, Release) and Product (Onboarding, Billing, Search)."
      accessibleLabel="Where the work went"
      data={whereTheWorkWent}
    />
  </div>,
);

// ── Same entities across many dimensions ────────────────────────────────────
const productDimensions: ParallelCoordinatesDimension[] = [
  { key: "price", label: "Price", format: "currency" },
  { key: "latency", label: "Latency (ms)" },
  { key: "nps", label: "NPS" },
];
const products = [
  { product: "Atlas", price: 49, latency: 180, nps: 32 },
  { product: "Beacon", price: 79, latency: 140, nps: 41 },
  { product: "Comet", price: 29, latency: 220, nps: 18 },
  { product: "Drift", price: 99, latency: 95, nps: 55 },
  { product: "Ember", price: 59, latency: 165, nps: 37 },
];

export const SameEntitiesManyDimensions: Story = story(
  "Same entities across many dimensions",
  "**ParallelCoordinatesChart** is the recommended container — one hairline per entity " +
    "across mixed-unit axes. Alternative: `RadarChart` when there are ≤ 6 entities and a " +
    "closed polar shape reads better than parallel hairlines.",
  <div className="h-80 w-[560px]">
    <ParallelCoordinatesChart
      accessibleLabel="Five products across price, latency and NPS"
      data={products}
      dimensions={productDimensions}
      entity="product"
    />
  </div>,
);

// ── OHLC ─────────────────────────────────────────────────────────────────────
const ohlcData = [
  { date: new Date("2024-01-02"), open: 100, high: 108, low: 98, close: 105 },
  { date: new Date("2024-01-03"), open: 105, high: 110, low: 102, close: 103 },
  { date: new Date("2024-01-04"), open: 103, high: 112, low: 101, close: 110 },
  { date: new Date("2024-01-05"), open: 110, high: 115, low: 107, close: 108 },
  { date: new Date("2024-01-08"), open: 108, high: 114, low: 106, close: 113 },
  { date: new Date("2024-01-09"), open: 113, high: 118, low: 109, close: 109 },
];

export const OHLC: Story = story(
  "OHLC",
  "**CandlestickChart** is the recommended container. There is no supported " +
    "alternative for this exact shape in this package.",
  <div className="h-72 w-[560px] rounded-lg border border-border bg-card p-4">
    <CandlestickChart data={ohlcData}>
      <Grid horizontal vertical />
      <Candlestick />
      <XAxis />
      <ChartTooltip />
    </CandlestickChart>
  </div>,
);

// ── Per-record routes ────────────────────────────────────────────────────────
const THREAD_SOURCES = Array.from({ length: 8 }, (_, i) => `Source ${i + 1}`);
const THREAD_PROCESSORS = Array.from({ length: 6 }, (_, i) => `Processor ${i + 1}`);
const THREAD_DESTINATIONS = Array.from({ length: 4 }, (_, i) => `Dest ${i + 1}`);
const THREAD_ROUTE_COUNT = 24;
const threadsData = {
  nodes: [
    ...THREAD_SOURCES.map((name) => ({ name, category: "source" as const })),
    ...THREAD_PROCESSORS.map((name) => ({ name, category: "landing" as const })),
    ...THREAD_DESTINATIONS.map((name) => ({ name, category: "outcome" as const })),
  ],
  links: Array.from({ length: THREAD_ROUTE_COUNT }, (_, i) => {
    const source = THREAD_SOURCES[i % THREAD_SOURCES.length] as string;
    const processor = THREAD_PROCESSORS[(i * 3 + 1) % THREAD_PROCESSORS.length] as string;
    const destination = THREAD_DESTINATIONS[(i * 5 + 2) % THREAD_DESTINATIONS.length] as string;
    return {
      source: 0,
      target: 0,
      value: 5 + ((i * 7) % 20),
      path: [source, processor, destination],
    };
  }),
};

export const PerRecordRoutes: Story = story(
  "Per-record routes (100+)",
  '**SankeyChart** (`mode="threads"`) is the recommended container — one polyline per ' +
    "record instead of one aggregated edge per node pair. Alternative: plain `SankeyChart` " +
    "(the default aggregate mode) once records collapse cleanly into a handful of flows — " +
    'see "Two-end aggregated flow" in `Charts/SankeyChart`.',
  <div className="h-72 w-[560px]">
    <SankeyChart aspectRatio="21 / 9" data={threadsData} mode="threads">
      <SankeyNode />
      <SankeyThreadLinks />
      <SankeyTooltip />
    </SankeyChart>
  </div>,
);

// ── Network of relationships ────────────────────────────────────────────────
const serviceNodes: NetworkNodeDatum[] = [
  { id: "gateway", label: "Gateway", value: 12, group: "Edge" },
  { id: "auth", label: "Auth", value: 9, group: "Core" },
  { id: "billing", label: "Billing", value: 7, group: "Core" },
  { id: "search", label: "Search", value: 8, group: "Core" },
  { id: "postgres", label: "Postgres", value: 14, group: "Data" },
  { id: "redis", label: "Redis", value: 5, group: "Data" },
];
const serviceLinks: NetworkLinkDatum[] = [
  { source: "gateway", target: "auth" },
  { source: "gateway", target: "search" },
  { source: "gateway", target: "billing" },
  { source: "auth", target: "postgres" },
  { source: "auth", target: "redis" },
  { source: "billing", target: "postgres" },
];

export const NetworkOfRelationships: Story = story(
  "Network ≤ 15 / 60 / 180 nodes",
  '**NetworkChart** (`layout="circular"` under ~15 nodes, `"force"` above) is the ' +
    "recommended container. Alternative: `SankeyChart` when the relationship is a directed " +
    "FLOW with an amount, not a symmetric link.",
  <div className="h-[360px] w-[560px]">
    <NetworkChart
      accessibleDescription="Six services in three groups, arranged on a ring."
      layout="circular"
      links={serviceLinks}
      nodes={serviceNodes}
    />
  </div>,
);

// ── Region shading ───────────────────────────────────────────────────────────
const topology = worldAtlas as unknown as Topology;
const VALUE_MAP: Record<string, number> = {
  "840": 334, // USA
  "124": 185, // Canada
  "826": 142, // UK
  "276": 210, // Germany
  "392": 220, // Japan
  "156": 412, // China
};
const worldFeatureCollection = feature(
  topology,
  topology.objects.countries as never,
) as unknown as FeatureCollection<Geometry, ChoroplethFeatureProperties>;
const worldData: ChoroplethFeature[] = worldFeatureCollection.features.map((f) => ({
  ...f,
  properties: {
    ...f.properties,
    value: VALUE_MAP[String(f.id)] ?? 0,
  },
})) as ChoroplethFeature[];

export const RegionShading: Story = story(
  "Region shading",
  "**ChoroplethChart** is the recommended container — offline TopoJSON, keyboard " +
    "navigable, tokened. There is no supported alternative for map-shaped data in this " +
    "package.",
  <div className="h-72 w-[560px]">
    <ChoroplethChart aspectRatio="16 / 9" data={worldData}>
      <ChoroplethFeatureComponent />
      <ChoroplethTooltip />
    </ChoroplethChart>
  </div>,
);

// ── Whole-to-part share, few categories ─────────────────────────────────────
const trafficData = [
  { label: "Direct", value: 320 },
  { label: "Search", value: 480 },
  { label: "Referral", value: 140 },
  { label: "Social", value: 90 },
];

export const WholeToPartShare: Story = story(
  "Whole-to-part share, few categories",
  "**PieChart** is the recommended container. Alternatives: `RingChart` for a centre-label " +
    'variant; `UnitChart layout="waffle"` when the reader should be able to COUNT the share ' +
    "rather than compare angles.",
  <div className="h-72 w-[560px]">
    <PieChart data={trafficData} size={280} />
  </div>,
);

// ── Progress against a target ───────────────────────────────────────────────
const ringData = [
  { label: "Email", value: 42, maxValue: 100 },
  { label: "Social", value: 28, maxValue: 100 },
  { label: "Direct", value: 18, maxValue: 100 },
  { label: "Other", value: 12, maxValue: 100 },
];

export const ProgressAgainstTarget: Story = story(
  "Progress against a target",
  "**RingChart** is the recommended container for several progress rings at once. " +
    "Alternative: `Gauge` for a single dashboard-style value with milestone markers.",
  <div className="h-72 w-[280px]">
    <RingChart data={ringData} strokeWidth={14}>
      {ringData.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
      <RingCenter defaultLabel="Channels" />
    </RingChart>
  </div>,
);

// ── Same entity across a few dimensions, radial ─────────────────────────────
const radarMetrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
  { key: "efficiency", label: "Efficiency" },
];
const radarData: RadarData[] = [
  {
    label: "Product A",
    values: { speed: 80, reliability: 70, comfort: 60, safety: 90, efficiency: 75 },
  },
];

export const SameEntityFewDimensionsRadial: Story = story(
  "Same entity across a few dimensions, radial",
  "**RadarChart** is the recommended container for ≤ 6 dimensions and ≤ ~4 entities. " +
    "Alternative: `ParallelCoordinatesChart` once dimension count or entity count grows past " +
    "what a closed polygon can read.",
  <div className="h-72 w-[560px]">
    <RadarChart animate={false} data={radarData} metrics={radarMetrics} size={288}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels fontSize={11} offset={20} />
      {radarData.map((_, i) => (
        <RadarArea index={i} key={i} />
      ))}
    </RadarChart>
  </div>,
);

// ── Funnel, stage-to-stage dropoff ──────────────────────────────────────────
const conversionFunnel = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 4800 },
  { label: "Activated", value: 2100 },
  { label: "Paid", value: 840 },
];

export const FunnelDropoff: Story = story(
  "Funnel, stage-to-stage dropoff",
  "**FunnelChart** is the recommended container. Alternative: `WaterfallChart` when the " +
    "steps ADD AND SUBTRACT (a bridge) rather than strictly narrow.",
  <div className="h-72 w-[560px]">
    <FunnelChart data={conversionFunnel} orientation="horizontal" showLabels showValues />
  </div>,
);

// ── Waterfall / bridge between totals ───────────────────────────────────────
const grossToNet: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { label: "COGS", value: -300 },
  { label: "Ops", value: -200 },
  { kind: "total", label: "Net", value: 400 },
];

export const WaterfallBridge: Story = story(
  "Waterfall / bridge between totals",
  "**WaterfallChart** is the recommended container — connectors hand off at the running " +
    "total, totals draw from zero, labels are signed. Alternative: `FunnelChart` when the " +
    "steps only ever shrink, never add back.",
  <div className="h-72 w-[560px]">
    <WaterfallChart accessibleLabel="Gross to net revenue bridge" data={grossToNet} />
  </div>,
);
