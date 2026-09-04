import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartCard } from "./chart-card";

const meta = {
  title: "Charts/ChartCard",
  component: ChartCard,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A simple tokenized bar chart used as a placeholder child — no charting lib needed. */
function PlaceholderBars({ bars }: { bars: { label: string; pct: number; colorClass: string }[] }) {
  return (
    <div className="flex h-full items-end gap-2 pb-4">
      {bars.map(({ label, pct, colorClass }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <div
            role="img"
            className={`w-full rounded-sm ${colorClass}`}
            style={{ height: `${pct}%` }}
            aria-label={`${label}: ${pct}%`}
          />
          <span className="text-meta text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

const sampleBars = [
  { label: "Jan", pct: 55, colorClass: "bg-chart-1" },
  { label: "Feb", pct: 72, colorClass: "bg-chart-1" },
  { label: "Mar", pct: 60, colorClass: "bg-chart-1" },
  { label: "Apr", pct: 85, colorClass: "bg-chart-1" },
  { label: "May", pct: 68, colorClass: "bg-chart-1" },
  { label: "Jun", pct: 90, colorClass: "bg-chart-1" },
];

export const Default: Story = {
  args: {
    title: "Monthly revenue",
    description: "Jan – Jun 2025",
  },
  render: (args) => (
    <div className="w-[480px]">
      <ChartCard {...args}>
        <PlaceholderBars bars={sampleBars} />
      </ChartCard>
    </div>
  ),
};

export const WithActions: Story = {
  render: () => (
    <div className="w-[480px]">
      <ChartCard
        title="Active sessions"
        description="Last 7 days"
        actions={
          <button className="rounded-md border border-border bg-surface px-2 py-1 text-meta text-muted-foreground hover:bg-surface-muted focus-ring">
            Export
          </button>
        }
      >
        <PlaceholderBars
          bars={[
            { label: "Mon", pct: 40, colorClass: "bg-chart-2" },
            { label: "Tue", pct: 65, colorClass: "bg-chart-2" },
            { label: "Wed", pct: 80, colorClass: "bg-chart-2" },
            { label: "Thu", pct: 55, colorClass: "bg-chart-2" },
            { label: "Fri", pct: 75, colorClass: "bg-chart-2" },
            { label: "Sat", pct: 30, colorClass: "bg-chart-2" },
            { label: "Sun", pct: 20, colorClass: "bg-chart-2" },
          ]}
        />
      </ChartCard>
    </div>
  ),
};

export const TallHeight: Story = {
  render: () => (
    <div className="w-[480px]">
      <ChartCard title="Quarterly pipeline" description="By stage" height={400}>
        <PlaceholderBars
          bars={[
            { label: "Prospect", pct: 95, colorClass: "bg-chart-3" },
            { label: "Qualified", pct: 70, colorClass: "bg-chart-3" },
            { label: "Proposal", pct: 45, colorClass: "bg-chart-3" },
            { label: "Closed", pct: 28, colorClass: "bg-chart-3" },
          ]}
        />
      </ChartCard>
    </div>
  ),
};

/** Loading vs ready (#268) — title/description keep rendering; the body becomes a skeleton. */
export const Loading: Story = {
  args: {
    title: "Monthly revenue",
    description: "Jan – Jun 2025",
    loading: true,
  },
  render: (args) => (
    <div className="w-[480px]">
      <ChartCard {...args}>
        <PlaceholderBars bars={sampleBars} />
      </ChartCard>
    </div>
  ),
};

/**
 * The card contract's fourth part (lieflat) — an attribution/provenance
 * footer, rendered all-caps and letter-spaced. `title` is the conclusion,
 * `description` is the legend in prose, `source` is where the data came from.
 */
export const WithSource: Story = {
  args: {
    title: "Revenue is up 8% quarter over quarter",
    description: "Monthly revenue, Jan – Jun 2025",
    source: "Source: Internal analytics, updated daily",
  },
  render: (args) => (
    <div className="w-[480px]">
      <ChartCard {...args}>
        <PlaceholderBars bars={sampleBars} />
      </ChartCard>
    </div>
  ),
};

export const TitleOnly: Story = {
  args: {
    title: "Deployment frequency",
    height: 200,
  },
  render: (args) => (
    <div className="w-[480px]">
      <ChartCard {...args}>
        <PlaceholderBars
          bars={[
            { label: "W1", pct: 50, colorClass: "bg-chart-4" },
            { label: "W2", pct: 80, colorClass: "bg-chart-4" },
            { label: "W3", pct: 30, colorClass: "bg-chart-4" },
            { label: "W4", pct: 90, colorClass: "bg-chart-4" },
          ]}
        />
      </ChartCard>
    </div>
  ),
};
