import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommandCenterRevenue } from "@/components/command-center-revenue-01/command-center-revenue";
import { topAccounts } from "@/components/command-center-revenue-01/data/revenue-command";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CommandCenterRevenue,
  title: "Patterns/Blocks/Command Centers/Revenue Desk",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How is the quarter going, and what decides it?",
      description: {
        component:
          'A whole revenue desk in one block: a `MetricGrid` of four headline numbers that each name their baseline and carry a 13-week `Sparkline`, a `ComposedChart` of weekly revenue with its trailing average against a labelled plan rule plus `analytics={[{ kind: "trend", model: "linear" }, { kind: "forecast", horizon: 4, interval: 0.9 }]}` for the trend and a four-week forecast tail, a donut `PieChart` of the service-line mix, a `BumpChart` of which line is climbing, and the accounts that decide the quarter with a `Meter` each. Every card title states the finding, not the chart type. The layout follows its container, not the viewport, so it holds in a dashboard column as well as on a full page.\n\nCopy-own it: `npx shadcn add command-center-revenue-01`.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CommandCenterRevenue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every tile holds its final shape while the numbers load. */
export const Loading: Story = { args: { loading: true } };

/** Only the accounts that need a conversation this week. */
export const AccountsAtRisk: Story = {
  args: { accounts: topAccounts.filter((account) => account.risk !== "on track") },
};

/** In a dashboard column: one tile per row, the same block. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <CommandCenterRevenue {...args} />
    </div>
  ),
};
