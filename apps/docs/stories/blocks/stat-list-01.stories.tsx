import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatList } from "@/components/stat-list-01/stat-list";

const meta = {
  title: "Patterns/Blocks/Stat List",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Compact summary widgets: a ranked list with share bars + delta (Sales by country), a leaderboard (Top performers), and a transaction/activity feed with signed amounts. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add stat-list-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StatList /> };
