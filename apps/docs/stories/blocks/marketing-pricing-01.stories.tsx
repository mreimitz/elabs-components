import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingPricing } from "@/components/marketing-pricing-01/marketing-pricing";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingPricing,
  title: "Patterns/Blocks/Marketing/Pricing",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Three plans named for who they are for, a billing toggle that recomputes every price, locale-aware currency, and one plan marked as the usual choice in words as well as with a border.\n\nCopy-own it: `npx shadcn add marketing-pricing-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingPricing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Euro prices with a smaller yearly discount. */
export const Euro: Story = { args: { currency: "EUR", locale: "de-DE", yearlyDiscount: 0.1 } };
