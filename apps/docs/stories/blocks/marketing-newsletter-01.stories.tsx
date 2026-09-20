import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingNewsletter,
  title: "Patterns/Blocks/Marketing/Newsletter",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "One field, a promise about frequency, validation on submit, and a confirmation that names the address.\n\nCopy-own it: `npx shadcn add marketing-newsletter-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingNewsletter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The list refused the address: the message lands on the field. */
export const Rejected: Story = {
  args: { onSubscribe: () => "That address is already subscribed." },
};
