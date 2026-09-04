import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ChartDatapoint } from "./chart-datapoint";
import { UnitChart } from "./unit-chart";

const meta = {
  title: "Charts/UnitChart",
  component: UnitChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "One mark equals one honest unit: a waffle grid, a phyllotaxis field, or tally " +
          "rows of ticks, for showing a whole as discrete countable pieces (a hundred dots, " +
          "a multi-select survey) rather than as a smoothed proportion. When exact per-unit " +
          "counts do not matter, a `PieChart` or `BarChart` reads faster for the same " +
          "composition; see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof UnitChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// The roadmap's own worked example — 4 traffic sources that sum cleanly to 100,
// so the footer reads "41 + 35 + 12 + 12 = 100" with nothing rounded away.
// Reference: lieflat's "G4 Dot Waffle".
const trafficSources = [
  { label: "Search", value: 41 },
  { label: "Direct", value: 35 },
  { label: "Referral", value: 12 },
  { label: "Social", value: 12 },
];

// A "what's on your mind" survey, 4 categories summing to 100 — the field
// layout's cluster area is proportional to each share.
// Reference: lieflat's "L14 Hundred Field".
const topOfMind = [
  { label: "Work", value: 38 },
  { label: "Family", value: 27 },
  { label: "Health", value: 21 },
  { label: "Money", value: 14 },
];

// A multi-select "greatest fears" survey — 6 rows, each independently tallied;
// rows are not required to sum to 100 (a respondent can pick more than one).
// Reference: lieflat's "L15 Ballot Tally".
const greatestFears = [
  { label: "Public speaking", value: 61 },
  { label: "Heights", value: 32 },
  { label: "Spiders", value: 24 },
  { label: "Flying", value: 22 },
  { label: "Snakes", value: 18 },
  { label: "Dark", value: 9 },
];

// The acceptance's own rounding example: round(value/1) sums to 98, 2 short of 100.
const roundedShortfall = [
  { label: "Chrome", value: 49.0 },
  { label: "Safari", value: 27.4 },
  { label: "Firefox", value: 13.9 },
  { label: "Edge", value: 5.0 },
  { label: "Other", value: 3.2 },
];

/** Waffle — column-major grid, one dot per unit (lieflat's "G4 Dot Waffle"). */
export const Default: Story = {
  args: {
    data: trafficSources,
    layout: "waffle",
    unitLabel: "one dot = one visit in a hundred",
  },
  render: (args) => (
    <div className="h-[360px] w-[420px]">
      <UnitChart {...args} />
    </div>
  ),
};

/** Field — golden-angle phyllotaxis cluster per series (lieflat's "L14 Hundred Field"). */
export const Field: Story = {
  args: {
    data: topOfMind,
    layout: "field",
    unitLabel: "one dot = one respondent in a hundred",
  },
  render: (args) => (
    <div className="h-[420px] w-[420px]">
      <UnitChart {...args} />
    </div>
  ),
};

/** Rows — one tick row per series, ticked every 10 (lieflat's "L15 Ballot Tally"). Rows may sum past `total`. */
export const Rows: Story = {
  args: {
    data: greatestFears,
    layout: "rows",
  },
  render: (args) => (
    <div className="w-[420px]">
      <UnitChart {...args} />
    </div>
  ),
};

/** Waffle / Field / Rows side by side — the acceptance's cross-layout comparison. */
export const AllLayouts: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      <div className="h-[300px] w-[340px]">
        <UnitChart data={trafficSources} layout="waffle" unitLabel="Traffic sources" />
      </div>
      <div className="h-[340px] w-[340px]">
        <UnitChart data={topOfMind} layout="field" unitLabel="Top of mind" />
      </div>
      <div className="w-[340px]">
        <UnitChart data={greatestFears} layout="rows" />
      </div>
    </div>
  ),
};

/**
 * The rounding rule: a series that does not divide evenly into `unit` never
 * invents a mark — the footer calls out the shortfall instead
 * ("98 · 2 rounded away").
 */
export const RoundingRemainder: Story = {
  args: {
    data: roundedShortfall,
    layout: "waffle",
    unitLabel: "one dot = one visitor in a hundred",
  },
  render: (args) => (
    <div className="h-[360px] w-[420px]">
      <UnitChart {...args} />
    </div>
  ),
};

/** `mark="square"` and `mark="tick"` — the two alternates to the default dot. */
export const MarkShapes: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      <div className="h-[300px] w-[340px]">
        <UnitChart data={trafficSources} layout="waffle" mark="square" />
      </div>
      <div className="h-[300px] w-[340px]">
        <UnitChart data={trafficSources} layout="waffle" mark="tick" />
      </div>
    </div>
  ),
};

/**
 * 1,000 marks across 5 series. The per-mark reveal is a plain CSS
 * `transition-delay` computed once in JS (`unitMarkDelayMs`) — never a
 * per-mark `motion`/framer-motion component — so this stays a single paint
 * regardless of mark count. See `unit-layouts.ts`'s stagger constants.
 */
export const PerformanceStress: Story = {
  args: {
    data: [
      { label: "North", value: 250 },
      { label: "South", value: 230 },
      { label: "East", value: 210 },
      { label: "West", value: 180 },
      { label: "Central", value: 130 },
    ],
    layout: "field",
    showArithmetic: false,
    total: 1000,
  },
  render: (args) => (
    <div className="h-[520px] w-[520px]">
      <UnitChart {...args} />
    </div>
  ),
};

// #349: drill-down on a series.
function UnitChartDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[420px] flex-col gap-3">
      <UnitChart
        accessibleLabel="Traffic sources"
        data={trafficSources}
        layout="waffle"
        onDatapointClick={(point) => setSelected(point)}
      />
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a source — or Tab in and press Enter — to drill in."}
      </output>
    </div>
  );
}

/** Click a series — or Tab in and press Enter — to drill into it. One keyboard target per series, never per mark. */
export const Drilldown: Story = {
  render: () => <UnitChartDrilldownDemo />,
};
