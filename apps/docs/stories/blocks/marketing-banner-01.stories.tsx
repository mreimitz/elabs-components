import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingBanner } from "@/components/marketing-banner-01/marketing-banner";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingBanner,
  title: "Patterns/Blocks/Marketing/Banner",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I announce something above the site?",
      description: {
        component:
          "An announcement bar for a release, an offer or a maintenance window — each with its own glyph, colour and leading word — with a link, an optional deadline and a dismiss button that removes the bar. Sits above the navigation, or stays pinned with `sticky`.\n\nCopy-own it: `npx shadcn add marketing-banner-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** An offer on the primary plate, with the deadline beside the message. */
export const Promo: Story = {
  args: {
    variant: "promo",
    message: "Annual plans are 25% off until the end of the month.",
    link: { label: "See pricing", href: "#pricing" },
    countdown: "Ends in 6 days",
  },
};

/** A maintenance window, announced as status so screen readers hear it. */
export const Maintenance: Story = {
  args: {
    variant: "maintenance",
    message: "The API will be read-only while we move the primary database.",
    link: { label: "Status page", href: "#status" },
    countdown: "Sunday 02:00–04:00 UTC",
  },
};

/** The dismiss button removes the bar. */
export const Dismissible: Story = {
  args: { dismissible: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss this announcement" }));
    await expect(canvas.queryByText(/Scheduled reports/)).toBeNull();
  },
};
