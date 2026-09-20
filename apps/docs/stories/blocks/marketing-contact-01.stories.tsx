import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingContact } from "@/components/marketing-contact-01/marketing-contact";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingContact,
  title: "Patterns/Blocks/Marketing/Contact",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A short contact form with a topic `Select`, errors after the first attempt, a confirmation that uses the sender's first name, and the other ways to reach the team beside it.\n\nCopy-own it: `npx shadcn add marketing-contact-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingContact>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
