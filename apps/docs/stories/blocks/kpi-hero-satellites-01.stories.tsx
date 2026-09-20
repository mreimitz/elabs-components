import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  nps,
  onTimeDelivery,
  ordersShipped,
  revenue,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiHeroSatellites } from "@/components/kpi-hero-satellites-01/kpi-hero-satellites";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Hero and Satellites",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What is the headline?",
      description: {
        component:
          "Answers “what's the headline?” — one hero KPI (a big value, a named comparison vs target and a 13-week trend against last year) with three compact satellite KPIs beside it, each a value + signed delta vs target + a tiny trend. One card, one separation gesture. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-hero-satellites-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiHeroSatellites>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiHeroSatellites /> };

export const OffTarget: Story = {
  render: () => (
    <KpiHeroSatellites
      heroMetric={{ ...revenue, actual: 2_180_000 }}
      satelliteMetrics={[
        { ...ordersShipped, actual: 4_900 },
        { ...onTimeDelivery, actual: 82 },
        { ...nps, actual: 24 },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiHeroSatellites loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiHeroSatellites />
    </div>
  ),
};
