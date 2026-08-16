import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "../button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
const meta = {
  title: "Disclosure/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  argTypes: {
    open: {
      description: "Controlled open state.",
      control: "boolean",
      table: { category: "State" },
    },
    defaultOpen: {
      description: "Uncontrolled: whether open on first render.",
      control: "boolean",
      table: { category: "State" },
    },
    onOpenChange: {
      description: "Callback fired when the open state changes.",
      control: false,
      table: { category: "Behavior" },
    },
    disabled: {
      description: "Prevents the user from toggling the collapsible.",
      control: "boolean",
      table: { category: "State" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Collapsible className="w-80 space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">
          Toggle details
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-md border p-3 text-body text-muted-foreground">
        Hidden details revealed.
      </CollapsibleContent>
    </Collapsible>
  ),
  // Clicking the trigger toggles the content panel open.
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: "Toggle details" });
    // Initially closed — content is not visible.
    await expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    // After click, the content should be in the DOM and becoming visible.
    const content = await canvas.findByText("Hidden details revealed.");
    await expect(content).toBeInTheDocument();
  },
};
