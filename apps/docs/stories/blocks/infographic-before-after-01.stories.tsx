import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicBeforeAfter } from "@/components/infographic-before-after-01/infographic-before-after";
import { revenueQ2ToQ3 } from "@/components/infographic-before-after-01/data/depot-before-after";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Who Improved, Who Slipped?",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'Answers “who improved, who slipped?” — a slope chart of 6 depots, Q2 → Q3, with the biggest riser and biggest faller emphasised and every other depot on a shared muted line; direction is carried by the line\'s own slope, never colour alone. Built on `DumbbellChart variant="slope"`. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-before-after-01` (pulls `kpi-card-parts`).',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicBeforeAfter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <InfographicBeforeAfter /> };

/** Same depot network, a different metric — revenue instead of on-time delivery. */
export const RevenueMetric: Story = {
  render: () => (
    <InfographicBeforeAfter data={revenueQ2ToQ3} metricLabel="Revenue" unit="currency" />
  ),
};

export const Loading: Story = { render: () => <InfographicBeforeAfter loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[320px]">
      <InfographicBeforeAfter />
    </div>
  ),
};
