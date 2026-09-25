import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingWaitlist } from "@/components/marketing-waitlist-01/marketing-waitlist";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingWaitlist,
  title: "Patterns/Blocks/Marketing/Waitlist",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I get in early, and who else is waiting?",
      description: {
        component:
          "A launch waitlist: the pitch, one email field that validates and shows a pending state, and on success the place in line with a referral link and a copy button. The faces and count show who is already waiting; three dated milestones say what has shipped and what is coming.\n\nCopy-own it: `npx shadcn add marketing-waitlist-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingWaitlist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A bad address is refused; a good one lands a place in line and a link to share. */
export const JoinsTheLine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText(/Work email/);
    await userEvent.type(field, "not-an-email");
    await userEvent.click(canvas.getByRole("button", { name: "Join the waitlist" }));
    await expect(canvas.getByText("Enter an email address we can write to.")).toBeVisible();
    await userEvent.clear(field);
    await userEvent.type(field, "ada@acme-logistics.example");
    await userEvent.click(canvas.getByRole("button", { name: "Join the waitlist" }));
    await expect(await canvas.findByText(/^#1,284$/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Copy link" })).toBeVisible();
  },
};

/** The host refuses the address — its message is shown as the field error. */
export const RefusedByTheHost: Story = {
  args: {
    onJoin: (email) =>
      email.endsWith(".example")
        ? "That domain is already on the list."
        : { position: 12, referralUrl: "https://orbit.example/waitlist?ref=you" },
  },
};
