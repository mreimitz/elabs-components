import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { SegmentedField } from "./segmented-field";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const meta = {
  title: "Forms/SegmentedField",
  component: SegmentedField,
  tags: ["autodocs"],
  args: {
    label: "Priority",
    options: PRIORITY_OPTIONS,
    defaultValue: "medium",
  },
  argTypes: {
    label: {
      description: "Visible label describing the field.",
      control: "text",
      table: { category: "Content" },
    },
    options: {
      description: "Segment options ({ value, label, disabled? }[]).",
      control: false,
      table: { category: "Content" },
    },
    value: {
      description: "Controlled selected value.",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial selected value.",
      control: false,
      table: { category: "State" },
    },
    size: {
      description: "Size applied to every segment.",
      control: { type: "radio" },
      options: ["default", "sm", "lg"],
      table: { category: "Appearance" },
    },
    disabled: {
      description: "Disables every segment.",
      control: "boolean",
      table: { category: "State" },
    },
    onValueChange: {
      description: 'Called when the selected value changes. Never called with "".',
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof SegmentedField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState("medium");
    return (
      <div className="flex flex-col gap-2">
        <SegmentedField
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={value}
          onValueChange={setValue}
        />
        <p className="text-body text-muted-foreground">Value: {value}</p>
      </div>
    );
  },
};

/**
 * Locks the whole reason this component exists: re-clicking the already
 * active segment is a no-op — the value never becomes "" or undefined.
 */
export const ClickingActiveSegmentIsANoOp: Story = {
  args: { defaultValue: "medium" },
  play: async ({ canvas, userEvent }) => {
    const mediumSegment = canvas.getByRole("radio", { name: "Medium" });
    await expect(mediumSegment).toHaveAttribute("aria-checked", "true");
    await userEvent.click(mediumSegment);
    // Still checked — the empty-emission was swallowed, not applied.
    await expect(mediumSegment).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByRole("radio", { name: "Low" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  },
};

export const WithDisabledOption: Story = {
  args: {
    label: "Rollout stage",
    options: [
      { value: "dev", label: "Dev" },
      { value: "staging", label: "Staging" },
      { value: "prod", label: "Prod", disabled: true },
    ],
    defaultValue: "dev",
  },
};

export const Disabled: Story = {
  args: { defaultValue: "medium", disabled: true },
};
