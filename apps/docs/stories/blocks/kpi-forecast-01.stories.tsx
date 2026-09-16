import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ordersQtd,
  ordersShipped,
  revenueQtd,
  revenue,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiForecast } from "@/components/kpi-forecast-01/kpi-forecast";
import { buildForecast, revenueForecast } from "@/components/kpi-forecast-01/data/forecast";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/Where Will I Land (Forecast)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “where will I land?” — a linear run-rate projection to the end of the quarter: solid actual, dashed projection, a ±1σ confidence range that widens toward period end, a labelled target line and a “today” marker separating the two. The projection method is stated in words. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-forecast-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiForecast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiForecast /> };

export const OffTarget: Story = {
  render: () => (
    <KpiForecast
      forecasts={[
        buildForecast(
          {
            ...revenue,
            weekly: [...revenue.weekly.slice(0, -4), 300_000, 290_000, 275_000, 260_000],
          },
          { ...revenueQtd, actual: 2_500_000 },
        ),
        buildForecast(
          {
            ...ordersShipped,
            weekly: [...ordersShipped.weekly.slice(0, -4), 640, 610, 590, 560],
          },
          { ...ordersQtd, actual: 5_600 },
        ),
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiForecast loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiForecast forecasts={[revenueForecast]} />
    </div>
  ),
};
