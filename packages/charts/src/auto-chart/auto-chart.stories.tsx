"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { AutoChart } from "./auto-chart";
import type { ChartSpec, ChartType } from "./chart-spec";
import { explainChartType } from "./infer-chart-type";

const meta = {
  title: "Charts/AutoChart",
  component: AutoChart,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof AutoChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Shared data fixtures ──────────────────────────────────────────────────────

// Choropleth — RM-124: eight states, each row joined to the bundled map by its
// postal code. Cooling degree days, a normal-year figure per state.
const choroplethSpecData = [
  { state: "CA", cooling: 1_290 },
  { state: "TX", cooling: 2_980 },
  { state: "FL", cooling: 3_520 },
  { state: "NY", cooling: 780 },
  { state: "IL", cooling: 1_040 },
  { state: "GA", cooling: 2_210 },
  { state: "AZ", cooling: 4_130 },
  { state: "WA", cooling: 310 },
];

const temporalData = [
  { date: "2024-01-01", revenue: 12000, expenses: 8500 },
  { date: "2024-02-01", revenue: 15200, expenses: 9100 },
  { date: "2024-03-01", revenue: 14100, expenses: 8800 },
  { date: "2024-04-01", revenue: 18300, expenses: 10200 },
  { date: "2024-05-01", revenue: 21000, expenses: 11500 },
  { date: "2024-06-01", revenue: 19800, expenses: 10900 },
];

const categoricalData = [
  { quarter: "Q1", north: 42000, south: 31000, west: 27000 },
  { quarter: "Q2", north: 48000, south: 35000, west: 31000 },
  { quarter: "Q3", north: 52000, south: 40000, west: 36000 },
  { quarter: "Q4", north: 61000, south: 46000, west: 42000 },
];

const pieData = [
  { channel: "Direct", visits: 32000 },
  { channel: "Organic", visits: 28000 },
  { channel: "Referral", visits: 19000 },
  { channel: "Social", visits: 14000 },
  { channel: "Email", visits: 7000 },
];

const scatterData = [
  { spend: 10000, conversions: 420 },
  { spend: 14000, conversions: 580 },
  { spend: 9000, conversions: 380 },
  { spend: 18000, conversions: 720 },
  { spend: 22000, conversions: 890 },
  { spend: 16000, conversions: 640 },
  { spend: 11500, conversions: 490 },
];

const radarData = [
  { metric: "Speed", teamA: 85, teamB: 70 },
  { metric: "Accuracy", teamA: 90, teamB: 82 },
  { metric: "Efficiency", teamA: 75, teamB: 88 },
  { metric: "Quality", teamA: 92, teamB: 78 },
  { metric: "Innovation", teamA: 68, teamB: 95 },
];

const funnelData = [
  { stage: "Awareness", users: 10000 },
  { stage: "Interest", users: 6800 },
  { stage: "Consideration", users: 4200 },
  { stage: "Intent", users: 2100 },
  { stage: "Purchase", users: 980 },
];

// ── Stories ───────────────────────────────────────────────────────────────────

/** Line chart inferred from temporal x data (no explicit type). */
export const LineInferred: Story = {
  args: {
    spec: {
      // type omitted — AutoChart infers "line" from ISO date strings
      data: temporalData,
      x: "date",
      series: [
        { key: "revenue", label: "Revenue" },
        { key: "expenses", label: "Expenses" },
      ],
      title: "Monthly Revenue vs Expenses",
      description: "Revenue and expenses, Jan–Jun 2024.",
    } satisfies ChartSpec,
    height: 280,
  },
};

// Analytics — RM-138 / RM-139
/**
 * `spec.analytics` — the serialisable overlays an agent can ask for: here an
 * average line, the 25–75 percentile band and a linear trend with its r² in
 * the legend. No callbacks in a spec; `AutoChart` hands the list to the
 * container unchanged.
 */
export const WithAnalytics: Story = {
  args: {
    spec: {
      type: "line",
      data: temporalData,
      x: "date",
      series: [{ key: "revenue", label: "Revenue" }],
      title: "Monthly revenue, with statistics",
      legend: true,
      analytics: [
        { kind: "band", spread: { percentiles: [25, 75] }, id: "iqr" },
        { kind: "line", value: "mean", id: "mean" },
        { kind: "trend", id: "trend" },
      ],
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-analytic="mean"]')).not.toBeNull();
      expect(canvasElement.querySelector('[data-analytic="iqr"]')).not.toBeNull();
      expect(
        canvasElement.querySelector('[data-slot="analytic-series"][data-analytic="trend"]'),
      ).not.toBeNull();
    });
  },
};

/** Grouped bar chart with three regional series. */
export const BarGrouped: Story = {
  args: {
    spec: {
      type: "bar",
      data: categoricalData,
      x: "quarter",
      series: [
        { key: "north", label: "North" },
        { key: "south", label: "South" },
        { key: "west", label: "West" },
      ],
      title: "Sales by Region and Quarter",
      stacked: false,
    } satisfies ChartSpec,
    height: 280,
  },
};

