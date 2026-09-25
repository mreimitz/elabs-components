import type { Meta, StoryObj } from "@storybook/react-vite";
import { PriceEditor } from "@/components/grid-price-editor-01/price-editor";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Data Grids/Price Editor",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Edit a price list like a spreadsheet, publish it like a release.",
      description: {
        component:
          "A pricing manager edits next season’s list in place: type, paste a block from Excel, fill down with Ctrl/⌘+D, undo with Ctrl/⌘+Z. List price and discount are validated against an 18 % margin floor, net price and margin recompute live, and edited rows are marked (icon + tint) until the list is published or discarded (with Undo).\n\nCopy-own it: `npx shadcn add grid-price-editor-01` (pulls `grid-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PriceEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <PriceEditor /> };
