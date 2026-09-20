import type { Meta, StoryObj } from "@storybook/react-vite";
import { FlowCanvas } from "@/components/flow-canvas/flow-canvas";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: FlowCanvas,
  title: "Patterns/Blocks/Process and Flow/Flow Canvas",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The smallest useful flow canvas: `CanvasShell` with the brand node and edge types, controlled node and edge state, and zoom controls. Start here when the builder is more than you need.\n\nCopy-own it: `npx shadcn add flow-canvas`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FlowCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two connected nodes on a pannable, zoomable canvas. */
export const Default: Story = {};