/** Stacked bar chart — same data, stacked mode. */
export const BarStacked: Story = {
  args: {
    spec: {
      type: "bar",
      data: categoricalData,
      x: "quarter",
      series: [
        { key: "north", label: "North" },
        { key: "south", label: "South" },
        { key: "west", label: "West" },
      ],
      title: "Stacked Regional Sales",
      stacked: true,
    } satisfies ChartSpec,
    height: 280,
  },
};

/** Donut chart with a center hole. */
export const Donut: Story = {
  args: {
    spec: {
      type: "pie",
      data: pieData,
      x: "channel",
      series: [{ key: "visits", label: "Visits" }],
      title: "Traffic by Channel",
      donut: true,
    } satisfies ChartSpec,
    height: 280,
  },
};

/** Scatter chart with numeric x (ad spend vs conversions). */
export const Scatter: Story = {
  args: {
    spec: {
      type: "scatter",
      data: scatterData,
      x: "spend",
      xType: "number",
      series: [{ key: "conversions", label: "Conversions" }],
      title: "Ad Spend vs Conversions",
      legend: false,
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    // RM-127 (a-4): the rows are NOT sorted by spend, so tick rows chosen in
    // data order used to land two labels ~27 px apart and print through each
    // other. Ticks are picked by painted x now — no two label boxes may touch.
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="x-axis"] span').length).toBeGreaterThan(1),
    );
    const boxes = [...canvasElement.querySelectorAll('[data-slot="x-axis"] span')]
      .map((node) => node.getBoundingClientRect())
      .sort((a, b) => a.left - b.left);
    for (let i = 1; i < boxes.length; i++) {
      const previous = boxes[i - 1];
      const current = boxes[i];
      if (!previous || !current) continue;
      expect(current.left).toBeGreaterThan(previous.right);
    }
  },
};

/** Radar chart comparing two teams across five metrics. */
export const Radar: Story = {
  args: {
    spec: {
      type: "radar",
      data: radarData,
      x: "metric",
      series: [
        { key: "teamA", label: "Team A" },
        { key: "teamB", label: "Team B" },
      ],
      title: "Team Performance Radar",
      description: "Five performance metrics across two teams.",
    } satisfies ChartSpec,
    height: 280,
  },
};

/** Funnel chart showing a conversion pipeline. */
export const Funnel: Story = {
  args: {
    spec: {
      type: "funnel",
      data: funnelData,
      x: "stage",
      series: [{ key: "users", label: "Users" }],
      title: "Conversion Funnel",
      orientation: "horizontal",
    } satisfies ChartSpec,
    height: 280,
  },
};

/** Currency-formatted y-axis via the `valueFormat` hint (line chart). */
export const CurrencyFormatted: Story = {
  args: {
    spec: {
      type: "line",
      data: temporalData,
      x: "date",
      series: [
        { key: "revenue", label: "Revenue" },
        { key: "expenses", label: "Expenses" },
      ],
      title: "Revenue vs Expenses (USD)",
      valueFormat: "currency",
    } satisfies ChartSpec,
    height: 280,
  },
};

/**
 * Values are compacted on the axis and in the tooltip, so the exact figure has
 * to stay reachable: `AutoChart` defaults `copyValueOnActivate` to `true`, which
 * mounts the keyboard datapoint layer (real buttons OUTSIDE the aria-hidden
 * `<svg>`) and a persistent polite live region for the "copied" announcement.
 * Clicking or pressing Enter on a point copies its exact value.
 */
export const CopyExactValue: Story = {
  args: {
    spec: {
      type: "bar",
      data: [
        { region: "North", revenue: 50012102.632741 },
        { region: "South", revenue: 31448901.11 },
        { region: "West", revenue: 27004512.5 },
      ],
      x: "region",
      series: [{ key: "revenue", label: "Revenue" }],
      title: "Revenue by region",
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One tab stop for the whole chart, named per point — not 3 buttons in the
    // tab order, and not a focusable node inside the aria-hidden <svg>.
    const point = await canvas.findByRole("button", { name: /North.*50,012,102\.632741/ });
    point.focus();
    await expect(point).toHaveFocus();
    // The live region is mounted from first paint (ARIA22), empty until a copy.
    const status = canvasElement.querySelector('[role="status"][aria-live="polite"]');
    await expect(status).not.toBeNull();
  },
};

/**
 * `copyValueOnActivate={false}` opts the tile out entirely — no datapoint layer,
 * no live region, and the chart's DOM is what it was before the feature existed.
 */
export const CopyExactValueDisabled: Story = {
  args: {
    spec: {
      type: "bar",
      data: [
        { region: "North", revenue: 50012102.632741 },
        { region: "South", revenue: 31448901.11 },
      ],
      x: "region",
      series: [{ key: "revenue", label: "Revenue" }],
      title: "Revenue by region",
    } satisfies ChartSpec,
    height: 280,
    copyValueOnActivate: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /North/ })).toBeNull();
  },
};

