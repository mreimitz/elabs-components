import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DatePicker } from "./date-picker";
const meta = {
  title: "Forms/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  argTypes: {
    value: {
      description: "Controlled selected date.",
      control: false,
      table: { category: "State" },
    },
    placeholder: {
      description: "Text shown in the trigger when no date is selected.",
      control: "text",
      table: { category: "Content" },
    },
    onValueChange: {
      description: "Called when the selected date changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the trigger button.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof DatePicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  // Opens the calendar popover and confirms the grid is visible.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const grid = await body.findByRole("grid");
    await expect(grid).toBeInTheDocument();
  },
};
