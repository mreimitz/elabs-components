import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { ChartDatapoint } from "../chart-datapoint";
import { TreemapChart } from "./treemap-chart";
import type { TreemapNode } from "./treemap-layout";

const meta = {
  title: "Charts/TreemapChart",
  component: TreemapChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Rectangles sized by area to a leaf’s value inside a nested hierarchy — up to two " +
          "rendered levels, with parent title bands and paper-gap separators between groups; " +
          "palette can shade by level, by value, or by top-level category. When structure " +
          "matters and size does not, `TreeChart` draws the same kind of hierarchy as a " +
          "branching diagram instead; see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof TreemapChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// "Where the work went" (F13) — engineering time split across two groups.
const whereTheWorkWent: TreemapNode = {
  name: "Work",
  children: [
    {
      name: "Platform",
      children: [
        { name: "CI", value: 40 },
        { name: "Infra", value: 30 },
        { name: "Release", value: 10 },
      ],
    },
    {
      name: "Product",
      children: [
        { name: "Onboarding", value: 25 },
        { name: "Billing", value: 15 },
        { name: "Search", value: 5 },
      ],
    },
  ],
};

export const Default: Story = {
  args: {
    data: whereTheWorkWent,
    accessibleLabel: "Where the work went",
    accessibleDescription:
      "Platform (Ci, Infra, Release) and Product (Onboarding, Billing, Search).",
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
};

/** Default palette: one shared neutral shade per leaf — groups read apart only
 * by their title band + paper gap, so the chart stays legible in greyscale. */
export const Mono: Story = {
  args: {
    data: whereTheWorkWent,
    palette: "mono",
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
};

/** One hue per top-level group (≤ 4 groups); leaves inherit their group's hue. */
export const Categorical: Story = {
  args: {
    data: whereTheWorkWent,
    palette: "categorical",
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
};

/** Leaf shade encodes the leaf's own value on the sequential ramp. */
export const Sequential: Story = {
  args: {
    data: whereTheWorkWent,
    palette: "sequential",
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
};

/** Flat, single-level rendering — root's children only, no title bands. */
export const FlatDepthOne: Story = {
  name: "Depth: 1 (flat)",
  args: {
    data: whereTheWorkWent,
    depth: 1,
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
};

const longTail: TreemapNode = {
  name: "Backlog",
  children: [
    {
      name: "Team A",
      children: [
        { name: "Big rock", value: 82 },
        { name: "Small fix 1", value: 2 },
        { name: "Small fix 2", value: 2 },
        { name: "Small fix 3", value: 2 },
        { name: "Small fix 4", value: 2 },
        { name: "Small fix 5", value: 2 },
        { name: "Small fix 6", value: 2 },
        { name: "Small fix 7", value: 2 },
        { name: "Small fix 8", value: 2 },
        { name: "Small fix 9", value: 2 },
        { name: "Small fix 10", value: 2 },
      ],
    },
  ],
};

/** A long tail of small leaves merges into a single "Other" tile once each
 * falls below 5% of its group's total. */
export const OtherThreshold: Story = {
  args: {
    data: longTail,
    otherThreshold: 0.05,
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
};

/**
 * Click (or Tab to and press Enter on) a group's title band to zoom into it;
 * the "← Work" control zooms back out. This is a SEPARATE affordance from
 * `onDatapointClick` — the static stories above have no click handler beyond
 * it.
 */
export const Drilldown: Story = {
  args: {
    data: whereTheWorkWent,
    drilldown: true,
    accessibleLabel: "Where the work went",
  },
  render: (args) => (
    <div className="h-[420px] w-[720px]">
      <TreemapChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Overview: two group-zoom targets, one per top-level group.
    const zoomIn = await waitFor(() => canvas.getByRole("button", { name: /zoom into platform/i }));
    await userEvent.click(zoomIn);

    // Drilled in: the "Back" control appears and the zoom targets are gone.
    const back = await waitFor(() => canvas.getByRole("button", { name: /^← work$/i }));
    await expect(canvas.queryByRole("button", { name: /zoom into/i })).toBeNull();

    // Zoom back out: the group targets return, the back control disappears.
    await userEvent.click(back);
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: /zoom into platform/i })).toBeInTheDocument();
    });
    expect(canvas.queryByRole("button", { name: /^← work$/i })).toBeNull();
  },
};

// #349: leaves are the keyboard datapoint targets — `onDatapointClick` is the
// ONLY click handler a non-drilldown chart carries.
function InteractiveDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[720px] flex-col gap-3">
      <div className="h-[420px]">
        <TreemapChart
          accessibleLabel="Where the work went"
          data={whereTheWorkWent}
          onDatapointClick={(point) => setSelected(point)}
        />
      </div>
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="drill-detail"
      >
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a tile to see its value."}
      </output>
    </div>
  );
}

/** Click a leaf — or Tab in and press Enter — to report its datum below. */
export const Interactive: Story = {
  render: () => <InteractiveDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");

    // Exactly one tab stop for the whole chart (roving tabindex).
    await expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (targets[0] as HTMLElement).focus();
    await expect(targets[0]).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(canvas.getByTestId("drill-detail")).toHaveTextContent(/via keyboard/);
  },
};