/**
 * A type outside the `ChartType` union renders a `ChartFallback`. `sankey` is
 * one of the four shapes AutoChart deliberately never infers or renders — a
 * flat spec cannot express a node/link graph unambiguously, so it stays
 * explicit-container-only.
 *
 * The panel speaks to the reader (“This chart can’t be displayed.”) and is a
 * settled result, not a live region; the type name goes to a dev console
 * warning instead (#304).
 */
export const UnsupportedFallback: Story = {
  args: {
    spec: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately out-of-catalogue type so the story exercises ChartFallback
      type: "sankey" as any,
      data: categoricalData,
      x: "quarter",
      series: [{ key: "north", label: "North" }],
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    const fallback = canvasElement.querySelector('[data-slot="chart-fallback"]');
    await expect(fallback).toHaveAttribute("data-kind", "unsupported");
    await expect(fallback).toHaveTextContent("This chart can’t be displayed.");
    await expect(fallback).not.toHaveAttribute("aria-live");
    await expect(fallback?.textContent ?? "").not.toMatch(/sankey|supported/i);
  },
};

/** Empty data array renders a "No data to display" fallback. */
export const EmptyData: Story = {
  args: {
    spec: {
      data: [],
      x: "date",
      series: [{ key: "revenue", label: "Revenue" }],
    } satisfies ChartSpec,
    height: 280,
  },
};

/** Loading vs ready (#268) — a layout-shaped skeleton at the chart's normal height. */
export const Loading: Story = {
  args: {
    spec: {
      data: temporalData,
      x: "date",
      series: [{ key: "revenue", label: "Revenue" }],
    } satisfies ChartSpec,
    height: 280,
    loading: true,
  },
};

/**
 * InChatConversation — shows AutoChart embedded inside an AI tool-call output.
 *
 * Uses a minimal token-styled mock shell (plain divs) instead of the full
 * `@elabs-ai/components-ai` Conversation/Message/Tool stack, keeping this story self-contained
 * within the `@elabs-ai/components-charts` package (which does NOT depend on `@elabs-ai/components-ai`).
 *
 * The REAL composition with `@elabs-ai/components-ai`'s Conversation/Message/Tool/ToolOutput
 * components lives in the copy-owned `ai-chart` registry block
 * (`registry/blocks/ai-chart/`) — a registry block may import both siblings,
 * whereas a package (and therefore a package's story) may not. See
 * `research/ai-charts/01-ai-chart-integration-plan.md`.
 */
export const InChatConversation: Story = {
  render: () => {
    const chartSpec: ChartSpec = {
      type: "bar",
      data: [
        { month: "Jan", revenue: 42000 },
        { month: "Feb", revenue: 51000 },
        { month: "Mar", revenue: 47000 },
        { month: "Apr", revenue: 63000 },
      ],
      x: "month",
      series: [{ key: "revenue", label: "Revenue" }],
      title: "Monthly Revenue",
      legend: false,
    };

    return (
      <div className="mx-auto max-w-2xl space-y-3 rounded-lg border border-border bg-card p-4">
        {/* Simulated user message */}
        <div className="flex justify-end">
          <div className="max-w-xs rounded-lg bg-primary px-3 py-2 text-body text-primary-foreground">
            Show me the revenue trend for Q1 2024
          </div>
        </div>
        {/* Simulated assistant message with tool output */}
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-surface-muted px-3 py-2">
            <div className="mb-1 text-meta font-medium text-muted-foreground">
              Tool: generate_chart
            </div>
            <AutoChart spec={chartSpec} height={240} />
          </div>
          <div className="max-w-prose text-body text-foreground">
            Here is the monthly revenue for Q1 2024. Revenue grew steadily from $42K in January to
            $63K in April.
          </div>
        </div>
      </div>
    );
  },
  // No args needed — fully self-contained render
  args: {
    spec: {
      data: [],
      x: "month",
      series: [],
    },
  },
};

// ── RM-038: the thirteen new families, chosen by data shape ──────────────────
//
// Every story below omits `type`. The caption under each chart is the real
// `explainChartType(spec).reason` string, so the page shows WHY a picture was
// chosen, and the play function asserts the choice against the rendered DOM.

const inferenceCaptionId = "auto-chart-inference";

/**
 * One inference story: render the spec with no `type`, print the reason, and
 * assert in `play` that the shape really chose `expected` — and that the
 * rendered result is a chart rather than the fallback panel.
 */
