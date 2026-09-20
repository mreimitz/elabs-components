import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShoppingCart } from "@/components/shopping-cart-01/shopping-cart";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ShoppingCart,
  title: "Patterns/Blocks/Commerce/Shopping Cart",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The cart: quantities capped by stock, a line you can remove and undo, a discount code that answers either way (try TRAIL10), progress toward free delivery on a `Meter`, and totals that always add up.\n\nCopy-own it: `npx shadcn add shopping-cart-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ShoppingCart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nothing in it: the summary stays and the checkout button is disabled. */
export const Empty: Story = { args: { defaultLines: [] } };
