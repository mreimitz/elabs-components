import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "./kbd";
const meta = {
  title: "Display/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  argTypes: {
    children: {
      description:
        'Key label — a glyph (⌘, ⇧) or short text (Enter, K). Wrapped in `translate="no"`.',
      control: "text",
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Kbd>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <span className="text-body">
      Press <Kbd>⌘</Kbd> <Kbd>K</Kbd>
    </span>
  ),
};

export const Combination: Story = {
  render: () => (
    <span className="text-body">
      <Kbd>⇧</Kbd> <Kbd>⌘</Kbd> <Kbd>P</Kbd>
    </span>
  ),
};

export const TextKey: Story = {
  render: () => (
    <span className="text-body">
      Press <Kbd>Enter</Kbd> to confirm
    </span>
  ),
};
