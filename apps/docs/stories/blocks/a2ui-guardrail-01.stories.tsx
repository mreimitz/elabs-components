import type { Meta, StoryObj } from "@storybook/react-vite";
import { A2uiGuardrail } from "@/components/a2ui-guardrail-01/a2ui-guardrail";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: A2uiGuardrail,
  title: "Patterns/Blocks/Generative UI/Catalog guardrail",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What stops an agent from restyling the app or embedding a script?",
      description: {
        component:
          "A surface that tries custom styles, an iframe, an inline handler and an unknown event, refused with every problem and its path, next to the repaired surface the agent sent after reading that list.\n\nCopy-own it: `npx shadcn add a2ui-guardrail-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof A2uiGuardrail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
