import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "@elabs-ai/components-ui";
import type { ChartDatapoint } from "./chart-datapoint";
import { FunnelChart } from "./funnel-chart";

const meta = {
  title: "Charts/FunnelChart",
  component: FunnelChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof FunnelChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const conversionFunnel = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 4800 },
  { label: "Activated", value: 2100 },
  { label: "Paid", value: 840 },
];

export const Default: Story = {
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    showLabels: true,
    showValues: true,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
};

/** Loading skeleton (RM-183) — shown while `status="loading"`, sized like the real chart. */
export const Loading: Story = {
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    status: "loading",
  },
  render: (args) => (
    <div className="h-72 w-full max-w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    // One `role="status" aria-live="polite"` region while loading, and only
    // one — the RM-183 review flagged loading plays that checked the role
    // but not the live-region contract or region count.
    const statuses = await canvas.findAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
  },
};

function FunnelLoadingToReadyDemo() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  return (
    <div className="flex flex-col gap-3">
      <Button className="self-start" onClick={() => setStatus("ready")} size="sm" variant="outline">
        Finish loading
      </Button>
      <div className="h-72 w-full max-w-[560px]">
        <FunnelChart data={conversionFunnel} orientation="horizontal" status={status} />
      </div>
    </div>
  );
}

/**
 * Regression lock (RM-183 review) — the ResizeObserver that measures the
 * plot never attached while `status="loading"` hid the real chart node, so
 * flipping to "ready" left the funnel blank until an unrelated resize fired.
 * This exercises that exact transition end to end in a real browser.
 */
export const LoadingToReady: Story = {
  name: "draws once loading finishes",
  render: () => <FunnelLoadingToReadyDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelectorAll('[data-slot="funnel-chart-label"]')).toHaveLength(0);

    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));

    await expect(canvas.findByText(conversionFunnel[0]!.label)).resolves.toBeInTheDocument();
    expect(
      canvasElement.querySelectorAll('[data-slot="funnel-chart-label"]').length,
    ).toBeGreaterThan(0);
  },
};

export const Vertical: Story = {
  args: {
    data: conversionFunnel,
    orientation: "vertical",
    showLabels: true,
    showValues: true,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-[480px] w-72">
      <FunnelChart {...args} />
    </div>
  ),
};

export const WithGrid: Story = {
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    grid: true,
    showLabels: true,
    showValues: true,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
};

export const StraightEdges: Story = {
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    edges: "straight",
    showLabels: true,
    showValues: true,
    showPercentage: false,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <FunnelChart
        data={conversionFunnel}
        orientation="horizontal"
        showLabels
        showValues
        showPercentage
        accessibleLabel="Conversion funnel chart"
        accessibleDescription="Visitors 12,000 → Signups 4,800 (40%) → Activated 2,100 (18%) → Paid 840 (7%)."
      />
    </div>
  ),
};

export const TokenColors: Story = {
  args: {
    data: [
      { label: "Stage 1", value: 9000, color: "var(--chart-1)" },
      { label: "Stage 2", value: 5400, color: "var(--chart-2)" },
      { label: "Stage 3", value: 2700, color: "var(--chart-3)" },
      { label: "Stage 4", value: 900, color: "var(--chart-4)" },
      { label: "Stage 5", value: 270, color: "var(--chart-5)" },
    ],
    orientation: "horizontal",
    showLabels: true,
    showValues: false,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-72 w-[700px]">
      <FunnelChart {...args} />
    </div>
  ),
};

/**
 * Stage-to-stage conversion (lieflat L13) at every boundary — the number
 * funnel readers actually want, distinct from `showPercentage`'s "% of the
 * first stage" badge. Reconciles with the data: 4,800/12,000 = 40%,
 * 2,100/4,800 = 44%, 840/2,100 = 40%.
 */
export const ConversionBetween: Story = {
  name: "Conversion — between stages",
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    showConversion: "between",
    showLabels: true,
    showValues: true,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
};

/** Same conversion numbers, stacked in the left margin (lieflat L13's "62% GET THROUGH"). */
export const ConversionMargin: Story = {
  name: "Conversion — margin",
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    showConversion: "margin",
    showLabels: true,
    showValues: true,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
};

// #349: drill-down on a funnel stage.
function FunnelDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[560px] flex-col gap-3">
      <FunnelChart
        accessibleLabel="Conversion funnel"
        data={conversionFunnel}
        onDatapointClick={(point) => setSelected(point)}
      />
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a stage to drill in."}
      </output>
    </div>
  );
}

/** Click a stage — or Tab in and press Enter — to drill into it. */
export const Drilldown: Story = {
  render: () => <FunnelDrilldownDemo />,
};

/**
 * Regression lock for #125 — samples the story a third of a second after mount,
 * i.e. squarely inside the window where the segment labels' entrance fade used
 * to be in flight, and lets the a11y addon's axe pass run there.
 *
 * Before the reduced-motion gate in `SegmentLabel` this failed deterministically
 * with ~1.1–1.5:1 `color-contrast` on the value / percentage / label spans —
 * axe reading `--foreground` and `--muted-foreground` blended toward the page
 * ground by the wrapper's mid-ramp opacity. The wait is the PROBE, never the
 * fix: what makes it green is that under the test runner's
 * `prefers-reduced-motion: reduce` the labels mount at their resting opacity,
 * so there is no transient to sample. It also removes the vacuous half of the
 * old behaviour — axe skips an `opacity: 0` node entirely, so the ordinary
 * story's PASS never measured these labels at all.
 */
export const EntranceIsContrastSafe: Story = {
  name: "labels are legible while the entrance would be running",
  tags: ["!autodocs"],
  args: {
    data: conversionFunnel,
    orientation: "horizontal",
    showLabels: true,
    showValues: true,
    showPercentage: true,
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <FunnelChart {...args} />
    </div>
  ),
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  },
};
