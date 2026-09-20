import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicScorecard } from "@/components/infographic-scorecard-01/infographic-scorecard";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Scorecard",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Give me the whole picture in one table.",
      description: {
        component:
          "The Power BI-style scorecard, done with an honest baseline on every number: one row per KPI — actual, target, a signed delta, a BulletChart progress-to-target, a 13-week trend, and a named status — in a horizontally scrollable Table. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-scorecard-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicScorecard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="p-6">
      <InfographicScorecard />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="p-6">
      <InfographicScorecard loading />
    </div>
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="w-[320px] p-6">
      <InfographicScorecard />
    </div>
  ),
};
