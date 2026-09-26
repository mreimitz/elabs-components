import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingNewsletter,
  title: "Patterns/Blocks/Marketing/Newsletter",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "One field, a promise about frequency, validation on submit, and a confirmation that names the address.\n\nCopy-own it: `npx shadcn add marketing-newsletter-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingNewsletter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The shared `EmailCapture` part: a bad address is refused on the field, a good one is confirmed by name. */
export const Subscribes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Email" });
    await userEvent.type(field, "not-an-address");
    await userEvent.click(canvas.getByRole("button", { name: "Subscribe" }));
    await expect(canvas.getByText("Enter an email address we can write to.")).toBeInTheDocument();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(field);
    await userEvent.type(field, "mara@acme.example{enter}");
    const done = await canvas.findByRole("status");
    await expect(done).toHaveTextContent("The next issue goes to mara@acme.example.");
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
  },
};

/** The list refused the address: the message lands on the field. */
export const Rejected: Story = {
  args: { onSubscribe: () => "That address is already subscribed." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Email" }),
      "mara@acme.example{enter}",
    );
    await expect(
      await canvas.findByText("That address is already subscribed."),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Subscribe" })).toBeEnabled();
  },
};
