import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicSmallMultiples } from "@/components/infographic-small-multiples-01/infographic-small-multiples";
import { onTimeByRegionPositiveOutlier } from "@/components/infographic-small-multiples-01/data/region-on-time";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Small Multiples",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Which one is the outlier?",
      description: {
        component:
          'Answers “which region is the outlier?” — twelve depots in a `ChartMultiples` grid, one 13-week line per panel, every panel on the SAME y-axis so height compares directly. Every panel carries the SAME `analytics` line (`{ kind: "line", value: <network mean>, label: "none" }`), named once in the “how to read” copy rather than per panel. Each panel title carries its depot’s latest reading, replaced by the hovered week’s reading while any panel is hovered, so one hover reads the same week across all twelve. The outlier is ringed, thicker and glyphed, never coloured alone. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-small-multiples-01` (pulls `kpi-card-parts`).',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicSmallMultiples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <InfographicSmallMultiples /> };

/** Same twelve-depot network, a different quarter's story: one depot pulls dramatically ahead instead of one falling behind. */
export const PositiveOutlier: Story = {
  render: () => <InfographicSmallMultiples regions={onTimeByRegionPositiveOutlier} />,
};

export const Loading: Story = { render: () => <InfographicSmallMultiples loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[320px]">
      <InfographicSmallMultiples />
    </div>
  ),
};
