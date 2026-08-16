import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { RefreshCw, Trash2 } from "lucide-react";
import { IconButton } from "./icon-button";

const meta = {
  title: "Core/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: {
    label: "Refresh",
    icon: <RefreshCw aria-hidden="true" />,
  },
  argTypes: {
    label: {
      description: "Accessible name AND tooltip text — a single source of truth.",
      control: "text",
      table: { category: "Content" },
    },
    icon: { control: false, table: { category: "Content" } },
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "outline-subtle",
        "ghost",
        "link",
      ],
      table: { category: "Appearance" },
    },
    size: {
      control: "select",
      options: ["icon", "icon-sm", "icon-lg"],
      table: { category: "Appearance" },
    },
    disabled: { control: "boolean", table: { category: "State" } },
    disabledReason: {
      description:
        "Shown appended to the tooltip and exposed via aria-describedby, even while disabled.",
      control: "text",
      table: { category: "State" },
    },
    side: {
      control: "select",
      options: ["top", "right", "bottom", "left"],
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // Opens on keyboard focus (no pointer) — the a11y-critical path this
  // component exists for (#335). The tooltip content is Radix-portalled to
  // `document.body`, outside the story's own canvas root — query the owner
  // document's body, not `canvas` (mirrors Overlays/Tooltip's Default story).
  play: async ({ canvas, canvasElement, userEvent }) => {
    const button = canvas.getByRole("button", { name: "Refresh" });
    await expect(button).not.toHaveAttribute("title");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    const body = within(canvasElement.ownerDocument.body);
    const tooltip = await body.findByText("Refresh", { selector: "[data-side]" });
    await waitFor(() => expect(tooltip).toBeVisible());
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Refresh" });
    await expect(button).toBeDisabled();
  },
};

/** A disabled control that still explains WHY via the tooltip + `aria-describedby`. */
export const DisabledWithReason: Story = {
  name: "Disabled (with reason)",
  args: {
    label: "Delete",
    icon: <Trash2 aria-hidden="true" />,
    variant: "destructive",
    disabled: true,
    disabledReason: "You don't have permission to delete this item.",
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Delete" });
    await expect(button).toBeDisabled();
    const describedBy = button.getAttribute("aria-describedby");
    await expect(describedBy).toBeTruthy();
    const description = canvas.getByText("You don't have permission to delete this item.");
    await expect(description.id).toBe(describedBy);
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <IconButton {...args} size="icon-sm" label="Small" />
      <IconButton {...args} size="icon" label="Default" />
      <IconButton {...args} size="icon-lg" label="Large" />
    </div>
  ),
};
