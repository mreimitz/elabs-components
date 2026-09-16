import type { Meta, StoryObj } from "@storybook/react-vite";

import { Sparkline } from "./sparkline";

const meta = {
  title: "Charts/Sparkline",
  component: Sparkline,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

const ACTIVITY = [2, 5, 1, 8, 4, 12, 7, 18];

export const Default: Story = {
  args: { values: ACTIVITY, label: "Edits per week" },
};

export const Line: Story = {
  args: { values: ACTIVITY, variant: "line", label: "Trend" },
};

export const InText: Story = {
  args: { values: ACTIVITY },
  render: (args) => (
    <p className="flex items-center gap-2 text-body text-foreground">
      23 revisions <Sparkline {...args} /> over 8 weeks
    </p>
  ),
};

export const Empty: Story = {
  args: { values: [] },
};

export const WithTarget: Story = {
  args: { values: ACTIVITY, target: 15, label: "Edits per week, against a target of 15" },
};

export const WithBaseline: Story = {
  args: {
    values: ACTIVITY,
    baseline: [4, 3, 6, 5, 9, 8, 5, 11],
    labels: { baseline: "last year" },
  },
};

export const WithBand: Story = {
  args: { values: ACTIVITY, band: [4, 10], variant: "line" },
};

export const AllReferences: Story = {
  args: {
    values: ACTIVITY,
    variant: "line",
    target: 15,
    baseline: [4, 3, 6, 5, 9, 8, 5, 11],
    band: [4, 10],
    showLastValue: true,
    labels: { baseline: "last year" },
    width: 120,
  },
};

export const BarWithTarget: Story = {
  args: { values: ACTIVITY, target: 15, showLastValue: true, width: 120 },
};

/**
 * `fit="fill"` measures its own CSS box (here a 288px-wide container) and
 * draws the plot at that real pixel width instead of stretching a mismatched
 * viewBox to fit — no distorted strokes, dot or last-value label. Compare to
 * `Default`, which stays at its fixed `width`/`height` no matter the box.
 */
export const FillContainer: Story = {
  name: 'Fill container (fit="fill")',
  args: { values: ACTIVITY, variant: "line", showLastValue: true, fit: "fill" },
  render: (args) => (
    <div className="w-72">
      <Sparkline {...args} className="w-full" />
    </div>
  ),
};