function inferenceStory(spec: ChartSpec, expected: ChartType, rule: string): Story {
  return {
    args: { spec, height: 280 },
    render: (args) => {
      const explained = explainChartType(args.spec);
      return (
        <div className="flex flex-col gap-2">
          <AutoChart {...args} />
          <p className="text-meta text-muted-foreground" data-testid={inferenceCaptionId}>
            {explained.reason}
          </p>
        </div>
      );
    },
    play: async ({ canvasElement, args }) => {
      const canvas = within(canvasElement);
      const explained = explainChartType(args.spec);
      await expect(explained.type).toBe(expected);
      await expect(explained.rule).toBe(rule);
      // …and the page really says so, so a reason that never reached the DOM
      // cannot pass this story.
      const caption = await canvas.findByTestId(inferenceCaptionId);
      await expect(caption).toHaveTextContent(explained.reason);
      await expect(caption).toHaveTextContent(expected);
      // A type with no render branch would show the fallback message instead.
      await expect(canvasElement.querySelector('[data-slot="chart-fallback"]')).toBeNull();
    },
  };
}

/** Daily rows for the calendar story — a full year of one measure. */
const dailyCommits = Array.from({ length: 366 }, (_, i) => ({
  date: new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
  commits: (i * 7) % 11,
}));

/** OHLC columns on a date axis are candles, never a line. */
export const CandlestickInferred: Story = inferenceStory(
  {
    data: [
      { date: "2024-01-31", open: 112, high: 119, low: 110, close: 118 },
      { date: "2024-02-29", open: 118, high: 124, low: 116, close: 121 },
      { date: "2024-03-28", open: 121, high: 126, low: 118, close: 119 },
      { date: "2024-04-30", open: 119, high: 122, low: 114, close: 115 },
      { date: "2024-05-31", open: 115, high: 128, low: 113, close: 127 },
    ],
    x: "date",
    series: ["open", "high", "low", "close"],
    title: "ACME, monthly candles",
  },
  "candlestick",
  "ohlc",
);

/** A nested hierarchy is the one shape only a treemap can read. */
export const TreemapInferred: Story = inferenceStory(
  {
    data: [],
    x: "name",
    series: [],
    hierarchy: {
      name: "Cloud spend",
      children: [
        {
          name: "Compute",
          children: [
            { name: "EC2", value: 420 },
            { name: "Lambda", value: 90 },
          ],
        },
        {
          name: "Storage",
          children: [
            { name: "S3", value: 260 },
            { name: "Glacier", value: 40 },
          ],
        },
      ],
    },
    title: "Cloud spend by service",
  },
  "treemap",
  "hierarchy",
);

/**
 * `palette` on a treemap spec (#306): colour is a DATA encoding here —
 * `"categorical"` encodes the top-level group, `"sequential"` the leaf value,
 * `"mono"` (the default) nothing. Everything else about the spec is unchanged.
 */
export const TreemapPalette: Story = {
  args: {
    height: 280,
    spec: {
      type: "treemap",
      data: [],
      x: "name",
      series: [],
      palette: "categorical",
      hierarchy: {
        name: "Cloud spend",
        children: [
          {
            name: "Compute",
            children: [
              { name: "EC2", value: 420 },
              { name: "Lambda", value: 90 },
            ],
          },
          {
            name: "Storage",
            children: [
              { name: "S3", value: 260 },
              { name: "Glacier", value: 40 },
            ],
          },
        ],
      },
      title: "Cloud spend by service",
    },
  },
  play: async ({ canvasElement }) => {
    const leaves = await waitFor(() => {
      const found = canvasElement.querySelectorAll("[data-treemap-leaf-id]");
      if (found.length !== 4) {
        throw new Error("treemap leaves not laid out yet");
      }
      return Array.from(found);
    });
    // Categorical: one fill per top-level group, never the mono single shade.
    await expect(new Set(leaves.map((leaf) => leaf.getAttribute("fill"))).size).toBe(2);
  },
};

/**
 * Long `(period, entity, rank)` rows DECLARED as a ranking. Without the
 * declaration the identical shape reads as a heatmap — the two cannot be told
 * apart structurally, which is why the ranking rule runs first and asks for a
 * signal.
 */
export const BumpInferred: Story = inferenceStory(
  {
    data: [
      { quarter: "Q1", team: "Alpha", rank: 1 },
      { quarter: "Q1", team: "Beta", rank: 2 },
      { quarter: "Q1", team: "Gamma", rank: 3 },
      { quarter: "Q2", team: "Alpha", rank: 3 },
      { quarter: "Q2", team: "Beta", rank: 1 },
      { quarter: "Q2", team: "Gamma", rank: 2 },
      { quarter: "Q3", team: "Alpha", rank: 2 },
      { quarter: "Q3", team: "Beta", rank: 3 },
      { quarter: "Q3", team: "Gamma", rank: 1 },
    ],
    x: "quarter",
    series: ["rank"],
    title: "Team standings by quarter",
  },
  "bump",
  "ranking",
);

