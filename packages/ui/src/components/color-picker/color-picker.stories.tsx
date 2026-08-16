import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { useState } from "react";
import { ColorPicker } from "./color-picker";

const meta = {
  title: "Forms/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
  argTypes: {
    value: {
      description: "Controlled color token name or raw hex string.",
      control: "text",
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial color value.",
      control: "text",
      table: { category: "State" },
    },
    allowCustom: {
      description: "Show a free-form hex input below the swatches (not theme-aware).",
      control: "boolean",
      table: { category: "Behavior" },
    },
    swatches: {
      description: "Subset of ColorToken names to display as swatches.",
      control: false,
      table: { category: "Content" },
    },
    onValueChange: {
      description: "Called when the selected color changes.",
      control: false,
      table: { category: "Behavior" },
    },
    "aria-label": {
      description: "Accessible label for the trigger button.",
      control: "text",
      table: { category: "Appearance" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof ColorPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: "chart-1" },
  // Opens the popover, confirms the swatch radiogroup is visible.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /pick color/i });
    await expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const group = await body.findByRole("radiogroup", { name: /color swatches/i });
    await expect(group).toBeInTheDocument();
  },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [color, setColor] = useState<string>("primary");
    return (
      <div className="flex flex-col gap-2">
        <ColorPicker value={color} onValueChange={setColor} />
        <p className="text-body text-muted-foreground">Selected: {color}</p>
      </div>
    );
  },
};

export const ChartTokensOnly: Story = {
  args: {
    defaultValue: "chart-1",
    swatches: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  },
};

export const WithCustomHex: Story = {
  args: { defaultValue: "primary", allowCustom: true },
};

export const StatusTokens: Story = {
  args: {
    defaultValue: "success",
    swatches: ["success", "warning", "destructive", "info"],
  },
};
