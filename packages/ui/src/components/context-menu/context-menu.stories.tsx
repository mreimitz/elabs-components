import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";
const meta = {
  title: "Overlays/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state of the context menu.",
      control: "boolean",
      table: { category: "State" },
    },
    defaultOpen: {
      description: "Uncontrolled initial open state.",
      control: "boolean",
      table: { category: "State" },
    },
    onOpenChange: {
      description: "Callback when the open state changes.",
      control: false,
      table: { category: "Events" },
    },
    modal: {
      description: "Whether the context menu is modal (traps focus). Default true.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    dir: {
      description: "Reading direction for the context menu.",
      control: { type: "select" },
      options: ["ltr", "rtl"],
      table: { category: "Behaviour" },
    },
  },
} satisfies Meta<typeof ContextMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-72 items-center justify-center rounded-md border border-dashed text-body text-muted-foreground">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Back</ContextMenuItem>
        <ContextMenuItem>Reload</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Inspect</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  // Right-clicks the trigger to open the portalled context menu and confirms
  // the menu items are visible, then presses Escape to dismiss.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByText("Right-click here");
    await userEvent.pointer({ target: trigger, keys: "[MouseRight]" });
    const body = within(canvasElement.ownerDocument.body);
    const menu = await body.findByRole("menu");
    await waitFor(() => expect(within(menu).getByText("Back")).toBeVisible());
    await waitFor(() => expect(within(menu).getByText("Reload")).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};
