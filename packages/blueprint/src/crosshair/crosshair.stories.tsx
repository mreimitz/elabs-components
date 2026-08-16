import type { Meta, StoryObj } from "@storybook/react-vite";
import { Crosshair, RegistrationMark } from "./crosshair";

const meta = {
  title: "Blueprint/Marks",
  component: Crosshair,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
} satisfies Meta<typeof Crosshair>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Crosshairs: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Crosshair size={16} />
      <Crosshair size={24} gap={6} />
      <Crosshair size={32} gap={0} aria-label="Center point" />
    </div>
  ),
};

export const RegistrationMarks: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <RegistrationMark variant="target" size={28} />
      <RegistrationMark variant="corner" size={28} />
    </div>
  ),
};
