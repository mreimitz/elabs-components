import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingHero } from "@/components/marketing-hero/marketing-hero";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingHero,
  title: "Patterns/Blocks/Marketing/Hero",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A landing hero: eyebrow, headline, supporting line, two calls to action and a logo strip.\n\nCopy-own it: `npx shadcn add marketing-hero`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The hero with placeholder copy and four wordmarks. */
export const Default: Story = {};
