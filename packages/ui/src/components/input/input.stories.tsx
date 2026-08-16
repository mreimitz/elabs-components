import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";

const meta = {
  title: "Core/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "you@example.com" },
  argTypes: {
    type: {
      description:
        "HTML input type — controls browser behaviour, autocomplete, and mobile keyboard.",
      control: { type: "select" },
      options: ["text", "email", "password", "number", "tel", "url", "search", "date", "file"],
      table: { category: "Behavior" },
    },
    placeholder: {
      description: "Placeholder hint (should show an example, end with …).",
      control: "text",
      table: { category: "Content" },
    },
    disabled: {
      description: "Disables the input — cursor-not-allowed, reduced opacity, muted background.",
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
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "not-an-email" } };
export const Disabled: Story = { args: { disabled: true, value: "Disabled" } };
