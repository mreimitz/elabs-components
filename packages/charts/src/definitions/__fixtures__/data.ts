/**
 * Shared fixture rows for the chart definitions (RM-175), moved here from the interaction
 * policy test (`charts/chart-interaction-policy.test.tsx`), which imports them back.
 * Deterministic: fixed dates and arithmetic values, no randomness.
 */

import type { OHLCDataPoint } from "../../charts/candlestick-chart";
import type { LiveLinePoint } from "../../charts/live-line-chart";
import type { WaterfallDatum } from "../../charts/waterfall-chart";

export const DAY = 86_400_000;
export const T0 = Date.UTC(2024, 0, 1);

/** Thirty daily rows with two measures. */
export const daily = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(T0 + i * DAY),
  revenue: 100 + ((i * 37) % 50),
  profit: 20 + ((i * 13) % 10),
}));

/** The daily rows as open, high, low and close prices. */
export const ohlc: OHLCDataPoint[] = daily.map((d, i) => ({
  date: d.date,
  open: 100 + i,
  high: 108 + i,
  low: 96 + i,
  close: 104 + i,
}));

/** Twelve named categories with one value each. */
export const categories = Array.from({ length: 12 }, (_, i) => ({
  name: `C${i + 1}`,
  value: 10 + i,
}));

/** One streamed point. */
export const LIVE_LINE_ROWS: LiveLinePoint[] = [{ time: 1, value: 3 }];

/** A gross-to-net bridge: two totals and two signed steps. */
export const WATERFALL_ROWS: WaterfallDatum[] = [
  { label: "Gross", value: 1000, kind: "total" },
  { label: "Refunds", value: -120 },
  { label: "Fees", value: -80 },
  { label: "Net", value: 800, kind: "total" },
];

// ── RM-176 ───────────────────────────────────────────────────────────────────

/** Three shares, summing to 100 — Pie/Ring/Unit slices. */
export const shares = [
  { label: "Direct", value: 45 },
  { label: "Referral", value: 30 },
  { label: "Search", value: 25 },
];

/** Two gauges of a value against a max — Ring. */
export const ringRows = [
  { label: "CPU", value: 62, maxValue: 100 },
  { label: "Memory", value: 80, maxValue: 100 },
];

/** A three-stage drop-off — Funnel. */
export const funnelRows = [
  { label: "Visited", value: 1000 },
  { label: "Signed up", value: 400 },
  { label: "Purchased", value: 120 },
];

/** One series across three metrics — Radar. */
export const radarMetrics = [
  { key: "quality", label: "Quality" },
  { key: "speed", label: "Speed" },
  { key: "cost", label: "Cost" },
];
export const radarRows = [{ label: "Plan A", values: { quality: 80, speed: 60, cost: 40 } }];

/** A small hierarchy — Treemap/Tree. */
export const treeHierarchy = {
  name: "root",
  children: [
    { name: "A", value: 40 },
    { name: "B", value: 60 },
  ],
};

/** A flow of three nodes, two links — Sankey. */
export const sankeyData = {
  nodes: [{ name: "Source" }, { name: "Mid" }, { name: "Sink" }],
  links: [
    { source: 0, target: 1, value: 10 },
    { source: 1, target: 2, value: 10 },
  ],
};

/** Three nodes, two links — Network. */
export const networkNodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
export const networkLinks = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
];

/** Three rows of four numeric dimensions — Parallel coordinates. */
export const parallelRows = [
  { model: "A", price: 20, mpg: 30, hp: 120, weight: 2800 },
  { model: "B", price: 28, mpg: 24, hp: 180, weight: 3200 },
  { model: "C", price: 35, mpg: 20, hp: 220, weight: 3600 },
];
export const parallelDimensions = [
  { key: "price", label: "Price" },
  { key: "mpg", label: "MPG" },
  { key: "hp", label: "Horsepower" },
  { key: "weight", label: "Weight" },
];

/** One square feature — Choropleth. */
export const choroplethData = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "Region A", value: 10 },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    },
  ],
};

/** A 2×2 grid — Heatmap. */
export const heatmapRows = [
  { day: "Mon", hour: "9am", count: 5 },
  { day: "Mon", hour: "10am", count: 8 },
  { day: "Tue", hour: "9am", count: 3 },
  { day: "Tue", hour: "10am", count: 6 },
];

/** Two tasks, one dependency — Gantt. */
export const ganttTasks = [
  { id: "t1", name: "Design", start: new Date(T0), end: new Date(T0 + 3 * DAY) },
  {
    id: "t2",
    name: "Build",
    start: new Date(T0 + 3 * DAY),
    end: new Date(T0 + 8 * DAY),
    dependencies: ["t1"],
  },
];

/** Twenty observations of one numeric column — Distribution/DensityScatter. */
export const distributionRows = Array.from({ length: 20 }, (_, i) => ({
  value: 10 + ((i * 7) % 40),
}));
export const densityRows = Array.from({ length: 20 }, (_, i) => ({
  x: i,
  y: (i * 13) % 20,
}));

/** Three categories, a before/after pair each — Dumbbell. */
export const dumbbellRows = [
  { category: "Q1", before: 10, after: 15 },
  { category: "Q2", before: 15, after: 12 },
  { category: "Q3", before: 12, after: 18 },
];

/** Two entities across three periods — Bump. */
export const bumpRows = [
  { period: "Q1", entity: "Flows", value: 10 },
  { period: "Q1", entity: "Charts", value: 20 },
  { period: "Q2", entity: "Flows", value: 25 },
  { period: "Q2", entity: "Charts", value: 15 },
  { period: "Q3", entity: "Flows", value: 30 },
  { period: "Q3", entity: "Charts", value: 18 },
];
