import type { Meta, StoryObj } from "@storybook/react-vite";
import MarketDeskPage from "@/components/market-desk-page/market-desk-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketDeskPage,
  title: "Patterns/Templates/Analytics/Market Desk",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For pricing, trading and treasury products",
      description: {
        component:
          "Watch the market, then act on it. The `command-center-market-tape-01` block is the read side; a watchlist `DataTable` row click pre-fills the ticket; and the docked order ticket is a real form — `FieldRoot` validation that speaks in the trader's terms, a `NumberInput`, a computed commitment checked against a ticket limit, a review step before anything is placed, and a blotter that fills as orders go in.\n\nCopy-own it: `npx shadcn add market-desk-page`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketDeskPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
