import type { Meta, StoryObj } from "@storybook/react-vite";
import { marketLanes } from "@/components/command-center-market-tape-01/data/market";
import { CommandCenterMarketTape } from "@/components/command-center-market-tape-01/command-center-market-tape";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CommandCenterMarketTape,
  title: "Patterns/Blocks/Command Centers/Market Tape",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where is the market, and what moved it?",
      description: {
        component:
          "A rate desk. A tape of lanes runs across the top — price, move and a 20-day `Sparkline` each — over a `CandlestickChart` of the index and a `BarChart` of the volume that traded each day. Every move carries an arrow and a sign as well as a colour; the chart title is computed from the first open and the last close.\n\nCopy-own it: `npx shadcn add command-center-market-tape-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CommandCenterMarketTape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Three lanes: the tape drops to a single row. */
export const ShortTape: Story = { args: { lanes: marketLanes.slice(0, 3) } };
