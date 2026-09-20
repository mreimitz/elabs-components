import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingFaq } from "@/components/marketing-faq-01/marketing-faq";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingFaq,
  title: "Patterns/Blocks/Marketing/FAQ",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Questions before buying in an `Accordion` with the first one open, beside a person to ask when the answer is not there.\n\nCopy-own it: `npx shadcn add marketing-faq-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingFaq>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
