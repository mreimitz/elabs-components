import type { Meta, StoryObj } from "@storybook/react-vite";
import { Clock, Wallet } from "lucide-react";
import { MarketingCompare } from "@/components/marketing-compare-01/marketing-compare";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingCompare,
  title: "Patterns/Blocks/Marketing/Compare",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Why this instead of what we use today?",
      description: {
        component:
          "Us against the alternatives, honestly: a row per criterion with a yes, partly or no mark and a sentence of verdict per column, including the rows a spreadsheet wins. A last row says who each option is best for. A table when the container is wide, one card per criterion when it is not.\n\nCopy-own it: `npx shadcn add marketing-compare-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Two columns only — us against the one tool the reader is leaving. */
export const AgainstOneTool: Story = {
  args: {
    title: "Beacon or the BI suite you renew next quarter",
    description: "Two rows go to the incumbent. We would rather you knew.",
    options: [
      { id: "beacon", name: "Beacon", ours: true },
      { id: "legacy", name: "Legacy BI suite" },
    ],
    rows: [
      {
        id: "first-chart",
        criterion: "Time to a first chart",
        icon: Clock,
        cells: [
          { verdict: "yes", text: "Minutes." },
          { verdict: "no", text: "Weeks, after the model." },
        ],
      },
      {
        id: "cost",
        criterion: "Cost for a team of 25",
        icon: Wallet,
        cells: [
          { verdict: "partly", text: "$1,200 a month." },
          { verdict: "no", text: "$4,000 a month plus an admin." },
        ],
      },
    ],
    bestFor: ["Teams asking new questions daily.", "Signed-off regulatory reporting."],
  },
};
