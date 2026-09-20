import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingStats } from "@/components/marketing-stats-01/marketing-stats";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingStats,
  title: "Patterns/Blocks/Marketing/Stats and Logos",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proof in two rows: a `StatsBand` of the numbers, then a `LogoStrip` of who stands behind them. Text wordmarks are the default; pass your customers' real marks.\n\nCopy-own it: `npx shadcn add marketing-stats-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
