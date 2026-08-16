import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Bold, BookOpen, Italic, PencilLine, Underline } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
const meta = {
  title: "Forms/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  argTypes: {
    type: {
      description: '`"single"` — at most one item active. `"multiple"` — any number active.',
      control: { type: "radio" },
      options: ["single", "multiple"],
      table: { category: "Behavior" },
    },
    variant: {
      description: "Visual style applied to all items in the group.",
      control: { type: "select" },
      options: ["default", "outline", "segmented"],
      table: { category: "Appearance" },
    },
    size: {
      description: "Size applied to all items.",
      control: { type: "radio" },
      options: ["default", "sm", "lg"],
      table: { category: "Appearance" },
    },
    value: {
      description: "Controlled active value(s).",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial active value(s).",
      control: false,
      table: { category: "State" },
    },
    disabled: {
      description: "Disables all items.",
      control: "boolean",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Called when the active value(s) change.",
      control: false,
      table: { category: "Behavior" },
    },
    children: {
      description: "ToggleGroupItem elements.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof ToggleGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <ToggleGroup type="multiple" variant="outline">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
  // Clicks "Bold" to activate it, then clicks again to deactivate.
  play: async ({ canvas, userEvent }) => {
    const boldBtn = canvas.getByRole("button", { name: /bold/i });
    await expect(boldBtn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(boldBtn);
    await expect(boldBtn).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(boldBtn);
    await expect(boldBtn).toHaveAttribute("aria-pressed", "false");
  },
};

/**
 * Segmented mode switch — a single-select group on a recessed `bg-muted`
 * track with a raised elevated active segment: the same elevation grammar
 * as Tabs. Use it for exclusive view/mode controls (Read ↔ Write, editor
 * source/split/wysiwyg) instead of the bordered toggle variants.
 */
export const Segmented: Story = {
  render: () => (
    <ToggleGroup
      type="single"
      variant="segmented"
      size="sm"
      defaultValue="read"
      aria-label="Document mode"
    >
      <ToggleGroupItem value="read" aria-label="Read">
        <BookOpen /> Read
      </ToggleGroupItem>
      <ToggleGroupItem value="write" aria-label="Write">
        <PencilLine /> Write
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};
