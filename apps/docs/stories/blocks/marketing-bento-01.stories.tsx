import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingBento } from "@/components/marketing-bento-01/marketing-bento";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingBento,
  title: "Patterns/Blocks/Marketing/Bento",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A `BentoGrid` of product proof where each tile shows the thing rather than describing it: a live `AreaChart` in the hero tile with a quiet `analytics` mean line, a `Meter`, a `Sparkline`, status badges. Marketing built from the same components the product is.\n\nCopy-own it: `npx shadcn add marketing-bento-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingBento>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
