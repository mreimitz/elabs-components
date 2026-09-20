import type { Meta, StoryObj } from "@storybook/react-vite";
import { OnboardingChecklist } from "@/components/onboarding-checklist-01/onboarding-checklist";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: OnboardingChecklist,
  title: "Patterns/Blocks/Application/Onboarding Checklist",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A getting-started checklist that opens on the next thing to do, says how long each step takes, counts the minutes left on a `Meter`, and ends with a closing state instead of lingering.\n\nCopy-own it: `npx shadcn add onboarding-checklist-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof OnboardingChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
