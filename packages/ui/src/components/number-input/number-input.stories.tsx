import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { NumberInput } from "./number-input";

const meta = {
  title: "Forms/NumberInput",
  component: NumberInput,
  tags: ["autodocs"],
  args: { step: 1 },
  argTypes: {
    value: {
      description: "Controlled numeric value. Pass `null` for empty state.",
      control: "number",
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial value.",
      control: "number",
      table: { category: "State" },
    },
    min: {
      description: "Minimum allowed value.",
      control: "number",
      table: { category: "Behavior" },
    },
    max: {
      description: "Maximum allowed value.",
      control: "number",
      table: { category: "Behavior" },
    },
    step: {
      description: "Increment/decrement amount per click or arrow key.",
      control: "number",
      table: { category: "Behavior" },
    },
    clamp: {
      description: "Clamp the value to [min, max] on blur (default true).",
      control: "boolean",
      table: { category: "Behavior" },
    },
    disabled: {
      description: "Disables all interaction.",
      control: "boolean",
      table: { category: "State" },
    },
    readOnly: {
      description: "Makes the input read-only.",
      control: "boolean",
      table: { category: "State" },
    },
    placeholder: {
      description: "Placeholder text shown when the field is empty.",
      control: "text",
      table: { category: "Content" },
    },
    formatOptions: {
      description: "`Intl.NumberFormat` options to format the displayed value.",
      control: false,
      table: { category: "Appearance" },
    },
    onValueChange: {
      description: "Called when the numeric value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof NumberInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: 5, min: 0, max: 10 },
  // Clicks the Increase button and confirms the value increments.
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("spinbutton");
    await expect(input).toHaveValue(5);
    const increaseBtn = canvas.getByRole("button", { name: /increase/i });
    await userEvent.click(increaseBtn);
    await expect(input).toHaveValue(6);
  },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState<number | null>(3);
    return (
      <div className="flex flex-col gap-2">
        <NumberInput value={value} onValueChange={setValue} min={0} max={20} />
        <p className="text-body text-muted-foreground">Value: {value ?? "empty"}</p>
      </div>
    );
  },
};

export const WithFormatOptions: Story = {
  args: {
    defaultValue: 1234.5,
    formatOptions: { style: "currency", currency: "USD" },
    step: 100,
  },
};

export const NoClamp: Story = {
  args: { defaultValue: 5, min: 0, max: 10, clamp: false },
};

export const Disabled: Story = {
  args: { defaultValue: 5, disabled: true },
};

export const WithBounds: Story = {
  args: { defaultValue: 0, min: 0, max: 100, step: 10 },
};
