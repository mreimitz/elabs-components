import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCardArea } from "@/components/stat-card-area-01/stat-card-area";

const meta = {
  title: "Patterns/Blocks/Stat Card (Area)",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "KPI stat card with a live area chart sparkline: hovering the chart drives the headline value, the period label and the trend badge. The chart bleed wrapper, the hover bridge and the trend badge come from the shared `stat-card-parts` item rather than being copied into each stat-card block. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add stat-card-area-01` (pulls `stat-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatCardArea /> };
