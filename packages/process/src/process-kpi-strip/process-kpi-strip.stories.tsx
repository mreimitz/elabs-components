import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProcessKpiStrip } from "./process-kpi-strip";

const meta = {
  title: "Process/ProcessKpiStrip",
  component: ProcessKpiStrip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Six KPI tiles for a process-mining session, built on `@elabs-ai/components-charts`' " +
          "`MetricGrid`/`MetricCard` rather than authoring a new tile (ADR 0012). Cases, " +
          "events, variants, median throughput, and rework rate always have a real number; " +
          "conformance is the one tile that can genuinely have no value yet — no conformance " +
          "checking has run — and renders a 'Not available' state rather than a fabricated 0%.",
      },
    },
  },
} satisfies Meta<typeof ProcessKpiStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

const kpis = {
  cases: 240,
  events: 1_842,
  variants: 37,
  medianThroughput: 3 * 24 * 60 * 60 * 1000,
  reworkRate: 0.18,
};

/** All six tiles with real values, including a measured conformance score. */
export const Default: Story = {
  args: { kpis, conformance: 0.91 },
};

/** No conformance model has run yet — a genuine "not available" state, not a fabricated 0%. */
export const ConformanceUnavailable: Story = {
  args: { kpis, conformance: null },
};

/** Every tile carries a trend sparkline alongside its headline number. */
export const WithTrends: Story = {
  args: {
    kpis,
    conformance: 0.91,
    trends: {
      cases: [180, 190, 205, 198, 220, 232, 240],
      events: [1200, 1350, 1480, 1520, 1690, 1780, 1842],
      variants: [22, 25, 28, 30, 33, 35, 37],
      reworkRate: [0.24, 0.22, 0.21, 0.2, 0.19, 0.18, 0.18],
      conformance: [0.82, 0.84, 0.86, 0.87, 0.89, 0.9, 0.91],
    },
  },
};

/** No data yet — `loading` reserves every tile's final shape (`MetricGrid`'s own skeleton). */
export const Loading: Story = {
  args: { kpis, conformance: 0.91, loading: true },
};
