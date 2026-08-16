import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
const meta = {
  title: "Overlays/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state of the drawer.",
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
    shouldScaleBackground: {
      description: "Scale the background element behind the drawer when open. Default true.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    modal: {
      description: "Whether the drawer is modal (disables interaction outside). Default true.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    direction: {
      description: "Which edge the drawer slides in from.",
      control: { type: "select" },
      options: ["bottom", "top", "left", "right"],
      table: { category: "Behaviour" },
    },
  },
} satisfies Meta<typeof Drawer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Confirm</DrawerTitle>
          <DrawerDescription>Swipe down to dismiss.</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  ),
  // Opens the drawer (portalled to body), confirms the title and description
  // are visible, then presses Escape to dismiss it.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open drawer/i }));
    const body = within(canvasElement.ownerDocument.body);
    const drawer = await body.findByRole("dialog");
    await waitFor(() => expect(within(drawer).getByText("Confirm")).toBeVisible());
    await waitFor(() => expect(within(drawer).getByText("Swipe down to dismiss.")).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};
