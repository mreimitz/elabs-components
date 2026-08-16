"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ChartDatapoint } from "./chart-datapoint";
import { PieChart } from "./pie-chart";
import { PieCenter } from "./pie-center";
import { PieSlice } from "./pie-slice";

const meta = {
  title: "Charts/PieChart",
  component: PieChart,
  tags: ["autodocs"],
} satisfies Meta<typeof PieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const trafficData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
  { label: "Social", value: 140 },
  { label: "Other", value: 70 },
];

/** Solid pie with token-driven slice colors (--chart-1..12) */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart data={trafficData} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>
    </div>
  ),
};

/** Donut with a center label showing total / hovered slice value */
export const Donut: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart data={trafficData} innerRadius={80} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>
    </div>
  ),
};

/** Donut with rounded corners and a gap between slices */
export const RoundedGap: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart cornerRadius={6} data={trafficData} innerRadius={70} padAngle={0.03} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart
        data={trafficData}
        innerRadius={80}
        size={280}
        accessibleLabel="Website traffic by channel — pie chart"
        accessibleDescription="Direct 320, Organic 280, Referral 190, Social 140, Other 70."
      >
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>
    </div>
  ),
};

// #349: drill-down. The slice carries the pointer click; the keyboard targets
// are real <button>s in a sibling layer outside the aria-hidden SVG.
function PieDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[320px] flex-col gap-3">
      <PieChart
        accessibleLabel="Traffic by source"
        data={trafficData}
        onDatapointClick={(point) => setSelected(point)}
        size={280}
      >
        {trafficData.map((slice, index) => (
          <PieSlice index={index} key={slice.label} />
        ))}
      </PieChart>
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a slice to drill in."}
      </output>
    </div>
  );
}

/** Click a slice — or Tab in and press Enter — to drill into it. */
export const Drilldown: Story = {
  render: () => <PieDrilldownDemo />,
};
