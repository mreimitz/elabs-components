import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingFeatures } from "@/components/marketing-features-01/marketing-features";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingFeatures,
  title: "Patterns/Blocks/Marketing/Features",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A feature section: a `SectionHeader` that says what the product is in the visitor's words, then a `FeatureGrid` of six reasons, each an outcome rather than a capability.\n\nCopy-own it: `npx shadcn add marketing-features-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingFeatures>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Four reasons in two columns. */
export const TwoColumns: Story = { args: { columns: 2 } };
