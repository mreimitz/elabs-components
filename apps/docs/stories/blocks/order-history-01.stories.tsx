import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderHistory } from "@/components/order-history-01/order-history";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: OrderHistory,
  title: "Patterns/Blocks/Commerce/Order History",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where is my order, and what did I buy last time?",
      description: {
        component:
          "A customer’s order history: status, period and search filters that work together, and every order as a row that opens in place — the line items with token-painted thumbnails, the total in the shop’s currency, a placed → packed → shipped → delivered `Timeline` with the current step marked, and Track, Buy again and Invoice where they apply. Status is a badge with an icon and words, never colour alone, and the empty result says which filter to loosen.\n\nCopy-own it: `npx shadcn add order-history-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof OrderHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A brand-new account: no orders at all, so the page points at the shop instead of the filters. */
export const NoOrdersYet: Story = { args: { orders: [] } };

/** The same orders for a German customer — every date and amount reformats through `Intl`. */
export const GermanLocale: Story = { args: { locale: "de-DE", currency: "EUR" } };
