import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "../label";
const meta = {
  title: "Forms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  argTypes: {
    value: {
      description: "Controlled selected value.",
      control: "text",
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial selected value.",
      control: "text",
      table: { category: "State" },
    },
    orientation: {
      description: "Layout direction of the radio items.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Appearance" },
    },
    disabled: {
      description: "Disables all radio items in the group.",
      control: "boolean",
      table: { category: "State" },
    },
    required: {
      description: "Marks the group as required in a form context.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    onValueChange: {
      description: "Called when the selected value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    children: {
      description: "RadioGroupItem elements.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="a">
      {["a", "b", "c"].map((v) => (
        <div key={v} className="flex items-center gap-2">
          <RadioGroupItem value={v} id={`r-${v}`} />
          <Label htmlFor={`r-${v}`}>Option {v.toUpperCase()}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
  // "A" starts checked; clicking "B" shifts the selection.
  play: async ({ canvas, userEvent }) => {
    const radioA = canvas.getByRole("radio", { name: /option a/i });
    await expect(radioA).toBeChecked();
    const radioB = canvas.getByRole("radio", { name: /option b/i });
    await userEvent.click(radioB);
    await expect(radioB).toBeChecked();
    await expect(radioA).not.toBeChecked();
  },
};
