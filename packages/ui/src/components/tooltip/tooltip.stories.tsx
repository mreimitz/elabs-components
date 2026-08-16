import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state of the tooltip.",
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
    delayDuration: {
      description: "Milliseconds to wait before opening. Default 700.",
      control: "number",
      table: { category: "Behaviour" },
    },
    disableHoverableContent: {
      description: "Prevent the tooltip content from being hoverable.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
  },
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Helpful context</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  // Hovers over the trigger (delay zeroed for determinism) to open the portalled
  // tooltip and confirms the content is visible. NOTE: Radix renders the visible
  // tooltip content as a node separate from its clipped, sr-only role="tooltip"
  // announcement span — so we assert on the visible CONTENT text, not getByRole.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /hover me/i });
    await userEvent.hover(trigger);
    const body = within(canvasElement.ownerDocument.body);
    // Radix nests an sr-only role="tooltip" copy of the text INSIDE the visible
    // popper content, so the text matches twice. Target the popper content node
    // (the only one carrying data-side) and assert it is visible.
    const content = await body.findByText("Helpful context", { selector: "[data-side]" });
    // wait out the fade-in entrance animation before asserting visibility
    await waitFor(() => expect(content).toBeVisible());
  },
};
