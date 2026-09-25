import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductReviews } from "@/components/product-reviews-01/product-reviews";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProductReviews,
  title: "Patterns/Blocks/Commerce/Product Reviews",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What do people who bought it actually think?",
      description: {
        component:
          "Reviews with the distribution behind the average: five `Meter` rows with real counts, the share who gave four stars or more, and a sort and “verified only” switch that filter the list. Each card carries the `Rating`, a verified badge with an icon, what the reviewer bought and a helpful button that toggles its count. “Write a review” opens a dialog with a star input, a title and a body that validate before the review lands at the top of the list with a thank-you.\n\nCopy-own it: `npx shadcn add product-reviews-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProductReviews>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A product with two reviews, neither verified: the switch empties the list and says why. */
export const FewReviews: Story = {
  args: {
    productName: "Camp brew kit",
    defaultReviews: [
      {
        id: "b1",
        rating: 5,
        title: "Best coffee I have had above 2,000 m",
        body: "Packs into the mug, the filter rinses in a second and it has survived being dropped on granite twice. I want a second one for the office.",
        author: "Noor Haddad",
        date: "2026-09-18",
        verified: false,
        helpful: 3,
      },
      {
        id: "b2",
        rating: 4,
        title: "Clever, slightly slow to drain",
        body: "A fine grind clogs it a bit; a medium grind is perfect. Everything else about it is thought through, down to the lid that doubles as a scoop.",
        author: "Elias Brandt",
        date: "2026-09-02",
        verified: false,
        helpful: 1,
      },
    ],
  },
};

/** German locale: dates, counts and the percentage all reformat through `Intl`. */
export const GermanLocale: Story = { args: { locale: "de-DE" } };
