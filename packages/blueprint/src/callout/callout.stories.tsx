import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "./callout";

const meta = {
  title: "Blueprint/Callout",
  component: Callout,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
} satisfies Meta<typeof Callout>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { number: 3, label: "Spring physics", direction: "right" },
};

export const Directions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-8">
      <Callout number={1} label="right" direction="right" />
      <Callout number={2} label="left" direction="left" />
      <Callout number={3} label="up" direction="up" />
      <Callout number={4} label="down" direction="down" />
    </div>
  ),
};

export const Elbow: Story = {
  args: { number: 5, label: "Layout animation", leader: "elbow", leaderLength: 44 },
};