/** A year of dated rows is more days than a line can resolve. */
export const CalendarInferred: Story = inferenceStory(
  { data: dailyCommits, x: "date", series: ["commits"], title: "Commits, 2024" },
  "calendar",
  "calendar",
);

/** Stacked bands over time read as a streamgraph, not as lines. */
export const StreamInferred: Story = inferenceStory(
  {
    data: [
      { date: "2024-01-01", mobile: 12, desktop: 20, tablet: 6 },
      { date: "2024-02-01", mobile: 18, desktop: 19, tablet: 7 },
      { date: "2024-03-01", mobile: 24, desktop: 17, tablet: 5 },
      { date: "2024-04-01", mobile: 30, desktop: 16, tablet: 4 },
      { date: "2024-05-01", mobile: 34, desktop: 15, tablet: 6 },
    ],
    x: "date",
    series: ["mobile", "desktop", "tablet"],
    stacked: true,
    title: "Sessions by device",
  },
  "stream",
  "stream",
);

/** Two categorical keys and one measure make a matrix, whatever the row count. */
export const HeatmapInferred: Story = inferenceStory(
  {
    data: [
      { day: "Mon", hour: "09", visits: 12 },
      { day: "Mon", hour: "12", visits: 30 },
      { day: "Mon", hour: "17", visits: 22 },
      { day: "Tue", hour: "09", visits: 9 },
      { day: "Tue", hour: "12", visits: 34 },
      { day: "Tue", hour: "17", visits: 26 },
      { day: "Wed", hour: "09", visits: 15 },
      { day: "Wed", hour: "12", visits: 28 },
      { day: "Wed", hour: "17", visits: 31 },
    ],
    x: "day",
    series: ["visits"],
    title: "Visits by weekday and hour",
  },
  "heatmap",
  "matrix",
);

/** Two measures whose names read as before/after are one measure twice. */
export const DumbbellInferred: Story = inferenceStory(
  {
    data: [
      { region: "North", before: 42, after: 61 },
      { region: "South", before: 31, after: 46 },
      { region: "West", before: 27, after: 42 },
      { region: "East", before: 38, after: 35 },
    ],
    x: "region",
    series: [
      { key: "before", label: "before" },
      { key: "after", label: "after" },
    ],
    title: "Coverage before and after rollout",
  },
  "dumbbell",
  "before-after",
);

/** A bare column of observations has no category to plot against. */
export const HistogramInferred: Story = inferenceStory(
  {
    data: Array.from({ length: 120 }, (_, i) => ({ ms: 80 + ((i * 37) % 420) })),
    x: "ms",
    series: ["ms"],
    title: "Response time",
  },
  "histogram",
  "distribution-histogram",
);

/** Few enough records per group and every one can still be drawn. */
export const StripInferred: Story = inferenceStory(
  {
    data: Array.from({ length: 60 }, (_, i) => ({
      cohort: ["A", "B", "C"][i % 3] as string,
      ms: 90 + ((i * 53) % 380),
    })),
    x: "cohort",
    series: ["ms"],
    group: "cohort",
    title: "Response time by cohort",
  },
  "strip",
  "distribution-strip",
);

/** Past ~200 records a group, the summary reads better than the records. */
export const BoxInferred: Story = inferenceStory(
  {
    data: Array.from({ length: 900 }, (_, i) => ({
      cohort: ["A", "B", "C"][i % 3] as string,
      ms: 90 + ((i * 53) % 380),
    })),
    x: "cohort",
    series: ["ms"],
    group: "cohort",
    title: "Response time by cohort",
  },
  "box",
  "distribution-box",
);

/**
 * A total/net/gross checkpoint row makes these deltas rather than categories —
 * and it outranks the diverging rule, which this same data also satisfies.
 */
export const WaterfallInferred: Story = inferenceStory(
  {
    data: [
      { stage: "Gross revenue", value: 480 },
      { stage: "Discounts", value: -60 },
      { stage: "Refunds", value: -25 },
      { stage: "Net total", value: 395 },
    ],
    x: "stage",
    series: ["value"],
    title: "Gross to net",
  },
  "waterfall",
  "steps",
);

/** A single measure that crosses zero: the baseline is the story. */
export const DivergingBarInferred: Story = inferenceStory(
  {
    data: [
      { region: "North", change: 12 },
      { region: "South", change: -8 },
      { region: "West", change: 4 },
      { region: "East", change: -3 },
      { region: "Central", change: 9 },
    ],
    x: "region",
    series: [{ key: "change", label: "Change" }],
    title: "Year-on-year change",
  },
  "diverging-bar",
  "signed",
);

/**
 * The same shares that would draw a pie draw countable marks instead once the
 * spec asks for the editorial register — `emphasis: "editorial"` is the only
 * difference between this story and a pie.
 */
