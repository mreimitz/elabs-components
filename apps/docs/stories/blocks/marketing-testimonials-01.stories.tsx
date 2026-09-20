import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingTestimonials } from "@/components/marketing-testimonials-01/marketing-testimonials";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingTestimonials,
  title: "Patterns/Blocks/Marketing/Testimonials",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A wall of quotes: each with who said it, their role, and a read-only `Rating` where the quote came with one. Masonry columns, so long and short quotes sit together.\n\nCopy-own it: `npx shadcn add marketing-testimonials-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingTestimonials>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
