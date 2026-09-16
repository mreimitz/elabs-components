import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  onTimeDelivery,
  ordersQtd,
  revenueQtd,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiPace } from "@/components/kpi-pace-01/kpi-pace";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/On Pace (Progress + Gauge)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “will I make it by period end?” — quarter-to-date Progress bars with a marker for the expected pace and a computed days-ahead/behind status, plus a Gauge card reading a rate KPI against its target and thresholds. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-pace-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiPace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiPace /> };

export const OffTarget: Story = {
  render: () => (
    <KpiPace
      gaugeMetric={{ ...onTimeDelivery, actual: 78 }}
      ordersProgress={{ ...ordersQtd, actual: 4_800 }}
      revenueProgress={{ ...revenueQtd, actual: 2_180_000 }}
    />
  ),
};

export const Loading: Story = { render: () => <KpiPace loading /> };

export const Compact: Story = {
  render: () => (
    // Force a single column — see the matching note in
    // kpi-target-bullet-01.stories.tsx (the grid's `sm:`/`lg:` columns are a
    // viewport breakpoint, not a container one, #…).
    <div className="w-[280px]">
      <KpiPace
        className="sm:grid-cols-1 lg:grid-cols-1"
        gaugeMetric={onTimeDelivery}
        ordersProgress={ordersQtd}
        revenueProgress={revenueQtd}
      />
    </div>
  ),
};
