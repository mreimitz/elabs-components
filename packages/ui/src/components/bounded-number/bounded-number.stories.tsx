import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { BoundedNumber } from "./bounded-number";

const meta = {
  title: "Forms/BoundedNumber",
  component: BoundedNumber,
  tags: ["autodocs"],
  args: { min: 0, max: 1000, step: 10 },
  argTypes: {
    value: {
      description: 'Controlled numeric value. Pass `null` (or leave empty) for "No limit".',
      control: "number",
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial value.",
      control: "number",
      table: { category: "State" },
    },
    emptyLabel: {
      description: 'Content shown instead of the value when empty (default "No limit").',
      control: "text",
      table: { category: "Content" },
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
    disabled: {
      description: "Disables all interaction.",
      control: "boolean",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Called when the numeric value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the underlying NumberInput.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof BoundedNumber>;
export default meta;
type Story = StoryObj<typeof meta>;

/** At rest (unfocused, empty) the field reads "No limit" instead of a blank box. */
export const Default: Story = {
  args: { defaultValue: null, "aria-label": "Rate limit" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No limit")).toBeInTheDocument();
  },
};

export const WithValue: Story = {
  args: { defaultValue: 250, "aria-label": "Rate limit" },
};

export const CustomEmptyLabel: Story = {
  args: { defaultValue: null, emptyLabel: "Unlimited", "aria-label": "Rate limit" },
};

/**
 * Typing a value and clearing it back: focusing hides the label so the field
 * reads as truly empty while editing, and blurring an empty field restores
 * the label (the value round-trips to `null`, never 0 or the max).
 */
export const TypeThenClear: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState<number | null>(null);
    return (
      <div className="flex flex-col gap-2">
        <BoundedNumber
          aria-label="Rate limit"
          value={value}
          onValueChange={setValue}
          min={0}
          max={1000}
          step={10}
        />
        <p className="text-body text-muted-foreground">Value: {value ?? "null"}</p>
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("spinbutton", { name: "Rate limit" });
    await userEvent.click(input);
    await expect(canvas.queryByText("No limit")).not.toBeInTheDocument();
    await userEvent.type(input, "500");
    await userEvent.tab();
    await expect(canvas.getByText("Value: 500")).toBeInTheDocument();
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.tab();
    await expect(canvas.getByText("Value: null")).toBeInTheDocument();
    await expect(canvas.getByText("No limit")).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { defaultValue: null, disabled: true, "aria-label": "Rate limit" },
};
