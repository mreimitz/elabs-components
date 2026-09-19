import type { Meta, StoryObj } from "@storybook/react-vite";
import { FlowBuilder } from "@/components/flow-builder/flow-builder";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: FlowBuilder,
  title: "Patterns/Blocks/Process and Flow/Flow Builder",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A workflow builder on the flow canvas: a node palette, auto-layout, grouping, placeholder nodes that grow the graph, insert-between on an edge, an inspector for the selected node, and copy-own undo/redo and copy/paste hooks that live beside the block. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add flow-builder`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FlowBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The builder with its starter graph: drag from the palette, press the plus on an edge, select a node to inspect it. */
export const Default: Story = {};
