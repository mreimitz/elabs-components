import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";
import { Input } from "../input";
const meta = {
  title: "Forms/Label",
  component: Label,
  tags: ["autodocs"],
  argTypes: {
    htmlFor: {
      description: "Associates the label with an input by its `id`.",
      control: "text",
      table: { category: "Behavior" },
    },
    children: {
      description: "Label text content.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the label element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <div className="grid gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input id="email" placeholder="you@example.com" />
    </div>
  ),
};
