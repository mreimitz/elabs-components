import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toaster } from "@elabs-ai/components-ui";
import { OrdersDetail } from "@/components/grid-orders-detail-01/orders-detail";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Data Grids/Orders Detail",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Every order opens into its line items.",
      description: {
        component:
          "A fulfilment queue with master / detail: each order expands (`renderDetail`) into its line items, delivery details and per-order actions. Floating filters under the headers, value-list filters with counts on channel, status and city, and a status badge that carries an icon as well as a colour.\n\nCopy-own it: `npx shadcn add grid-orders-detail-01` (pulls `grid-parts`).",
      },
    },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof OrdersDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <OrdersDetail /> };
