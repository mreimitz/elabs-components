import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingTeam } from "@/components/marketing-team-01/marketing-team";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingTeam,
  title: "Patterns/Blocks/Marketing/Team",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The people: a name, what they do, and one line that is about them rather than their title. Container-query columns.\n\nCopy-own it: `npx shadcn add marketing-team-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingTeam>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
