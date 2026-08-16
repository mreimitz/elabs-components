import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { DateRange } from "react-day-picker";
import { DateRangePicker } from "./date-range-picker";
import type { DateRangePreset } from "./date-range-picker";

const meta = {
  title: "Forms/DateRangePicker",
  component: DateRangePicker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: {
      description: "Controlled date range `{ from, to }`.",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial date range.",
      control: false,
      table: { category: "State" },
    },
    presets: {
      description: "Array of quick-pick preset definitions `{ label, getRange }`.",
      control: false,
      table: { category: "Content" },
    },
    numberOfMonths: {
      description: "Number of calendar months to display.",
      control: "number",
      table: { category: "Appearance" },
    },
    placeholder: {
      description: "Trigger text when no range is selected.",
      control: "text",
      table: { category: "Content" },
    },
    onValueChange: {
      description: "Called when the selected range changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the trigger button.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default two-month picker with no presets. */
export const Default: Story = {
  // Opens the popover and confirms the range calendar grid is visible.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    // Two-month picker → one grid per month; findByRole (singular) throws.
    const grids = await body.findAllByRole("grid");
    await expect(grids[0]).toBeInTheDocument();
  },
};

const commonPresets: DateRangePreset[] = [
  {
    label: "Today",
    getRange: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: "Last 7 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from, to };
    },
  },
  {
    label: "Last 30 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from, to };
    },
  },
  {
    label: "This month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
    },
  },
];

/** Two-month picker with common quick-pick presets. */
export const WithPresets: Story = {
  args: {
    presets: commonPresets,
  },
};

/** Single-month layout. */
export const SingleMonth: Story = {
  args: {
    numberOfMonths: 1,
  },
};

/** Pre-selected range via defaultValue. */
export const Preselected: Story = {
  args: {
    defaultValue: {
      from: new Date(2025, 0, 6),
      to: new Date(2025, 0, 20),
    },
  },
};

/** Controlled example using useState (defined as a real component to satisfy rules-of-hooks). */
function ControlledExample() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2025, 2, 1),
    to: new Date(2025, 2, 14),
  });
  return (
    <div className="flex flex-col gap-4">
      <DateRangePicker value={range} onValueChange={setRange} />
      <p className="text-body text-muted-foreground">
        {range?.from && range?.to
          ? `Selected: ${range.from.toLocaleDateString()} – ${range.to.toLocaleDateString()}`
          : "No range selected"}
      </p>
    </div>
  );
}

export const Controlled: Story = {
  render: () => <ControlledExample />,
};
