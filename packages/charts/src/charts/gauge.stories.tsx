"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Gauge } from "./gauge";

const meta = {
  title: "Charts/Gauge",
  component: Gauge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A radial dial that reads one value as a colored, notched arc against 0 to 100, " +
          "with optional milestone dots and a “N to go” caption for the next one — the read " +
          "for a score, a completion percentage, or a value against a target or threshold " +
          "band. The similarly circular `RingChart` reads a single proportion of its own " +
          "maximum instead of a value against a target; see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof Gauge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Notched arc gauge, no milestones — the pre-existing (unaffected) default. */
export const Default: Story = {
  render: (args) => (
    <div className="h-56 w-[360px]">
      <Gauge {...args} />
    </div>
  ),
  args: {
    value: 62,
    centerValue: 62,
    suffix: "%",
    defaultLabel: "Score",
  },
};

/**
 * Milestone dots at 25/50/75/100 with a "N ticks to go" caption — lieflat F11.
 * `totalNotches={40}` and `value={32}` reproduce the finding's own example
 * (`32% ⇒ 13 active notches ⇒ 27 remaining` → "27 TICKS TO GO").
 */
export const WithMilestones: Story = {
  name: "With milestones (F11)",
  render: (args) => (
    <div className="h-56 w-[360px]">
      <Gauge {...args} />
    </div>
  ),
  args: {
    value: 32,
    centerValue: 32,
    suffix: "%",
    defaultLabel: "Progress",
    totalNotches: 40,
    milestones: [25, 50, 75, 100],
    remainingLabel: (remaining) => `${remaining} ticks to go`,
  },
};

/** Milestones alone, no caption — the two additive props are independent. */
export const MilestonesOnly: Story = {
  render: (args) => (
    <div className="h-56 w-[360px]">
      <Gauge {...args} />
    </div>
  ),
  args: {
    value: 85,
    centerValue: 85,
    suffix: "%",
    defaultLabel: "Uptime",
    milestones: [25, 50, 75, 100],
  },
};
