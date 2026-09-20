import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductDetail } from "@/components/product-detail-01/product-detail";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProductDetail,
  title: "Patterns/Blocks/Commerce/Product Detail",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A product page: options that must be chosen before buying (the button says which one is missing), a quantity `NumberInput` capped by stock, delivery promises as facts, a read-only `Rating`, and the details in an `Accordion`.\n\nCopy-own it: `npx shadcn add product-detail-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProductDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
