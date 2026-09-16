import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  avgDeliveryHours,
  nps,
  ordersShipped,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiTrendReference } from "@/components/kpi-trend-reference-01/kpi-trend-reference";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Better Or Worse Than Normal (Trend)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “better or worse than normal?” — a 13-week Sparkline trend read against a target pace, last year, and a normal operating band, with a text legend spelling out the line styles so the encoding never rides on colour alone. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-trend-reference-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiTrendReference>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiTrendReference /> };

export const OffTarget: Story = {
  render: () => (
    <KpiTrendReference
      metrics={[
        { ...ordersShipped, actual: 4_900, weekly: [...ordersShipped.weekly.slice(0, -1), 520] },
        {
          ...avgDeliveryHours,
          actual: 41.8,
          weekly: [...avgDeliveryHours.weekly.slice(0, -1), 41.8],
        },
        { ...nps, actual: 24, weekly: [...nps.weekly.slice(0, -1), 24] },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiTrendReference loading /> };

export const Compact: Story = {
  render: () => (
    // Force a single column — see the matching note in
    // kpi-target-bullet-01.stories.tsx (the grid's `sm:`/`lg:` columns are a
    // viewport breakpoint, not a container one, #…).
    <div className="w-[280px]">
      <KpiTrendReference gridClassName="sm:grid-cols-1 lg:grid-cols-1" metrics={[ordersShipped]} />
    </div>
  ),
};
