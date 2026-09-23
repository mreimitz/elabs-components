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
          'A rate desk. A tape of lanes runs across the top — price, move and a 20-day `Sparkline` each — over a `CandlestickChart` of the 120-day index and a `BarChart` of the volume that traded each day. The candles carry `analytics={[{ kind: "window", k: 20, label: "20-day average" }, { kind: "window", k: 50, reduce: "ewm", label: "EMA 50" }]}` and a `scrollbar="miniChart"` strip over a controlled `window` (`align="end"`, opening on the last 60 trading days); the volume chart follows the same window and draws its own mean line. Every move carries an arrow and a sign as well as a colour; the headline and range figures are computed over the window on screen.\n\nCopy-own it: `npx shadcn add command-center-market-tape-01`.',
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
