import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiChartBlock } from "@/components/ai-chart/ai-chart-block";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AiChartBlock,
  title: "Patterns/Blocks/AI and Terminal/AI Chart",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A model's chart tool-output rendered inside a conversation: `AutoChart` picks the chart from the spec, wrapped in `Tool` and `ToolOutput` so the reader sees what was called and what came back.\n\nCopy-own it: `npx shadcn add ai-chart`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AiChartBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One assistant turn that answers with a chart. */
export const Default: Story = {};
