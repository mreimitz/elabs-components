"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ChartDatapoint } from "./chart-datapoint";
import { Ring } from "./ring";
import { RingCenter } from "./ring-center";
import { RingChart } from "./ring-chart";

const meta = {
  title: "Charts/RingChart",
  component: RingChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof RingChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Channel breakdown: value + maxValue drive progress per ring (--chart-1..12 tokens). */
const ringData = [
  { label: "Email", value: 42, maxValue: 100 },
  { label: "Social", value: 28, maxValue: 100 },
  { label: "Direct", value: 18, maxValue: 100 },
  { label: "Other", value: 12, maxValue: 100 },
];

export const Default: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {ringData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
  },
};

/** Fixed pixel size — bypasses ParentSize and uses a concrete dimension. */
export const FixedSize: Story = {
  render: (args) => (
    <RingChart {...args}>
      {ringData.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
      <RingCenter defaultLabel="Channels" />
    </RingChart>
  ),
  args: {
    data: ringData,
    size: 280,
    strokeWidth: 14,
  },
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {ringData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
    accessibleLabel: "Channel performance ring chart",
    accessibleDescription: "Email 42%, Social 28%, Direct 18%, Other 12%.",
  },
};

/** Fewer rings at different fill levels. */
export const PartialFill: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {(args.data as typeof ringData).map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Progress" />
      </RingChart>
    </div>
  ),
  args: {
    data: [
      { label: "Tasks done", value: 73, maxValue: 100 },
      { label: "Reviews", value: 40, maxValue: 100 },
      { label: "Deploys", value: 12, maxValue: 100 },
    ],
    strokeWidth: 14,
  },
};

// #349: drill-down on a ring. Same contract as every other family.
function RingDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[320px] flex-col gap-3">
      <RingChart
        accessibleLabel="Channel breakdown"
        data={ringData}
        onDatapointClick={(point) => setSelected(point)}
        size={280}
      >
        {ringData.map((ring, index) => (
          <Ring index={index} key={ring.label} />
        ))}
      </RingChart>
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a ring to drill in."}
      </output>
    </div>
  );
}

/** Click a ring — or Tab in and press Enter — to drill into it. */
export const Drilldown: Story = {
  render: () => <RingDrilldownDemo />,
};