export const UnitInferred: Story = inferenceStory(
  {
    data: [
      { mode: "Cycled", share: 41 },
      { mode: "Walked", share: 35 },
      { mode: "Drove", share: 12 },
      { mode: "Bus", share: 12 },
    ],
    x: "mode",
    series: ["share"],
    emphasis: "editorial",
    title: "How people got to work",
  },
  "unit",
  "waffle",
);

/**
 * A series known only by its column key (no `label`) is NOT end-labelled
 * (RM-110), so the legend engine's default shows a legend — forwarded
 * through `spec.legend` into `LineChart`'s own `legend` prop
 * (`LEGEND_ENGINE_TYPES`), never a second, `AutoChart`-owned implementation.
 * The rendered `.legend-container` is byte-identical to an explicit
 * `<LineChart legend>` built from the same normalized series (see
 * `auto-chart.test.tsx`'s "renders the identical legend DOM…" test, and
 * `LineChart`'s own `LegendToggle` story for the equivalent explicit call).
 */
export const LineLegendFromColumnKeys: Story = {
  args: {
    spec: {
      type: "line",
      data: [
        { date: "2024-01-01", ebikes: 10, cargo: 4 },
        { date: "2024-02-01", ebikes: 14, cargo: 6 },
        { date: "2024-03-01", ebikes: 19, cargo: 9 },
      ],
      x: "date",
      series: [{ key: "ebikes" }, { key: "cargo" }],
    } satisfies ChartSpec,
    height: 280,
  },
};

/**
 * `ChartSpec.facet` (RM-120) splits one line spec into a grid, one panel per
 * `region` — and `legend: true` (RM-118) shows ONE shared `Chart legend`
 * above the whole grid, not one per panel and not the old per-chart
 * `AutoLegend` a faceted spec briefly lost across the wave-2 branch merge.
 */
export const LineFacetedLegend: Story = {
  args: {
    spec: {
      type: "line",
      data: [
        { date: "2024-01-01", region: "North", revenue: 12000, expenses: 8500 },
        { date: "2024-02-01", region: "North", revenue: 15200, expenses: 9100 },
        { date: "2024-03-01", region: "North", revenue: 14100, expenses: 8800 },
        { date: "2024-01-01", region: "South", revenue: 9000, expenses: 6200 },
        { date: "2024-02-01", region: "South", revenue: 10400, expenses: 6800 },
        { date: "2024-03-01", region: "South", revenue: 9700, expenses: 6500 },
      ],
      x: "date",
      series: [{ key: "revenue" }, { key: "expenses" }],
      facet: { by: "region" },
      legend: true,
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = await waitFor(() => canvas.getAllByRole("group", { name: "Chart legend" }));
    await expect(groups).toHaveLength(1);
    const legend = groups[0];
    await expect(within(legend).getByText("revenue")).toBeInTheDocument();
    await expect(within(legend).getByText("expenses")).toBeInTheDocument();

    // Browser proof (RM-118 x RM-120 regression fix): the legend box sits
    // above the grid box, not beside or inside it.
    const grid = canvasElement.querySelector('[data-slot="chart-multiples"]');
    if (!grid) throw new Error("expected the ChartMultiples grid to be present");
    const legendBox = legend.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    console.log(
      "[RM-118 facet legend proof]",
      JSON.stringify({
        legendRootCount: groups.length,
        itemTexts: Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent),
        legendBox: { top: legendBox.top, bottom: legendBox.bottom, height: legendBox.height },
        gridBox: { top: gridBox.top, bottom: gridBox.bottom, height: gridBox.height },
      }),
    );
    await expect(legendBox.bottom).toBeLessThanOrEqual(gridBox.top);
  },
};

/**
 * RM-118 Part B × RM-120, sitting 2: `bar` joined `LEGEND_ENGINE_TYPES` this
 * wave, so a faceted bar spec gets the same fix as `LineFacetedLegend` above —
 * ONE shared `Chart legend` over the whole grid, never one per panel.
 */
export const BarFacetedLegend: Story = {
  args: {
    spec: {
      type: "bar",
      data: [
        { quarter: "Q1", region: "North", revenue: 40, profit: 12 },
        { quarter: "Q2", region: "North", revenue: 44, profit: 14 },
        { quarter: "Q3", region: "North", revenue: 47, profit: 15 },
        { quarter: "Q1", region: "South", revenue: 30, profit: 9 },
        { quarter: "Q2", region: "South", revenue: 33, profit: 10 },
        { quarter: "Q3", region: "South", revenue: 35, profit: 11 },
      ],
      x: "quarter",
      series: [{ key: "revenue" }, { key: "profit" }],
      facet: { by: "region" },
      legend: true,
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = await waitFor(() => canvas.getAllByRole("group", { name: "Chart legend" }));
    await expect(groups).toHaveLength(1);
    const legend = groups[0];
    await expect(within(legend).getByText("revenue")).toBeInTheDocument();
    await expect(within(legend).getByText("profit")).toBeInTheDocument();

    // Browser proof: the legend box sits above the grid box, not beside,
    // inside, or duplicated per panel.
    const grid = canvasElement.querySelector('[data-slot="chart-multiples"]');
    if (!grid) throw new Error("expected the ChartMultiples grid to be present");
    const legendBox = legend.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    console.log(
      "[RM-118 Part B facet legend proof]",
      JSON.stringify({
        legendRootCount: groups.length,
        itemTexts: Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent),
        legendBox: { top: legendBox.top, bottom: legendBox.bottom, height: legendBox.height },
        gridBox: { top: gridBox.top, bottom: gridBox.bottom, height: gridBox.height },
      }),
    );
    await expect(legendBox.bottom).toBeLessThanOrEqual(gridBox.top);
    await expect(grid.querySelectorAll('[role="group"][aria-label="Chart legend"]')).toHaveLength(
      0,
    );
  },
};

