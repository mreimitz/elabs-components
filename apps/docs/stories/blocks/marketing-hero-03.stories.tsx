import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingHeroSignup } from "@/components/marketing-hero-03/marketing-hero-signup";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingHeroSignup,
  title: "Patterns/Blocks/Marketing/Hero — signup",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I capture an email right in the hero?",
      description: {
        component:
          "A centred hero with the sign-up form inline: the email field validates on submit, the button shows the pending state, and the confirmation names the address it was sent to. Three benefits with check marks under the form, then the people already in — stacked avatars, a count and a rating.\n\nCopy-own it: `npx shadcn add marketing-hero-03`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingHeroSignup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Submitting an address that is not an email shows the error and keeps the field focused. */
export const RejectsABadAddress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Work email"), "not-an-email");
    await userEvent.click(canvas.getByRole("button", { name: /Get early access/ }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(/work email/i);
  },
};

/** A valid address goes through the pending state and lands on the confirmation. */
export const ConfirmsTheAddress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Work email"), "ines@northwind.example");
    await userEvent.click(canvas.getByRole("button", { name: /Get early access/ }));
    await expect(await canvas.findByRole("status", {}, { timeout: 3000 })).toHaveTextContent(
      "ines@northwind.example",
    );
  },
};

/** A waitlist for a different product, without the rating. */
export const Waitlist: Story = {
  args: {
    eyebrow: "Private beta",
    title: "Your warehouse, planned by the numbers",
    description:
      "Relay forecasts tomorrow’s stops from today’s scans. Join the beta and get the first month on us.",
    submitLabel: "Join the waitlist",
    benefits: [
      { label: "Route plans that re-plan themselves when a truck is late" },
      { label: "A driver app that works offline in the yard" },
      { label: "Customs paperwork checked before the vessel sails" },
    ],
    proof: {
      people: ["Sven Aalto", "Leila Haddad", "Aiko Mori", "Tomas Pereira", "Marta Lind"],
      caption: "Joined by 380 depots",
      rating: 5,
    },
  },
};
