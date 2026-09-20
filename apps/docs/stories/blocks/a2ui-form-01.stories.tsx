import type { Meta, StoryObj } from "@storybook/react-vite";
import { A2uiForm } from "@/components/a2ui-form-01/a2ui-form";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: A2uiForm,
  title: "Patterns/Blocks/Generative UI/Agent-built form",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does an agent collect structured input from a person?",
      description: {
        component:
          "A form the agent pre-filled from an alert: inputs, selects, radios, a slider and switches from the catalog. Every change is a named action the host folds into one draft, shown live; submit hands the draft over and the agent answers with a timeline.\n\nCopy-own it: `npx shadcn add a2ui-form-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof A2uiForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
