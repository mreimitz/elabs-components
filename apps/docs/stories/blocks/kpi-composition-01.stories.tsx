import type { Meta, StoryObj } from "@storybook/react-vite";
import { KpiComposition } from "@/components/kpi-composition-01/kpi-composition";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Composition",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What is it made of?",
      description: {
        component:
          "Answers “what is it made of?” — a 100%-stacked segmented bar per card plus a legend list that is the accessible source of truth: label, share, absolute value, and the share's own change vs last year in pp. Bar and legend share one order (largest first) and a rank number so colour is never the only link between a segment and its row; shares under 3% merge into “Other”. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-composition-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiComposition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiComposition /> };

/** A concentrated distribution: two long-tail regions fall under the 3% merge threshold at once. */
export const Concentrated: Story = {
  render: () => (
    <KpiComposition
      cards={[
        {
          title: "Shipments by region",
          unit: "count",
          categories: [
            { id: "north", label: "North", value: 4_800, priorYear: 4_200 },
            { id: "south", label: "South", value: 1_100, priorYear: 1_300 },
            { id: "east", label: "East", value: 180, priorYear: 190 },
            { id: "west", label: "West", value: 150, priorYear: 180 },
            { id: "central", label: "Central", value: 70, priorYear: 110 },
          ],
        },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiComposition loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiComposition
        cards={[
          {
            title: "Revenue by channel",
            unit: "currency",
            categories: [
              { id: "direct", label: "Direct", value: 1_326_500, priorYear: 1_166_000 },
              { id: "partners", label: "Partners", value: 980_000, priorYear: 900_000 },
              { id: "marketplace", label: "Marketplace", value: 460_000, priorYear: 424_000 },
              { id: "other", label: "Other", value: 119_370, priorYear: 160_000 },
            ],
          },
        ]}
      />
    </div>
  ),
};
