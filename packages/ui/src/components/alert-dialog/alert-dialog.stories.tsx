import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
const meta = {
  title: "Overlays/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state of the dialog.",
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
  },
} satisfies Meta<typeof AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  // Opens the alert dialog (portalled to body), asserts the title and both action
  // buttons are visible, then cancels to close it.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /delete/i }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("alertdialog");
    await waitFor(() => expect(within(dialog).getByText("Are you sure?")).toBeVisible());
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeVisible(),
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /delete/i })).toBeVisible(),
    );
    // Cancel dismisses the dialog
    await userEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));
  },
};
