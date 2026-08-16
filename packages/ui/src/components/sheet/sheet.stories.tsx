import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
const meta = {
  title: "Overlays/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state of the sheet.",
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
      description: "Whether the sheet is modal (disables outside interaction). Default true.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
  },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Manage your workspace.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  // Opens the sheet (portalled to body), confirms the title and description
  // are visible, then presses Escape to dismiss it.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open sheet/i }));
    const body = within(canvasElement.ownerDocument.body);
    const sheet = await body.findByRole("dialog");
    await waitFor(() => expect(within(sheet).getByText("Settings")).toBeVisible());
    await waitFor(() => expect(within(sheet).getByText("Manage your workspace.")).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};
