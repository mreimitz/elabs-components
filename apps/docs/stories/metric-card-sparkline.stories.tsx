// Core / MetricCard — the `visual` slot, filled with a real @elabs-ai/components-charts chart.
//
// Cross-package composition story: `MetricCard` is owned by @elabs-ai/components-ui
// (ADR 0012) and @elabs-ai/components-charts re-exports it, so `packages/ui` may
// never import the chart that fills the slot — the dependency graph runs
// tokens → ui → charts, one way. An app CAN compose both, which is why this
// story lives in apps/docs and shares the `Core/MetricCard` title instead of
// standing up a second MetricCard entry in the sidebar (RM-005).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetricCard } from "@elabs-ai/components-ui";
import { Line, LineChart, MetricGrid } from "@elabs-ai/components-charts";

const meta = {
  title: "Core/MetricCard",
  component: MetricCard,
  // `label`/`value` are required props; the story renders a whole grid of tiles
  // from its own data, so these only satisfy the type.
  args: { label: "Monthly Revenue", value: "$84.2k" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const SPARK = [
  { date: new Date("2024-01-01"), v: 12 },
  { date: new Date("2024-02-01"), v: 18 },
  { date: new Date("2024-03-01"), v: 14 },
  { date: new Date("2024-04-01"), v: 22 },
  { date: new Date("2024-05-01"), v: 19 },
  { date: new Date("2024-06-01"), v: 27 },
  { date: new Date("2024-07-01"), v: 24 },
];

/** A tiny token-driven sparkline sized for the MetricCard `visual` slot. */
function Sparkline({ tone, seriesIndex }: { tone: string; seriesIndex: number }) {
  return (
    <div className="h-10 w-full">
      <LineChart
        data={SPARK}
        aspectRatio={undefined}
        margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
      >
        <Line dataKey="v" stroke={tone} strokeWidth={2} seriesIndex={seriesIndex} />
      </LineChart>
    </div>
  );
}

/**
 * The `visual` slot takes any node — here a real token-driven
 * `@elabs-ai/components-charts` mini-chart, so the KPI tile carries a sparkline
 * that themes with the rest of the system. (The full chart-backed tiles —
 * area/line/choropleth + hover-sync + trend badge — ship as copy-owned registry
 * blocks: `stat-card-*-01`.)
 */
export const WithSparkline: Story = {
  render: () => (
    <MetricGrid columns={2}>
      <MetricCard
        label="Monthly Revenue"
        value="$84.2k"
        description="Trailing 7 periods"
        delta="4.1%"
        deltaDirection="up"
        visual={<Sparkline tone="var(--chart-1)" seriesIndex={0} />}
      />
      <MetricCard
        label="Active Users"
        value="24,512"
        description="Trailing 7 periods"
        delta="12.4%"
        deltaDirection="up"
        visual={<Sparkline tone="var(--chart-2)" seriesIndex={1} />}
      />
    </MetricGrid>
  ),
};
