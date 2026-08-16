import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
const meta = {
  title: "Disclosure/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  argTypes: {
    type: {
      description: "`single` allows one item open at a time; `multiple` allows any number.",
      control: { type: "radio" },
      options: ["single", "multiple"],
      table: { category: "Behavior" },
    },
    collapsible: {
      description: 'When `type="single"`, allows the open item to be closed by clicking it again.',
      control: "boolean",
      table: { category: "Behavior" },
    },
    defaultValue: {
      description: "Uncontrolled: value(s) open on first render.",
      control: "text",
      table: { category: "State" },
    },
    value: {
      description: "Controlled open value(s).",
      control: "text",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Callback fired when the open value(s) change.",
      control: false,
      table: { category: "Behavior" },
    },
    disabled: {
      description: "Disables all accordion items.",
      control: "boolean",
      table: { category: "State" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Accordion>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-80">
      <AccordionItem value="a">
        <AccordionTrigger>What is brand-ui?</AccordionTrigger>
        <AccordionContent>A token-driven component system.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Is it themeable?</AccordionTrigger>
        <AccordionContent>Yes — via data-theme tokens.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  // Expanding an item flips its trigger to aria-expanded and mounts the panel
  // content (Radix keeps closed panels out of the DOM).
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: "What is brand-ui?" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(canvas.getByText("A token-driven component system.")).toBeVisible());
  },
};
