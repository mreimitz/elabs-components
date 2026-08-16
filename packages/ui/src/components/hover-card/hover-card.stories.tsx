import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
const meta = {
  title: "Overlays/HoverCard",
  component: HoverCard,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state of the hover card.",
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
    openDelay: {
      description: "Milliseconds to wait before opening on pointer enter. Default 700.",
      control: "number",
      table: { category: "Behaviour" },
    },
    closeDelay: {
      description: "Milliseconds to wait before closing on pointer leave. Default 300.",
      control: "number",
      table: { category: "Behaviour" },
    },
  },
} satisfies Meta<typeof HoverCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <Button variant="link">@brand</Button>
      </HoverCardTrigger>
      <HoverCardContent>The brand-ui design system.</HoverCardContent>
    </HoverCard>
  ),
  // Hovers over the trigger (delay zeroed for determinism) to open the portalled
  // hover card and confirms the content is visible.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: "@brand" });
    await userEvent.hover(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const card = await body.findByText("The brand-ui design system.");
    await waitFor(() => expect(card).toBeVisible());
  },
};
