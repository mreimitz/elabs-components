import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
const meta = { title: "Overlays/Popover", component: Popover, tags: ["autodocs"] } satisfies Meta<
  typeof Popover
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open</Button>
      </PopoverTrigger>
      <PopoverContent>Place content for the popover here.</PopoverContent>
    </Popover>
  ),
  // Clicking the trigger mounts the popover content into the Radix portal.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open" }));
    const body = within(canvasElement.ownerDocument.body);
    const content = await body.findByText("Place content for the popover here.");
    // waitFor rides out the Radix fade-in/zoom entrance animation (opacity
    // starts at 0, which jest-dom counts as not-visible).
    await waitFor(() => expect(content).toBeVisible());
  },
};
