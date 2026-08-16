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