/**
 * RM-118 Part B × RM-120, sitting 2 (fix round 1, item 3): the pie half of
 * `BarFacetedLegend` above — same ONE-shared-`Chart legend`-over-the-grid
 * treatment, but the items must be the slice CATEGORIES (deduped across
 * panels via `pieRows`, the same source the retired `<AutoLegend>` used),
 * never the value column and never one legend per panel. This is the exact
 * regression class the sitting-2 `legendItems`-not-`series` fix in
 * `auto-chart.tsx` guards — see the matching unit tests in
 * `auto-chart.test.tsx`'s "AutoChart faceted pie legend" block.
 */
export const PieFacetedLegend: Story = {
  args: {
    spec: {
      type: "pie",
      data: [
        { region: "North", channel: "Direct", share: 42 },
        { region: "North", channel: "Organic", share: 33 },
        { region: "North", channel: "Referral", share: 25 },
        { region: "South", channel: "Direct", share: 38 },
        { region: "South", channel: "Organic", share: 36 },
        { region: "South", channel: "Referral", share: 26 },
      ],
      x: "channel",
      series: ["share"],
      facet: { by: "region" },
      legend: true,
    } satisfies ChartSpec,
    height: 280,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = await waitFor(() => canvas.getAllByRole("group", { name: "Chart legend" }));
    await expect(groups).toHaveLength(1);
    const legend = groups[0];
    await expect(within(legend).getByText("Direct")).toBeInTheDocument();
    await expect(within(legend).getByText("Organic")).toBeInTheDocument();
    await expect(within(legend).getByText("Referral")).toBeInTheDocument();
    // Never the value column, and never one row per panel (would be 6, not 3).
    await expect(within(legend).queryByText("share")).not.toBeInTheDocument();
    await expect(legend.querySelectorAll(":scope > *")).toHaveLength(3);

    // Browser proof: the legend box sits above the grid box, not beside,
    // inside, or duplicated per panel.
    const grid = canvasElement.querySelector('[data-slot="chart-multiples"]');
    if (!grid) throw new Error("expected the ChartMultiples grid to be present");
    const legendBox = legend.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    console.log(
      "[RM-118 Part B pie facet legend proof]",
      JSON.stringify({
        legendRootCount: groups.length,
        itemTexts: Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent),
        legendBox: { top: legendBox.top, bottom: legendBox.bottom, height: legendBox.height },
        gridBox: { top: gridBox.top, bottom: gridBox.bottom, height: gridBox.height },
      }),
    );
    await expect(legendBox.bottom).toBeLessThanOrEqual(gridBox.top);
    await expect(grid.querySelectorAll('[role="group"][aria-label="Chart legend"]')).toHaveLength(
      0,
    );
  },
};

// Dual-axis — RM-121
const dualAxisSpecData = [
  { month: "2024-01-01", orders: 182, conversion: 2.4 },
  { month: "2024-02-01", orders: 236, conversion: 3.1 },
  { month: "2024-03-01", orders: 311, conversion: 3.6 },
  { month: "2024-04-01", orders: 287, conversion: 4.2 },
  { month: "2024-05-01", orders: 402, conversion: 5.3 },
  { month: "2024-06-01", orders: 468, conversion: 6.1 },
];

/** Tick label rows (px, from each tick's own `top`) of the value axis on `side`. */
function dualAxisTickRows(root: HTMLElement, side: "left" | "right"): number[] {
  const axis = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="y-axis"]')).find((el) => {
    const column = el.firstElementChild as HTMLElement | null;
    return side === "left" ? column?.style.left === "0px" : column?.style.right === "0px";
  });
  return Array.from(axis?.querySelectorAll<HTMLElement>(":scope > div > div") ?? []).map((tick) =>
    Math.round(Number.parseFloat(tick.style.top)),
  );
}

/**
 * `type: "dual-axis"`: order counts as columns on the left scale, the
 * conversion rate as a line on the right. `axes.y2.align: "ticks"` puts both
 * scales on the same gridlines; the legend splits by side and the tooltip is
 * a table with a header per axis.
 */
