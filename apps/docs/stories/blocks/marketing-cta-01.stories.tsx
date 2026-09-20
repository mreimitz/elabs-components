import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingCta,
  title: "Patterns/Blocks/Marketing/Call to Action",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The closing ask: one thing to do, one quieter alternative, and a line that says what trying it costs.\n\nCopy-own it: `npx shadcn add marketing-cta-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingCta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
