import type { Meta, StoryObj } from "@storybook/react-vite";
import { KpiRatioUnit } from "@/components/kpi-ratio-unit-01/kpi-ratio-unit";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/How Big Is It (Ratio/Unit)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “how big is it in human terms?” — a rate restated as a small, countable fraction (“1 in 12 orders arrived late”) via `UnitChart`, with the exact rate spelled out right beneath the rounded headline and a comparison vs last year. Highlighted units use an accent fill against a neutral rest rather than hue alone. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-ratio-unit-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiRatioUnit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiRatioUnit /> };

/** A worse quarter: more late orders, fewer promoters. */
export const Declining: Story = {
  render: () => (
    <KpiRatioUnit
      latePct={19}
      latePctPriorYear={8.6}
      promoters={{ promotersPct: 44, passivesPct: 40, detractorsPct: 16 }}
      promotersPriorYear={{ promotersPct: 50, passivesPct: 42, detractorsPct: 8 }}
    />
  ),
};

export const Loading: Story = { render: () => <KpiRatioUnit loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiRatioUnit only="late" />
    </div>
  ),
};
