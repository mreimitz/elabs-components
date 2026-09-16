import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  deployReliabilityMetric,
  KpiStreak,
  slaComplianceMetric,
} from "@/components/kpi-streak-01/kpi-streak";
import type { StreakDay, StreakWindow } from "@/components/kpi-streak-01/data/streak-days";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/How Reliable Is It (Streak)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “how reliable is it?” — a ratio or a run headline over a 30-day strip of day cells, a missed day marked by shape as well as colour (hollow, with a cross) so the pattern survives greyscale, plus the current and longest streaks and a comparison to the prior 30 days. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-streak-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiStreak>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiStreak /> };

/** Every fourth day flipped to missed/incident — both streaks break almost immediately. */
function degrade(window: StreakWindow): StreakWindow {
  const worsen = (days: StreakDay[]) =>
    days.map((day, i) => (i % 4 === 0 ? { ...day, met: false } : day));
  return { days: worsen(window.days), priorDays: window.priorDays };
}

export const OffTarget: Story = {
  render: () => (
    <KpiStreak
      metrics={[
        { ...slaComplianceMetric, window: degrade(slaComplianceMetric.window) },
        { ...deployReliabilityMetric, window: degrade(deployReliabilityMetric.window) },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiStreak loading /> };

export const Compact: Story = {
  render: () => (
    // The block's own grid is `sm:grid-cols-2` — a VIEWPORT breakpoint, so it
    // still fires inside this narrow wrapper on a wide screen. Force a single
    // column so one metric renders as one real 280px-wide card, not half of it.
    <div className="w-[280px]">
      <KpiStreak gridClassName="sm:grid-cols-1" metrics={[deployReliabilityMetric]} />
    </div>
  ),
};
