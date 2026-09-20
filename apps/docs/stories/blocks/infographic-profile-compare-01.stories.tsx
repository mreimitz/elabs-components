import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicProfileCompare } from "@/components/infographic-profile-compare-01/infographic-profile-compare";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: InfographicProfileCompare,
  title: "Patterns/Blocks/Infographics/Profile Compare",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do the options compare?",
      description: {
        component:
          "Two views of the same choice: a `RadarChart` with one shape per option across five scored promises, and a `ParallelCoordinatesChart` of the raw measures behind those scores, one line per option, every axis on its own scale. The headline names the strongest profile and the promise it is weakest on.\n\nCopy-own it: `npx shadcn add infographic-profile-compare-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicProfileCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Two options instead of three — the shapes read more easily head to head. */
export const HeadToHead: Story = {
  args: {
    profiles: [
      {
        label: "Norden Freight",
        values: { onTime: 92, damageFree: 88, coverage: 61, cost: 54, tracking: 90 },
      },
      {
        label: "Pelican Lines",
        values: { onTime: 85, damageFree: 95, coverage: 72, cost: 83, tracking: 58 },
      },
    ],
  },
};
