import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnswerWithSources } from "@/components/answer-with-sources-01/answer-with-sources";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AnswerWithSources,
  title: "Patterns/Blocks/Documents/Answer with sources",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does a reader check an AI answer against the documents it cites?",
      description: {
        component:
          "An answer whose numbered citations open the source document at the quoted sentence: the viewer swaps files, locates the quote, scrolls to it and marks it — and says so when a cited passage is not in the file.\n\nCopy-own it: `npx shadcn add answer-with-sources-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AnswerWithSources>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
