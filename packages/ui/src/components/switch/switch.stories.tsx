import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Switch } from "./switch";
import { Label } from "../label";
const meta = {
  title: "Forms/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      description: "Controlled checked state.",
      control: "boolean",
      table: { category: "State" },
    },
    defaultChecked: {
      description: "Uncontrolled initial checked state.",
      control: "boolean",
      table: { category: "State" },
    },
    disabled: {
      description: "Disables the switch.",
      control: "boolean",
      table: { category: "State" },
    },
    required: {
      description: "Marks the switch as required in a form context.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    onCheckedChange: {
      description: "Called when the checked state changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="airplane" defaultChecked />
      <Label htmlFor="airplane">Airplane mode</Label>
    </div>
  ),
  // Starts on (defaultChecked); clicking toggles the reflected aria-checked state.
  play: async ({ canvas, userEvent }) => {
    const sw = canvas.getByRole("switch");
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    await expect(sw).toHaveAttribute("aria-checked", "false");
  },
};
