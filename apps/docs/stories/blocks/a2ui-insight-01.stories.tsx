import type { Meta, StoryObj } from "@storybook/react-vite";
import { A2uiInsight } from "@/components/a2ui-insight-01/a2ui-insight";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: A2uiInsight,
  title: "Patterns/Blocks/Generative UI/Analytics answer with charts",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does an agent answer a data question with more than text?",
      description: {
        component:
          "An A2UI answer composed by the agent: a headline, KPI tiles with sparklines, two AutoChart figures titled with their findings, the method and follow-up actions. A click on the chart drills into the next surface.\n\nCopy-own it: `npx shadcn add a2ui-insight-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof A2uiInsight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
