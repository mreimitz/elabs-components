import type { Meta, StoryObj } from "@storybook/react-vite";
import { avgDeliveryHours } from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiStatusThreshold } from "@/components/kpi-status-threshold-01/kpi-status-threshold";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Should I act?",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “should I act?” — a status (icon + text, never colour alone) read against a visible on-track/at-risk/off-track threshold scale with today's value marked, plus how long the current status has held. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-status-threshold-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiStatusThreshold>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On-time delivery, at risk for 3 of its trailing 13 weeks. */
export const Default: Story = {
  render: () => (
    <div className="w-full max-w-[360px]">
      <KpiStatusThreshold />
    </div>
  ),
};

/** Avg delivery time — off track for its entire trailing 13-week window. */
export const Critical: Story = {
  render: () => (
    <div className="w-full max-w-[360px]">
      <KpiStatusThreshold metric={avgDeliveryHours} />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-full max-w-[360px]">
      <KpiStatusThreshold loading />
    </div>
  ),
};

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiStatusThreshold />
    </div>
  ),
};
