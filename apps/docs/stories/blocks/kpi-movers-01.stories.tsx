import type { Meta, StoryObj } from "@storybook/react-vite";
import { KpiMovers } from "@/components/kpi-movers-01/kpi-movers";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Movers",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What changed most?",
      description: {
        component:
          "Answers “what changed most?” — the top 3 risers and top 3 fallers in a ranked depot field (on-time delivery, revenue), each row stating its rank, how many places it moved, and a diverging mini bar from a shared, stated zero axis. Distinct from `stat-list-01`'s single-snapshot share bars: this is about movement between two points in time. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-movers-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiMovers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiMovers /> };

/** A quiet quarter — every depot's on-time delivery held within a point of last quarter, so the scale shrinks to match. */
export const TightRace: Story = {
  render: () => (
    <KpiMovers
      onTimeData={[
        { id: "berlin", label: "Berlin", current: 92.4, prior: 91.6 },
        { id: "munich", label: "Munich", current: 92.1, prior: 91.5 },
        { id: "hamburg", label: "Hamburg", current: 91.9, prior: 91.4 },
        { id: "cologne", label: "Cologne", current: 91.7, prior: 91.5 },
        { id: "frankfurt", label: "Frankfurt", current: 91.5, prior: 91.4 },
        { id: "stuttgart", label: "Stuttgart", current: 91.3, prior: 91.4 },
        { id: "dusseldorf", label: "Düsseldorf", current: 91.1, prior: 91.5 },
        { id: "leipzig", label: "Leipzig", current: 90.9, prior: 91.4 },
        { id: "dresden", label: "Dresden", current: 90.7, prior: 91.5 },
        { id: "nuremberg", label: "Nuremberg", current: 90.5, prior: 91.6 },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiMovers loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiMovers count={2} only="onTime" />
    </div>
  ),
};
