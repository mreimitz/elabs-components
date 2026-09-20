import type { Meta, StoryObj } from "@storybook/react-vite";
import { A2uiStreaming } from "@/components/a2ui-streaming-01/a2ui-streaming";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: A2uiStreaming,
  title: "Patterns/Blocks/Generative UI/Streaming surface",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What does the reader see while the agent is still writing?",
      description: {
        component:
          "The wire JSON beside the surface it becomes: A2uiSurface takes the streamed prefix, closes open brackets, prunes nodes that do not validate yet and paints the rest, with progress and replay.\n\nCopy-own it: `npx shadcn add a2ui-streaming-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof A2uiStreaming>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
