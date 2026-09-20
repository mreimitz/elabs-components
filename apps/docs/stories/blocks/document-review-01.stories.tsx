import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentReview } from "@/components/document-review-01/document-review";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DocumentReview,
  title: "Patterns/Blocks/Documents/Document review",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I review a contract finding by finding?",
      description: {
        component:
          "Findings beside the contract they point at: selecting one scrolls to the clause and marks it, verdict buttons record the decision and advance the queue, and progress and the open filter derive from the verdicts.\n\nCopy-own it: `npx shadcn add document-review-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DocumentReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
