import type { Meta, StoryObj } from "@storybook/react-vite";
import { DimensionLine } from "./dimension-line";

const meta = {
  title: "Blueprint/DimensionLine",
  component: DimensionLine,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
} satisfies Meta<typeof DimensionLine>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { label: "120 mm", length: 220 },
};

export const Vertical: Story = {
  args: { label: "64 mm", orientation: "vertical", length: 160 },
};

export const EndCaps: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <DimensionLine label="arrow" length={200} ends="arrow" />
      <DimensionLine label="tick" length={200} ends="tick" />
      <DimensionLine label="dot" length={200} ends="dot" />
    </div>
  ),
};
