import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import { Toaster, toast } from "./sonner";
const meta = {
  title: "Feedback/Toast",
  component: Toaster,
  tags: ["autodocs"],
  argTypes: {
    position: {
      description: "Where the toast stack appears on screen.",
      control: { type: "select" },
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      table: { category: "Layout" },
    },
    expand: {
      description: "Expand all toasts in the stack by default.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    richColors: {
      description: "Use rich semantic colours for success/error/warning toasts.",
      control: "boolean",
      table: { category: "Appearance" },
    },
    closeButton: {
      description: "Show an explicit close button on each toast.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    duration: {
      description: "Auto-dismiss duration in milliseconds. Default 4000.",
      control: "number",
      table: { category: "Behaviour" },
    },
    visibleToasts: {
      description: "Maximum number of toasts visible at one time.",
      control: "number",
      table: { category: "Behaviour" },
    },
    className: {
      description: "Additional CSS classes applied to the Toaster root.",
      control: "text",
      table: { category: "Styling" },
    },
    toastOptions: {
      description: "Default options applied to every toast (classNames, style, etc.).",
      control: false,
      table: { category: "Behaviour" },
    },
  },
} satisfies Meta<typeof Toaster>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <div>
      <Button onClick={() => toast("Deployment started", { description: "billing@v1.4.2" })}>
        Show toast
      </Button>
      <Toaster duration={4000} />
    </div>
  ),
  // Clicks the trigger button, then confirms the toast message appears in the
  // document body (Sonner renders outside the story canvas in a portal).
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /show toast/i }));
    const body = within(canvasElement.ownerDocument.body);
    const toastEl = await body.findByText("Deployment started");
    await waitFor(() => expect(toastEl).toBeVisible());
  },
};

export const CustomizedWithClassName: Story = {
  render: () => (
    <div>
      <Button
        onClick={() => toast("Hello", { description: "Custom className is merged with defaults" })}
      >
        Show toast
      </Button>
      <Toaster className="custom-wrapper-class" duration={4000} />
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /show toast/i }));
    const body = within(canvasElement.ownerDocument.body);
    const toastEl = await body.findByText("Hello");
    await waitFor(() => expect(toastEl).toBeVisible());
  },
};

export const CustomizedWithToastOptions: Story = {
  render: () => (
    <div>
      <Button
        onClick={() => toast("Success!", { description: "Custom toast styles via toastOptions" })}
      >
        Show toast
      </Button>
      <Toaster
        toastOptions={{
          classNames: {
            toast: "group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground",
          },
        }}
        duration={4000}
      />
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /show toast/i }));
    const body = within(canvasElement.ownerDocument.body);
    const toastEl = await body.findByText("Success!");
    await waitFor(() => expect(toastEl).toBeVisible());
  },
};
