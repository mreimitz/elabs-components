import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./textarea";

const meta = {
  title: "Core/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: { placeholder: "Write a message…", rows: 4 },
  argTypes: {
    placeholder: {
      description: "Placeholder hint shown when the field is empty.",
      control: "text",
      table: { category: "Content" },
    },
    rows: {
      description: "Initial visible row count (the element can still be resized by the user).",
      control: "number",
      table: { category: "Appearance" },
    },
    disabled: {
      description: "Disables the textarea — cursor-not-allowed, reduced opacity.",
      control: "boolean",
      table: { category: "State" },
    },
    "aria-invalid": {
      description: "Marks the field invalid — shows destructive ring / border.",
      control: "boolean",
      table: { category: "State" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true, value: "Disabled content" } };
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "Invalid content" } };
