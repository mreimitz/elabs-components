import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingFooter } from "@/components/marketing-footer-01/marketing-footer";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingFooter,
  title: "Patterns/Blocks/Marketing/Footer",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The site footer: what the product is in one line, three link columns as labelled `nav` landmarks, and the legal row. The year is a prop, so the block renders the same every time.\n\nCopy-own it: `npx shadcn add marketing-footer-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
