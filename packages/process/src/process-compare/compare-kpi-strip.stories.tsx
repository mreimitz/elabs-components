import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompareKpiStrip } from "./compare-kpi-strip";

const HOUR = 60 * 60 * 1000;

const meta = {
  title: "Process/ProcessCompare/CompareKpiStrip",
  component: CompareKpiStrip,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The KPI pair under `ProcessCompare`: cases and median throughput for each side, " +
          "with B’s tiles carrying a signed delta against A. Direction is an arrow glyph plus " +
          "an accessible name, never colour alone.",
      },
    },
  },
  args: {
    a: { label: "Before", kpis: { cases: 1200, medianThroughput: 52 * HOUR } },
    b: { label: "After", kpis: { cases: 1350, medianThroughput: 41 * HOUR } },
  },
  render: (args) => (
    <div className="w-full max-w-4xl">
      <CompareKpiStrip {...args} />
    </div>
  ),
} satisfies Meta<typeof CompareKpiStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Both sides carry a log, so cases and median throughput pair up. */
export const Default: Story = {};

/** A graph-only side has no throughput — the strip falls back to the cases pair alone. */
export const CasesOnly: Story = {
  args: {
    a: { label: "Before", kpis: { cases: 1200 } },
    b: { label: "After", kpis: { cases: 1100 } },
  },
};

/** Not ready yet: `MetricGrid`’s own loading state, same footprint as the resolved strip. */
export const Loading: Story = {
  args: { loading: true },
};
