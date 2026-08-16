"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AutoChart } from "./auto-chart";
import type { ChartSpec } from "./chart-spec";

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
    const point = await canvas.findByRole("button", { name: /North.*50012102\.632741/ });
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

/** Unsupported type (not in Core-7) renders a ChartFallback. */
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
 * `@elabs/components-ai` Conversation/Message/Tool stack, keeping this story self-contained
 * within the `@elabs/components-charts` package (which does NOT depend on `@elabs/components-ai`).
 *
 * The REAL composition with `@elabs/components-ai`'s Conversation/Message/Tool/ToolOutput
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
