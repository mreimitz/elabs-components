import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetricCard } from "../metric-card";
import { MetricGrid } from "./metric-grid";

const meta = {
  title: "Charts/MetricGrid",
  component: MetricGrid,
  tags: ["autodocs"],
} satisfies Meta<typeof MetricGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <MetricGrid>
      <MetricCard label="Active users" value="24,512" delta="12.4%" deltaDirection="up" />
      <MetricCard label="MRR" value="$84.2k" delta="4.1%" deltaDirection="up" />
      <MetricCard
        label="Churn"
        value="1.8%"
        delta="0.3%"
        deltaDirection="down"
        positiveIsGood={false}
      />
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

export const TwoColumns: Story = {
  render: () => (
    <MetricGrid columns={2}>
      <MetricCard label="Revenue" value="$1.2M" delta="8.5%" deltaDirection="up" />
      <MetricCard
        label="Expenses"
        value="$740k"
        delta="3.2%"
        deltaDirection="up"
        positiveIsGood={false}
      />
    </MetricGrid>
  ),
};

export const ThreeColumns: Story = {
  render: () => (
    <MetricGrid columns={3}>
      <MetricCard label="Sessions" value="128k" delta="5.1%" deltaDirection="up" />
      <MetricCard
        label="Bounce rate"
        value="42%"
        delta="1.8%"
        deltaDirection="down"
        positiveIsGood={false}
      />
      <MetricCard label="Avg. session" value="3m 12s" delta="0.4%" deltaDirection="neutral" />
    </MetricGrid>
  ),
};

// featured + MetricCard emphasis="headline" (#191, research 11 §B.5 KPI-2):
// the headline KPI out-ranks the band by spanning wider, not by a new hue.
export const Featured: Story = {
  render: () => (
    <MetricGrid columns={4} featured={0}>
      <MetricCard
        emphasis="headline"
        label="Net revenue retention"
        value="118%"
        delta="+4.2pp"
        deltaDirection="up"
      />
      <MetricCard label="MRR" value="$84.2k" delta="4.1%" deltaDirection="up" />
      <MetricCard
        label="Churn"
        value="1.8%"
        delta="0.3%"
        deltaDirection="down"
        positiveIsGood={false}
      />
    </MetricGrid>
  ),
};

export const NoDelta: Story = {
  render: () => (
    <MetricGrid columns={4}>
      <MetricCard label="Total accounts" value="4,209" />
      <MetricCard label="Regions" value="12" />
      <MetricCard label="Integrations" value="8" />
      <MetricCard label="API keys" value="23" />
    </MetricGrid>
  ),
};

/** Loading vs ready (#268) — `loading` forwards to every tile, matching each card's box height. */
export const Loading: Story = {
  render: () => (
    <MetricGrid columns={4} loading>
      <MetricCard label="Active users" value="24,512" delta="12.4%" deltaDirection="up" />
      <MetricCard label="MRR" value="$84.2k" delta="4.1%" deltaDirection="up" />
      <MetricCard
        label="Churn"
        value="1.8%"
        delta="0.3%"
        deltaDirection="down"
        positiveIsGood={false}
      />
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

/** Loading with no children yet — reserves the grid's final shape with placeholder tiles. */
export const LoadingEmpty: Story = {
  render: () => <MetricGrid columns={3} loading />,
};
