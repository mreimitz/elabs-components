import type { Meta, StoryObj } from "@storybook/react-vite";
import { incidentCohorts } from "@/components/infographic-cohort-retention-01/data/cohort-retention";
import { InfographicCohortRetention } from "@/components/infographic-cohort-retention-01/infographic-cohort-retention";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Cohort Retention",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “do customers stay?” — a triangular cohort retention heatmap: one row per monthly signup cohort, one column per month since signup, shaded by the share still active. A cohort younger than N months draws an empty cell, never a fabricated zero. One cohort is called out with a peak ring and a stated, computed gap against its named peers. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-cohort-retention-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicCohortRetention>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <InfographicCohortRetention /> };

export const WorseningCohorts: Story = {
  render: () => <InfographicCohortRetention scenario={incidentCohorts} />,
};

export const Loading: Story = { render: () => <InfographicCohortRetention loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[320px]">
      <InfographicCohortRetention />
    </div>
  ),
};
