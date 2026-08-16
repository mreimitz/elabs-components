import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlaceholderBox } from "./placeholder-box";

const meta = {
  title: "Blueprint/PlaceholderBox",
  component: PlaceholderBox,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
} satisfies Meta<typeof PlaceholderBox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { className: "h-48 w-72" },
};

export const Labelled: Story = {
  args: { label: "illustration 2", className: "h-48 w-72" },
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <PlaceholderBox label="generator" className="h-40" />
      <PlaceholderBox label="cadeau" className="h-40" />
      <PlaceholderBox className="h-40" />
    </div>
  ),
};
