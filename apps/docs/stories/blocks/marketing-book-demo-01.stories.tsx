import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingBookDemo } from "@/components/marketing-book-demo-01/marketing-book-demo";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingBookDemo,
  title: "Patterns/Blocks/Marketing/Book a demo",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "What happens on the call, and when can we do it?",
      description: {
        component:
          "Book a demo: on the left what the half hour covers and who runs it, on the right a form that validates on submit — name, work email, company size, an optional use case and a slot chosen from a row of time chips. Taken slots stay visible but cannot be picked. Booking ends in a confirmation that repeats the slot and the address.\n\nCopy-own it: `npx shadcn add marketing-book-demo-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingBookDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Submitting empty shows every error at once; filling in and picking a slot books it. */
export const ValidatesThenBooks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Book the demo" }));
    await expect(canvas.getByText("Tell us who to expect.")).toBeVisible();
    await expect(canvas.getByText("Choose a time.")).toBeVisible();
    await userEvent.type(canvas.getByLabelText(/^Name/), "Ada Okonkwo");
    await userEvent.type(canvas.getByLabelText(/Work email/), "ada@acme-logistics.example");
    await userEvent.click(canvas.getByRole("combobox", { name: /Company size/ }));
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "51–200 people" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: /Wed 7 Oct 09:30 CET/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Book the demo" }));
    await expect(await canvas.findByRole("heading", { name: "You’re booked" })).toBeVisible();
  },
};

/** One host, a single day of slots, and a shorter call. */
export const OneHostOneDay: Story = {
  args: {
    duration: "20 minutes",
    hosts: [{ name: "Priya Raman", role: "Solutions engineer" }],
    slots: [
      { id: "a", day: "Mon 12 Oct", time: "09:00 CET" },
      { id: "b", day: "Mon 12 Oct", time: "11:00 CET", taken: true },
      { id: "c", day: "Mon 12 Oct", time: "15:00 CET" },
    ],
  },
};
