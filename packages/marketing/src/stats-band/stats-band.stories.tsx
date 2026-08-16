import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatsBand } from "./stats-band";

const meta = {
  title: "Marketing/StatsBand",
  component: StatsBand,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof StatsBand>;
export default meta;
type Story = StoryObj<typeof meta>;

const productStats = [
  { value: "12+", label: "Component packages" },
  { value: "6", label: "Built-in themes" },
  { value: "200+", label: "Components" },
  { value: "100%", label: "Token-driven" },
];

const businessStats = [
  { value: "$2.4B", label: "Customer revenue influenced" },
  { value: "3,000+", label: "Active enterprise accounts" },
  { value: "99.9%", label: "Platform uptime" },
  { value: "4x", label: "Faster time-to-insight" },
];

export const Default: Story = {
  args: {
    stats: productStats,
    animate: false,
  },
};

export const BusinessMetrics: Story = {
  args: {
    stats: businessStats,
    animate: false,
  },
};

export const TwoStats: Story = {
  args: {
    stats: [
      { value: "40%", label: "Reduction in dashboard build time" },
      { value: "10x", label: "Faster prototype delivery" },
    ],
    animate: false,
  },
};
