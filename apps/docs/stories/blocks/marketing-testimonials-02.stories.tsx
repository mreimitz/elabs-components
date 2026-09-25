import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingTestimonialSpotlight } from "@/components/marketing-testimonials-02/marketing-testimonial-spotlight";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingTestimonialSpotlight,
  title: "Patterns/Blocks/Marketing/Testimonial spotlight",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "What did one customer actually say?",
      description: {
        component:
          "One customer at a time at full size: the quote, who said it, the company wordmark and the number it is about. Previous, next, the dots and the arrow keys move between quotes; the strip of wordmarks jumps straight to a customer. Nothing advances on its own, and the quote region is announced politely when it changes.\n\nCopy-own it: `npx shadcn add marketing-testimonials-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingTestimonialSpotlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opens on the third customer; Next wraps around from the last to the first. */
export const StartsOnTheThird: Story = {
  args: { defaultIndex: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Sven Aalto")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Next quote" }));
    await expect(canvas.getByText("Tomas Pereira")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Read what Bluewater Marine said" }));
    await expect(canvas.getByText("Aiko Mori")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Next quote" }));
    await expect(canvas.getByText("Ingrid Solberg")).toBeVisible();
  },
};

/** Two quotes without ratings or a headline number. */
export const QuotesOnly: Story = {
  args: {
    title: "Two people, two sentences",
    testimonials: [
      {
        id: "a",
        quote: "The spreadsheet retired the week after we went live.",
        name: "Aiko Mori",
        role: "Operations Lead",
        company: "Bluewater Marine",
      },
      {
        id: "b",
        quote: "Our drivers chose to keep using the app after the pilot.",
        name: "Sven Aalto",
        role: "Fleet Manager",
        company: "Pelican Lines",
      },
    ],
  },
};
