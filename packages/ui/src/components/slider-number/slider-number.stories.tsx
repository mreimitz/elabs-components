import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { SliderNumber } from "./slider-number";

const meta = {
  title: "Forms/SliderNumber",
  component: SliderNumber,
  tags: ["autodocs"],
  args: {
    "aria-label": "Temperature",
    min: 0,
    max: 1,
    step: 0.1,
  },
  argTypes: {
    value: {
      description: 'Controlled value. Pass `null` for "use the provider default".',
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
      description: "Step increment for both the slider and the number input.",
      control: "number",
      table: { category: "Behavior" },
    },
    precision: {
      description: "Decimal places to round to (defaults to the decimals in `step`).",
      control: "number",
      table: { category: "Behavior" },
    },
    resetLabel: {
      description: "Label for the reset-to-provider-default control.",
      control: "text",
      table: { category: "Content" },
    },
    disabled: {
      description: "Disables the whole control.",
      control: "boolean",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Called when the value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof SliderNumber>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: 0.7 },
};

/** Starting from "provider default" — the slider thumb renders dimmed/dashed and Reset is disabled. */
export const ProviderDefault: Story = {
  args: { defaultValue: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Reset" })).toBeDisabled();
  },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState<number | null>(0.5);
    return (
      <div className="flex flex-col gap-2 max-w-md">
        <SliderNumber
          aria-label="Top-p"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onValueChange={setValue}
        />
        <p className="text-body text-muted-foreground">Value: {value ?? "provider default"}</p>
      </div>
    );
  },
};

/** Dragging (via keyboard) to a value, then resetting back to the provider default. */
export const DragThenReset: Story = {
  args: { defaultValue: null },
  play: async ({ canvas, userEvent }) => {
    const thumb = canvas.getByRole("slider", { name: "Temperature" });
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    const numberInput = canvas.getByRole("spinbutton", { name: "Temperature" });
    await expect(numberInput).toHaveValue(0.3);

    const resetBtn = canvas.getByRole("button", { name: "Reset" });
    await expect(resetBtn).not.toBeDisabled();
    await userEvent.click(resetBtn);
    await expect(resetBtn).toBeDisabled();
  },
};

export const Disabled: Story = {
  args: { defaultValue: 0.4, disabled: true },
};