export const DualAxisSpec: Story = {
  args: {
    spec: {
      type: "dual-axis",
      data: dualAxisSpecData,
      x: "month",
      series: [
        { key: "orders", label: "Orders", mark: "column" },
        { key: "conversion", label: "Conversion", axis: "right" },
      ],
      axes: { y2: { align: "ticks", title: "Conversion rate, %" } },
      title: "Orders and conversion rate",
      description:
        "Monthly orders (left scale) and conversion rate in percent (right scale), January to June 2024.",
    } satisfies ChartSpec,
    plotHeight: 280,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const left = dualAxisTickRows(canvasElement, "left");
      expect(left.length).toBeGreaterThanOrEqual(3);
      expect(dualAxisTickRows(canvasElement, "right")).toEqual(left);
    });
    const rows = canvasElement.querySelectorAll('[data-slot="chart-legend-split-row"]');
    await expect(rows).toHaveLength(2);
    await expect(rows[0]).toHaveTextContent("Left scale");
    await expect(rows[1]).toHaveTextContent("Right scale");
    // a-3: a column is a band, not a point. Centred on a point scale the first
    // and last bar hung 29.3 px outside the plot at 900 px, which also gave
    // the page a 23 px horizontal scrollbar and printed the axis ticks over
    // the bar fill. No bar may leave the plot's own box.
    const plot = canvasElement.querySelector("svg")?.getBoundingClientRect();
    await expect(plot).toBeDefined();
    const bars = [...canvasElement.querySelectorAll(".series-bar rect")];
    await expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      const box = bar.getBoundingClientRect();
      await expect(box.left).toBeGreaterThanOrEqual((plot?.left ?? 0) - 0.5);
      await expect(box.right).toBeLessThanOrEqual((plot?.right ?? 0) + 0.5);
    }
  },
};

/** A dual-axis spec with no line series cannot be drawn honestly: `ChartFallback` says so. */
export const DualAxisSpecWithoutLine: Story = {
  args: {
    spec: {
      type: "dual-axis",
      data: dualAxisSpecData,
      x: "month",
      series: [
        { key: "orders", label: "Orders", mark: "column" },
        { key: "conversion", label: "Conversion", mark: "area", axis: "right" },
      ],
      title: "Orders and conversion rate",
    } satisfies ChartSpec,
    plotHeight: 280,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-kind="unsupported"]')).not.toBeNull();
  },
};

/**
 * `type: "choropleth"`: the rows join the bundled US-states map on their
 * postal code, and a stepped quantile scale gives every class the same number
 * of states. The map is fetched only when a spec names one, so a bar-chart
 * spec never pays for it. At the narrow tier the colour key moves below the
 * map and the place names step aside.
 */
export const ChoroplethSpec: Story = {
  args: {
    spec: {
      type: "choropleth",
      geo: "us-states",
      match: { row: "state", feature: "id" },
      data: choroplethSpecData,
      x: "state",
      series: [{ key: "cooling", label: "Cooling degree days" }],
      scale: { type: "stepped", method: "quantile", steps: 4 },
      labels: { places: { key: "name", max: 8 } },
      title: "Cooling demand by state",
      description: "Cooling degree days in a normal year, eight states, four quantile classes.",
    } satisfies ChartSpec,
    plotHeight: 280,
  },
  play: async ({ canvasElement }) => {
    // The fixture is a dynamic import: the first paint is the status region.
    await waitFor(() =>
      expect(canvasElement.querySelectorAll(".choropleth-features path").length).toBeGreaterThan(
        10,
      ),
    );
    const plot = canvasElement.querySelector("[data-chart-breakpoint]");
    const tier = plot?.getAttribute("data-chart-breakpoint");
    const legend = canvasElement.querySelector("[data-legend-position]");
    await expect(legend).not.toBeNull();
    if (tier === "narrow") {
      // Narrow: the key sits below the map, and no name is painted over it.
      await expect(legend).toHaveAttribute("data-legend-position", "below");
      await expect(
        canvasElement.querySelectorAll('[data-slot="choropleth-place-label"]'),
      ).toHaveLength(0);
    } else {
      await expect(legend?.getAttribute("data-legend-position")).not.toBe("below");
      await expect(
        canvasElement.querySelectorAll('[data-slot="choropleth-place-label"]').length,
      ).toBeGreaterThan(0);
    }
  },
};

/** A choropleth spec with no map cannot be drawn: `ChartFallback` says so. */
export const ChoroplethSpecWithoutMap: Story = {
  args: {
    spec: {
      type: "choropleth",
      match: { row: "state", feature: "id" },
      data: choroplethSpecData,
      x: "state",
      series: [{ key: "cooling", label: "Cooling degree days" }],
      title: "Cooling demand by state",
    } satisfies ChartSpec,
    plotHeight: 280,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-kind="unsupported"]')).not.toBeNull();
  },
};
