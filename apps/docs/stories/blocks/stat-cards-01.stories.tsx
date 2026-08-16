import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCards } from "@/components/stat-cards-01/stat-cards";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Stat Cards",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Elevated KPI tiles beyond a flat number: MetricCard + inline Sparkline (area/bar/line, coloured by a --chart-* token, no extra deps), a goal/progress tile, and a this-vs-last comparison tile. Copy-ready compositions for dashboard overviews. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add stat-cards-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatCards /> };
