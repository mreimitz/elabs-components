import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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

/**
 * Regression lock (RM-052 round 2, #227, F3): the conformance tile must occupy the SAME
 * box height whether or not a conformance score has actually been measured. Before the
 * fix, `description` was only ever given a value in the "not available" branch, so the
 * measured and unavailable states rendered different heights — the tile visibly reflowed
 * depending on which conformance state a reader happened to see. Renders both states
 * side by side and asserts the conformance tile's own box is pixel-identical between
 * them.
 */
export const ReflowRegressionLock: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ProcessKpiStrip kpis={kpis} conformance={0.91} data-testid="measured" />
      <ProcessKpiStrip kpis={kpis} conformance={null} data-testid="unavailable" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const measuredStrip = canvas.getByTestId("measured");
    const unavailableStrip = canvas.getByTestId("unavailable");

    const conformanceTileHeight = (strip: HTMLElement): number => {
      const label = within(strip).getByText("Conformance");
      const tile = label.closest('[class*="rounded-lg"]');
      if (!tile) throw new Error("Could not locate the conformance tile's own card element");
      return tile.getBoundingClientRect().height;
    };

    const measuredHeight = conformanceTileHeight(measuredStrip);
    const unavailableHeight = conformanceTileHeight(unavailableStrip);

    // Pixel-identical, not merely "close" — both states render the exact same DOM shape
    // (a `<p>` wrapping either a visible or an `invisible` copy of the same hint string),
    // so nothing here should be able to introduce even a sub-pixel difference.
    await expect(measuredHeight).toBe(unavailableHeight);
    await expect(measuredHeight).toBeGreaterThan(0);
  },
};
