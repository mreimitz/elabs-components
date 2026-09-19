import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommandCenterLaunchPlan } from "@/components/command-center-launch-plan-01/command-center-launch-plan";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CommandCenterLaunchPlan,
  title: "Patterns/Blocks/Command Centers/Launch Plan",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Will we make the date, and what is in the way?",
      description: {
        component:
          "A launch on one screen. The charts package's `Gantt` carries the plan — summary rows, dependencies, a baseline under the task that slipped, a milestone, and markers for today and go-live — and selecting a task spells it out in a `Descriptions` panel: dates, baseline, what it waits for, progress. The headline counts the days left and the tasks past baseline from the same task list.\n\nCopy-own it: `npx shadcn add command-center-launch-plan-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CommandCenterLaunchPlan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A plan with nothing past baseline — the headline says so. */
export const OnBaseline: Story = {
  args: {
    tasks: [
      { id: "a", name: "Site ready", start: "2026-09-01", end: "2026-09-25", progress: 80 },
      {
        id: "b",
        name: "Fit-out",
        start: "2026-09-21",
        end: "2026-10-16",
        progress: 20,
        dependencies: ["a"],
      },
      {
        id: "c",
        name: "Go live",
        start: "2026-11-02",
        end: "2026-11-02",
        isMilestone: true,
        dependencies: ["b"],
      },
    ],
  },
};
