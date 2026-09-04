import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { ChartDatapoint } from "./chart-datapoint";
import { WaterfallChart, type WaterfallDatum, type WaterfallStep } from "./waterfall-chart";

const meta = {
  title: "Charts/WaterfallChart",
  component: WaterfallChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Each step floats from the running total the previous step left off, connected by " +
          "a dashed hand-off hairline; rows marked kind “total” draw from zero and reset the " +
          "running total for a subtotal, gross, or net checkpoint — the read for a bridge " +
          "from a starting number to an ending one through a sequence of additions and " +
          "subtractions.",
      },
    },
  },
} satisfies Meta<typeof WaterfallChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// Gross → refunds → COGS → ops → net — the F9 lieflat example (RM-022).
const grossToNet: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { label: "COGS", value: -300 },
  { label: "Ops", value: -200 },
  { kind: "total", label: "Net", value: 400 },
];

/** Gross → refunds → COGS → ops → net: connectors hand off at the running
 * total, totals draw from zero, labels are signed. */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <WaterfallChart accessibleLabel="Gross to net revenue bridge" data={grossToNet} />
    </div>
  ),
};

/** Same data, horizontal orientation — the label-fitting `BarYAxis` plan. */
export const Horizontal: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <WaterfallChart
        accessibleLabel="Gross to net revenue bridge"
        data={grossToNet}
        orientation="horizontal"
      />
    </div>
  ),
};

/** `unit` renders each bar as a counted `UnitStack` of rungs — the F9 look —
 * instead of a solid capsule. */
export const UnitRungs: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <WaterfallChart data={grossToNet} unit={25} />
    </div>
  ),
};

/** Connectors and value labels can both be turned off for a quieter read. */
export const NoConnectorsNoLabels: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <WaterfallChart connectors={false} data={grossToNet} showValues={false} />
    </div>
  ),
};

// #349 drill-down — every step is a keyboard datapoint target, exactly like
// the rest of the bar family (see bar-chart.stories.tsx Drilldown demo).
function DrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint<WaterfallStep> | null>(null);

  return (
    <div className="flex w-[560px] flex-col gap-3">
      <div className="h-72">
        <WaterfallChart
          accessibleLabel="Gross to net revenue bridge"
          data={grossToNet}
          onDatapointClick={(point) => setSelected(point)}
        />
      </div>
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="drill-detail"
      >
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a step to drill in."}
      </output>
    </div>
  );
}

/** Click a step to drill into it; the detail panel below reports the datum. */
export const Drilldown: Story = {
  render: () => <DrilldownDemo />,
};

/**
 * The same drill-down reached with the keyboard only — one tab stop for the
 * whole chart, ArrowRight to traverse every step, Enter to activate.
 */
export const KeyboardDrilldown: Story = {
  render: () => <DrilldownDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");

    // Every step (all 5 rows) is a keyboard target — one tab stop overall.
    await expect(targets).toHaveLength(grossToNet.length);
    await expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (targets[0] as HTMLElement).focus();
    await expect(targets[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(targets[1]).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(canvas.getByTestId("drill-detail")).toHaveTextContent(/via keyboard/);
  },
};
