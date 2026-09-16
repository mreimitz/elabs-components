import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicGapToBenchmark } from "@/components/infographic-gap-to-benchmark-01/infographic-gap-to-benchmark";
import {
  COST_BENCHMARK,
  costVsBenchmark,
} from "@/components/infographic-gap-to-benchmark-01/data/depot-vs-benchmark";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/How Far From The Benchmark?",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “how far from the benchmark?” — a sorted `DumbbellChart`, one row per depot, hollow benchmark marker vs filled actual marker, worst gap first, with the widest gaps emphasised. Correctly flips the gap's sign for a lower-is-better metric (`higherIsBetter={false}`) so “ahead of benchmark” always means the same thing. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-gap-to-benchmark-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicGapToBenchmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <InfographicGapToBenchmark /> };

/** A lower-is-better metric — the gap's sign flips correctly: a depot COSTING MORE than benchmark is the bad direction now. */
export const CostMetricLowerIsBetter: Story = {
  render: () => (
    <InfographicGapToBenchmark
      benchmark={COST_BENCHMARK}
      benchmarkLabel="industry average cost per shipment"
      higherIsBetter={false}
      metricLabel="cost per shipment"
      points={costVsBenchmark}
      unit="currency"
    />
  ),
};

export const Loading: Story = { render: () => <InfographicGapToBenchmark loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[320px]">
      <InfographicGapToBenchmark />
    </div>
  ),
};
