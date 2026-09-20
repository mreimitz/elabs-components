import type { Meta, StoryObj } from "@storybook/react-vite";
import { nps, revenue } from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiMultiBaseline } from "@/components/kpi-multi-baseline-01/kpi-multi-baseline";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Multi-baseline",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Compared to what?",
      description: {
        component:
          "Answers “compared to what?” — one wide card per KPI stacking three named baselines (target, last year, budget), each with a shared-scale dot strip so the same number's distance to every reference reads at a glance. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-multi-baseline-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiMultiBaseline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiMultiBaseline /> };

export const OffTarget: Story = {
  render: () => (
    <KpiMultiBaseline
      metrics={[
        { ...revenue, actual: 2_180_000 },
        { ...nps, actual: 29 },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiMultiBaseline loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiMultiBaseline metrics={[revenue]} />
    </div>
  ),
};
