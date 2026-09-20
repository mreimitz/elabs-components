import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkout } from "@/components/checkout-01/checkout";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: Checkout,
  title: "Patterns/Blocks/Commerce/Checkout",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One-page checkout: contact, delivery and payment in labelled groups, every field with the right `autocomplete`, errors after the first attempt with focus moved to the first one, a delivery `RadioGroup` that changes the total (and drops the address for pick-up), and a payment slot where your provider's hosted card field mounts — card numbers never pass through the block.\n\nCopy-own it: `npx shadcn add checkout-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Checkout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
