import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderReceipt } from "@/components/order-receipt-01/order-receipt";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: OrderReceipt,
  title: "Patterns/Blocks/Commerce/Order Receipt",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The page after paying: it worked, here is the order number, when it arrives and where, the lines, and what happens next as a `Timeline`.\n\nCopy-own it: `npx shadcn add order-receipt-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof OrderReceipt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
