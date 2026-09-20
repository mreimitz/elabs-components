import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryLineProjection } from "@/components/chart-story-line-projection-01/chart-story-line-projection";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryLineProjection,
  title: "Patterns/Blocks/Editorial Charts/Lines With Projection",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "When do they cross, and how much of that is forecast?",
      description: {
        component:
          "A whole published figure: two crossing lines named at their ends, a shaded and labelled plan range in which the lines turn dashed, an arrowed note at the crossing, the colour key written into the description, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-line-projection-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryLineProjection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
