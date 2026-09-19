import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
 * instead of a solid capsule. The pitch comes from the value scale, so one
 * rung is worth the same amount in every step (#241) — stated here since the
 * waterfall renders no axis of its own to read it from. */
export const UnitRungs: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <WaterfallChart accessibleDescription="One rung = 25." data={grossToNet} unit={25} />
    </div>
  ),
};

/**
 * `callouts` names the one or two steps that actually explain the bridge —
 * drawn above the step with a `Leader`, so a reader does not have to infer
 * "which of these five bars is the story" from height alone. Needs extra
 * `margin.top` for the note's own headroom.
 */
export const WithCallouts: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <WaterfallChart
        accessibleDescription="COGS is the main driver of the drop from gross to net."
        accessibleLabel="Gross to net revenue bridge"
        callouts={[{ label: "COGS", note: "The main driver" }]}
        data={grossToNet}
        margin={{ top: 64 }}
      />
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

/** The series-pattern channel (ADR 0011) rendered: `bp-series-*` defs + marks filled from them. */
function expectSeriesPatterns(root: Element, markSelector: string, minPatterns: number) {
  expect(root.querySelectorAll('pattern[id^="bp-series-"]').length).toBeGreaterThanOrEqual(
    minPatterns,
  );
  const patterned = [...root.querySelectorAll(markSelector)].filter((mark) =>
    (mark.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
  );
  expect(patterned.length).toBeGreaterThan(0);
}

/**
 * High decoration (ADR 0011, #257) — increase, decrease and total steps each
 * draw one series pattern, so the bridge's three kinds of step survive without
 * hue.
 */
export const HighDecoration: Story = {
  tags: ["!dev"],
  name: "High decoration",
  globals: { decoration: "10" },
  render: () => (
    <div className="h-72 w-full max-w-[560px]" data-decoration="10">
      <WaterfallChart
        accessibleLabel="Gross to net revenue bridge"
        data={[
          ...grossToNet.slice(0, 4),
          { label: "Price", value: 150 },
          { kind: "total", label: "Net", value: 550 },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expectSeriesPatterns(canvasElement, '[data-slot="waterfall-chart-step"]', 3),
    );
  },
};

// Same bridge as `grossToNet`, but every row states the running total
// reached at that point instead of the delta — `dataFormat="runningTotals"`.
const grossToNetRunningTotals: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: 900 },
  { label: "COGS", value: 600 },
  { label: "Ops", value: 400 },
  { kind: "total", label: "Net", value: 400 },
];

/** `dataFormat="runningTotals"` reads every row as the running total reached
 * at that point instead of a signed delta — the same bridge as `Default`,
 * converted once on the way in. */
export const RunningTotals: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <WaterfallChart
        accessibleLabel="Gross to net revenue bridge, running totals input"
        data={grossToNetRunningTotals}
        dataFormat="runningTotals"
      />
    </div>
  ),
};

// Six months across two quarters — subtotalBy groups by adjacency.
const monthsByQuarter: WaterfallDatum[] = [
  { kind: "total", label: "Opening", value: 1000 },
  { label: "Jan", quarter: "Q1", value: 50 },
  { label: "Feb", quarter: "Q1", value: 30 },
  { label: "Mar", quarter: "Q1", value: -10 },
  { label: "Apr", quarter: "Q2", value: 20 },
  { label: "May", quarter: "Q2", value: -5 },
  { kind: "total", label: "Closing", value: 1085 },
];

/** `subtotalBy` auto-inserts a subtotal checkpoint after each run of rows
 * sharing that row field's value — here, one after every quarter's months. */
export const QuarterlySubtotals: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[720px]">
      <WaterfallChart
        accessibleLabel="Opening to closing balance by month, with quarterly subtotals"
        data={monthsByQuarter}
        subtotalBy="quarter"
      />
    </div>
  ),
};

/** `sort="decreasesFirst"` reorders the steps WITHIN each subtotal- or
 * total-bounded group — the checkpoints themselves never move. */
export const SortedDecreasesFirst: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <WaterfallChart
        accessibleLabel="Gross to net revenue bridge, decreases sorted first"
        data={grossToNet}
        sort="decreasesFirst"
      />
    </div>
  ),
};

// Opening/closing sit near 1,000,000; the steps swing by only a few thousand
// around it — the shape `zoomToDifferences` targets.
const largeBalanceBridge: WaterfallDatum[] = [
  { kind: "total", label: "Opening", value: 1_000_000 },
  { label: "New", value: 4_500 },
  { label: "Upsell", value: 3_000 },
  { label: "Churn", value: -3_800 },
  { kind: "total", label: "Closing", value: 1_003_700 },
];

/**
 * `zoomToDifferences` drops the zero baseline when a checkpoint sits far
 * above the steps' own swing — a `"total"`/`"subtotal"` row can no longer
 * honestly draw as a zero-based bar once zero is off-screen, so it renders
 * as a point on a dashed stem instead; the steps themselves stay ordinary
 * bars, since a delta's length is proportional under any linear domain.
 */
export const ZoomedToDifferences: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <WaterfallChart
        accessibleDescription="Opening and closing balances render as points once the zero baseline drops out of view."
        accessibleLabel="Opening to closing balance, zoomed to the differences"
        data={largeBalanceBridge}
        zoomToDifferences
      />
    </div>
  ),
};

/** `labels` with `differences: "percent"` reads each step as a signed
 * percent of the running total it left off, instead of its absolute value —
 * `matchColor` paints each label in its own row's ink (through
 * `seriesLabelInk`, never the raw fill, #544) instead of the neutral halo
 * ink; the mixed increase/decrease/subtotal rows exercise the `layoutLabels`
 * collision pass (RM-122) against both the annotation and axis obstacles. */
export const PercentDifferenceLabels: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[720px]">
      <WaterfallChart
        accessibleDescription="March gives back most of Q1's gains."
        accessibleLabel="Opening to closing balance by month, percent difference labels"
        callouts={[{ label: "Mar", note: "Gives back most of Q1" }]}
        data={monthsByQuarter}
        labels={{ differences: "percent", matchColor: true, totals: "all" }}
        margin={{ top: 64 }}
        subtotalBy="quarter"
      />
    </div>
  ),
};

/** `connectors="thick"` weights the hand-off hairlines for a bolder read. */
export const ThickConnectors: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <WaterfallChart
        accessibleLabel="Gross to net revenue bridge, thick connectors"
        connectors="thick"
        data={grossToNet}
      />
    </div>
  ),
};
