import type { Meta, StoryObj } from "@storybook/react-vite";
import { RevenueChartCard } from "@/components/chart-card-kpi-01/revenue-chart-card";

const meta = {
  title: "Patterns/Blocks/Chart Card (KPI header)",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "An elevated chart-in-a-card: a header with a headline KPI + delta + a segmented period control (ToggleGroup), a token-coloured AreaChart, and a footer breakdown legend. The period control re-renders the chart. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add chart-card-kpi-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <RevenueChartCard /> };
