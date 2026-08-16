import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCardChoropleth } from "@/components/stat-card-choropleth-01/stat-card-choropleth";

const meta = {
  title: "Patterns/Blocks/Stat Card (Choropleth)",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "KPI stat card with a choropleth world map: hovering a country drives the headline value, the country label and the trend badge. Keeps its own hover bridge (country hit-testing differs from a time series) but shares the chart bleed wrapper and trend badge via the `stat-card-parts` item. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add stat-card-choropleth-01` (pulls `stat-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatCardChoropleth /> };
