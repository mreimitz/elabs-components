import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCardLine } from "@/components/stat-card-line-01/stat-card-line";

const meta = {
  title: "Patterns/Blocks/Stat Card (Line)",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "KPI stat card with an inline line chart: hovering the chart drives the headline value, the weekday label and the trend badge. Shares the chart bleed wrapper, hover bridge and trend badge with the other stat-card blocks via the `stat-card-parts` item. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add stat-card-line-01` (pulls `stat-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatCardLine /> };
