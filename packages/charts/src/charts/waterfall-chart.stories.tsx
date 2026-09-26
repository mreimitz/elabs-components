import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChartFrame } from "../chart-frame/chart-frame";
import type { ChartDatapoint } from "./chart-datapoint";
import type { SelectionState } from "./chart-selection";
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

/**
 * `status="loading"` (RM-182): a skeleton in the plot box the chart will fill,
 * with one polite status message per chart, at 380, 600 and 900 px.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex w-[900px] max-w-full flex-col gap-6">
      {[380, 600, 900].map((width) => (
        <div className="w-full" key={width} style={{ maxWidth: width }}>
          <WaterfallChart
            accessibleLabel="Gross to net revenue bridge"
            data={grossToNet}
            status="loading"
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(3);
    for (const status of statuses) {
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveTextContent("Loading chart…");
      const skeleton = status.querySelector('[data-slot="skeleton"]');
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      // The skeleton fills the reserved plot box, so nothing moves when the data lands.
      await waitFor(() => expect(status.getBoundingClientRect().height).toBeGreaterThan(0));
      await expect(skeleton?.getBoundingClientRect().height).toBe(
        status.getBoundingClientRect().height,
      );
    }
    await expect(canvasElement.querySelector("svg")).toBeNull();
  },
};

// A two-quarter ARR bridge: monthly steps carry a `quarter` field for
// `subtotalBy`, and the closing balance is its own explicit total.
const arrBridge: WaterfallDatum[] = [
  { kind: "total", label: "Opening ARR", value: 1000 },
  { label: "Jan New", quarter: "Q1", value: 80 },
  { label: "Feb New", quarter: "Q1", value: 60 },
  { label: "Mar Churn", quarter: "Q1", value: -35 },
  { label: "Apr New", quarter: "Q2", value: 90 },
  { label: "May Churn", quarter: "Q2", value: -40 },
  { label: "Jun Upsell", quarter: "Q2", value: 55 },
  { kind: "total", label: "Closing ARR", value: 1210 },
];

const arrBridgeColumns = [
  { key: "label", header: "Step" },
  { key: "value", header: "Change ($k)" },
];

/**
 * Everything the parity waves added to `WaterfallChart`, composed on one
 * realistic bridge: monthly steps grouped into an auto-inserted quarterly
 * subtotal (`subtotalBy="quarter"`), decreases sorted first within each
 * quarter (`sort="decreasesFirst"`), every row labelled with its percent
 * change in its own row colour (`labels={{ totals: "all", differences:
 * "percent", matchColor: true }}`), thicker hand-off connectors
 * (`connectors="thick"`), and a row note, a target line and a floating note
 * (`annotations`). `ChartFrame` adds the title, description, notes, source
 * and export chrome around it.
 *
 * Left out: `zoomToDifferences` and `dataFormat="runningTotals"` — the first
 * tells a different story (a huge, near-flat balance whose swings are tiny
 * beside it, not this bridge's additive quarterly growth) and the second is
 * an input-format convenience with no visual difference from the delta rows
 * used here.
 */
export const Showcase: Story = {
  parameters: {
    layout: "padded",
    docs: {
      description: {
        story:
          "A quarterly ARR bridge with an auto-inserted subtotal after Q1, decreases sorted first within each quarter, percent-change labels coloured to match each row, thickened hand-off connectors, a row note on the worst month, a dotted target line and a floating note — all inside a frame with title, notes, source and export.",
      },
    },
  },
  render: () => (
    <div className="w-full max-w-[720px]">
      <ChartFrame
        title="ARR grew 21 % in H1 2026, weathering churn in March and May"
        description="Monthly change in annual recurring revenue (ARR) from January through June 2026, in thousands of dollars; the darker bars mark the quarterly subtotal and the opening/closing totals."
        notes="Percent labels are each month’s change as a share of the running total the month began with."
        source="Source: Finance systems, closed monthly"
        data={arrBridge}
        columns={arrBridgeColumns}
      >
        <WaterfallChart
          accessibleDescription="Opening 1,000, a Q1 subtotal of 1,105 after March’s churn, and a closing balance of 1,210."
          accessibleLabel="ARR bridge from opening to closing balance, by month"
          annotations={[
            { kind: "row", category: "Mar Churn", text: "Worst month of Q1" },
            { kind: "line", y: 1250, label: "2026 target", style: "dotted" },
            {
              kind: "text",
              x: "Jun Upsell",
              y: 1260,
              text: "Upsell offsets May’s losses",
              anchor: "s",
              width: 25,
            },
          ]}
          connectors="thick"
          data={arrBridge}
          labels={{ differences: "percent", matchColor: true, totals: "all" }}
          margin={{ top: 64 }}
          sort="decreasesFirst"
          subtotalBy="quarter"
        />
      </ChartFrame>
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

// Selection paint-back (RM-185): forwarded to the inner BarChart, which already
// paints the tri-state (F22) — see `dumbbell-chart.stories.tsx`'s "Selection states"
// for the same contract on a different family.
const SELECTION_BY_LABEL: Record<string, SelectionState> = {
  Refunds: "selected",
  COGS: "associated",
  Ops: "excluded",
};
const selectionByLabel = (category: string | number | Date): SelectionState =>
  SELECTION_BY_LABEL[String(category)] ?? "associated";

/**
 * A host's `selectionStates` paints Refunds selected, COGS associated and Ops
 * excluded: the inner BarChart (not Waterfall itself) resolves and paints the
 * tri-state, so the effect is visible on the step bars without Waterfall
 * knowing anything about the paint rules itself.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <WaterfallChart
        accessibleLabel="Gross to net revenue bridge with a selection applied"
        data={grossToNet}
        selectionStates={selectionByLabel}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-selection="selected"]').length).toBeGreaterThan(
        0,
      ),
    );
    expect(canvasElement.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(
      0,
    );
    expect(canvasElement.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0);
  },
};
