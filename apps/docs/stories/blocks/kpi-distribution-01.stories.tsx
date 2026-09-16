import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  deliveryTimeMetric,
  KpiDistribution,
  pickTimeMetric,
} from "@/components/kpi-distribution-01/kpi-distribution";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Is It Consistent (Distribution)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “is it consistent?” — an average hides the tail, so this card shows the median next to p90/p95 read against a named SLA threshold, backed by the actual record-level distribution (a box plot) with the threshold drawn as a reference line and the share past it stated in text. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-distribution-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiDistribution>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiDistribution /> };

export const OffTarget: Story = {
  render: () => (
    // A synthetically worse tail on both metrics (every sample scaled up
    // 45%) — p90 misses both named SLAs by a wide margin, so both cards read
    // "off track", including the pick-time card, which is "on track" by
    // default (delivery time already breaches its SLA in the default story).
    <KpiDistribution
      metrics={[
        { ...deliveryTimeMetric, samples: deliveryTimeMetric.samples.map((v) => v * 1.45) },
        { ...pickTimeMetric, samples: pickTimeMetric.samples.map((v) => v * 1.45) },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiDistribution loading /> };

export const Compact: Story = {
  render: () => (
    // The block's own grid is `sm:grid-cols-2` — a VIEWPORT breakpoint, so it
    // still fires inside this narrow wrapper on a wide screen. Force a single
    // column so one metric renders as one real 280px-wide card, not half of it.
    <div className="w-[280px]">
      <KpiDistribution gridClassName="sm:grid-cols-1" metrics={[deliveryTimeMetric]} />
    </div>
  ),
};
