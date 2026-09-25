import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { BlogList } from "@/components/blog-list-01/blog-list";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: BlogList,
  title: "Patterns/Blocks/Content/Blog list",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I list the blog with a featured post, topic filters and load more?",
      description: {
        component:
          "A blog index: the newest post large at the top with its cover, tag chips that filter the grid, and cards with cover, tag, title, excerpt, author, date and reading time. “Load more” reveals the next page from the data and the count is announced to assistive tech.\n\nCopy-own it: `npx shadcn add blog-list-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof BlogList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Twelve posts: the featured one, six in the grid and five behind “Load more”. */
export const Default: Story = {};

/** Three per page, so “Load more” is visible at once and reveals the rest in steps. */
export const ShortPages: Story = { args: { pageSize: 3 } };

/** Dates in German, for a localised index. */
export const German: Story = { args: { locale: "de-DE" } };

/** A topic chip narrows the grid and the count; the chip stays pressed. */
export const FiltersByTopic: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Customs" }));
    await expect(canvas.getByText("2 posts in Customs")).toBeVisible();
    // Both posts fit on one page, so there is nothing more to load.
    await expect(canvas.queryByRole("button", { name: /Load more/ })).not.toBeInTheDocument();
  },
};
