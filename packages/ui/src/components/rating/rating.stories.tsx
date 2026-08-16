import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { useState } from "react";
import { Rating } from "./rating";

const meta = {
  title: "Forms/Rating",
  component: Rating,
  tags: ["autodocs"],
  argTypes: {
    size: {
      description: "Visual size of each star.",
      control: { type: "inline-radio" },
      options: ["sm", "md", "lg"],
      table: { category: "Appearance" },
    },
    value: {
      description: "Controlled rating value (0..max).",
      control: "number",
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial value.",
      control: "number",
      table: { category: "State" },
    },
    max: {
      description: "Number of stars.",
      control: "number",
      table: { category: "Appearance" },
    },
    allowHalf: {
      description: "Allow half-star (0.5) increments.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    readOnly: {
      description: "Render as a non-interactive display.",
      control: "boolean",
      table: { category: "State" },
    },
    disabled: {
      description: "Disable interaction.",
      control: "boolean",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Called when the rating changes.",
      control: false,
      table: { category: "Behavior" },
    },
    "aria-label": {
      description: "Accessible name for the rating group.",
      control: "text",
      table: { category: "Appearance" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: 3 },
  // Clicks the 5th star and confirms it becomes checked.
  play: async ({ canvas, userEvent }) => {
    const star5 = canvas.getByRole("radio", { name: /5 stars/i });
    await userEvent.click(star5);
    await expect(star5).toHaveAttribute("aria-checked", "true");
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Rating defaultValue={3} size="sm" aria-label="Small rating" />
      <Rating defaultValue={3} size="md" aria-label="Medium rating" />
      <Rating defaultValue={3} size="lg" aria-label="Large rating" />
    </div>
  ),
};

export const HalfSteps: Story = {
  args: { defaultValue: 2.5, allowHalf: true },
};

export const ReadOnly: Story = {
  args: { value: 4, readOnly: true },
};

export const Disabled: Story = {
  args: { defaultValue: 2, disabled: true },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState(3);
    return (
      <div className="flex flex-col gap-2">
        <Rating value={value} onValueChange={setValue} aria-label="Controlled rating" />
        <p className="text-muted-foreground text-body tabular-nums">Value: {value}</p>
      </div>
    );
  },
};
