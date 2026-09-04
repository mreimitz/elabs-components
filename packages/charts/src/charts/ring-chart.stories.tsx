"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
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

// ── TickRing — 100-tick procedural rendering at high decoration (lieflat F4,
// #RM-030) ───────────────────────────────────────────────────────────────
//
// At `data-decoration >= 8` RingChart swaps its smooth concentric arcs for
// one unified ring of exactly 100 radial ticks — "1 tick = 1%" — divided
// among the series by their share of the total, with a dot every 10th tick
// and (via `labels="outside"`) dotted leader lines to outside labels.
// Pinned to decoration 10 via BOTH the story `globals` (Storybook toolbar /
// preview) and an in-render `data-decoration="10"` wrapper (the
// `test-storybook` / addon-vitest runner never applies story `globals`, only
// the rendered DOM attribute — see series-pattern.stories.tsx).

export const TickRing: Story = {
  globals: { decoration: "10" },
  render: (args) => (
    <div className="rounded-lg bg-card p-8" data-decoration="10">
      <div className="h-72 w-[280px]">
        <RingChart {...args}>
          {ringData.map((item, i) => (
            <Ring index={i} key={item.label} />
          ))}
          <RingCenter defaultLabel="Channels" />
        </RingChart>
      </div>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
    labels: "outside",
  },
  play: async ({ canvasElement }) => {
    // Fixed-size-vs-ParentSize timing (#289): the high-decoration signal
    // settles a frame after mount — waitFor asserts the settled render.
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();

      // Exactly 100 ticks around the ring ("1 tick = 1%").
      const ticks = canvasElement.querySelectorAll("[data-tick-ring-tick]");
      expect(ticks.length).toBe(100);

      // A dot every 10th tick.
      expect(canvasElement.querySelectorAll("[data-tick-ring-dot]").length).toBe(10);

      // Every series gets a dotted Leader line + outside label (labels="outside").
      expect(canvasElement.querySelectorAll("[data-tick-ring-leader]").length).toBe(
        ringData.length,
      );

      // ringData's values (42/28/18/12) sum to exactly 100 — segments' tick
      // counts equal round(share) with zero rounding remainder, and the
      // caption states that plainly.
      const caption = canvasElement.querySelector("[data-tick-ring-caption]");
      expect(caption).not.toBeNull();
      expect(caption?.textContent).toBe("100 ticks — segments sum exactly to 100.");

      // Original smooth-arc <Ring> paths are swapped out in tick mode.
      expect(svgEl!.querySelectorAll("path").length).toBe(0);

      // Centre value (RingCenter) is unchanged by tick mode.
      expect(canvasElement.textContent).toContain("Channels");
    });
  },
};
