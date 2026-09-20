import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryLineSeasons } from "@/components/chart-story-line-seasons-01/chart-story-line-seasons";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryLineSeasons,
  title: "Patterns/Blocks/Editorial Charts/Seasons as Dots and Lines",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Is this year unusual, and is the decade?",
      description: {
        component:
          "A whole published figure: twenty seasons of daily readings as small dots coloured by decade, two average lines and the current year on top, the colour key carried by the title's own words, two notes on the cloud, method note, byline and linked source.\n\nCopy-own it: `npx shadcn add chart-story-line-seasons-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryLineSeasons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
