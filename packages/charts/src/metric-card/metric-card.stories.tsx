import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { MetricCard } from "@elabs/components-ui";
import { MetricGrid } from "../metric-grid";
import { Line } from "../charts/line";
import { LineChart } from "../charts/line-chart";

const meta = {
  title: "Charts/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A re-export of the canonical MetricCard owned by @elabs/components-ui (see Core/MetricCard, ADR 0012). " +
          "It is the *same* component — import from @elabs/components-charts when you are already in a charts " +
          "context, or from @elabs/components-ui otherwise. Don't fork a second KPI tile.",
      },
    },
  },
} satisfies Meta<typeof MetricCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const spark = [
  { date: new Date("2024-01-01"), v: 12 },
  { date: new Date("2024-02-01"), v: 18 },
  { date: new Date("2024-03-01"), v: 14 },
  { date: new Date("2024-04-01"), v: 22 },
  { date: new Date("2024-05-01"), v: 19 },
  { date: new Date("2024-06-01"), v: 27 },
  { date: new Date("2024-07-01"), v: 24 },
];

/** A tiny token-driven sparkline for the MetricCard `visual` slot. */
function Sparkline({
  tone = "var(--chart-1)",
  seriesIndex = 0,
}: {
  tone?: string;
  seriesIndex?: number;
}) {
  return (
    <div className="h-10 w-full">
      <LineChart
        data={spark}
        aspectRatio={undefined}
        margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
      >
        <Line
          dataKey="v"
          curve={curveNatural}
          stroke={tone}
          strokeWidth={2}
          seriesIndex={seriesIndex}
        />
      </LineChart>
    </div>
  );
}

export const Grid: Story = {
  render: () => (
    <MetricGrid>
      <MetricCard label="Active users" value="24,512" delta="12.4%" deltaDirection="up" />
      <MetricCard
        label="Churn"
        value="1.8%"
        delta="0.3%"
        deltaDirection="down"
        positiveIsGood={false}
      />
      <MetricCard label="MRR" value="$84.2k" delta="4.1%" deltaDirection="up" />
      <MetricCard
        label="Open tickets"
        value="37"
        delta="9"
        deltaDirection="up"
        positiveIsGood={false}
      />
    </MetricGrid>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <MetricGrid>
      <MetricCard
        label="Monthly Revenue"
        value="$84.2k"
        description="vs $80.9k last month"
        delta="4.1%"
        deltaDirection="up"
      />
      <MetricCard
        label="Active Users"
        value="24,512"
        description="7-day rolling average"
        delta="12.4%"
        deltaDirection="up"
      />
      <MetricCard
        label="Support Tickets"
        value="37"
        description="15 unassigned"
        delta="9"
        deltaDirection="up"
        positiveIsGood={false}
      />
      <MetricCard
        label="Churn Rate"
        value="1.8%"
        description="0.3 pp worse than target"
        delta="0.3%"
        deltaDirection="down"
        positiveIsGood={false}
      />
    </MetricGrid>
  ),
};

/**
 * The `visual` slot takes any node — here a real token-driven `@elabs/components-charts`
 * mini-chart, so the KPI tile carries a sparkline that themes with the rest of
 * the system. (The full chart-backed tiles — area/line/choropleth + hover-sync
 * + trend badge — ship as copy-owned registry blocks: `stat-card-*-01`.)
 */
export const ChartBacked: Story = {
  render: () => (
    <MetricGrid>
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
