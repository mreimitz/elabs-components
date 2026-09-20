import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductGrid } from "@/components/product-grid-01/product-grid";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProductGrid,
  title: "Patterns/Blocks/Commerce/Product Grid",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A product listing: a category filter, sorting, and cards that tell the truth about stock — a markdown as a percentage, `3 left` and `sold out` as words on the card, and a sold-out product that cannot be added. Product art is a token-painted stand-in that follows the theme; swap in your photography.\n\nCopy-own it: `npx shadcn add product-grid-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProductGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
