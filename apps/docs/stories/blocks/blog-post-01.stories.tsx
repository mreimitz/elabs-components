import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { BlogPost } from "@/components/blog-post-01/blog-post";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: BlogPost,
  title: "Patterns/Blocks/Content/Blog post",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle:
        "How do I lay out an article with a table of contents, real prose and a newsletter foot?",
      description: {
        component:
          "An article page: tag, title, lead and the author with date and reading time, share buttons, a sticky table of contents that marks the current section, and the body as real prose — headings, paragraphs, a pull quote, a list, a code block and a figure. Related posts and a newsletter sign-up that validates close the page.\n\nCopy-own it: `npx shadcn add blog-post-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof BlogPost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole article, with the first section current in the table of contents. */
export const Default: Story = {};

/** The reader is in the results section — the table of contents marks it. */
export const ReadingTheResults: Story = { args: { currentSection: "results" } };

/** The newsletter foot rejects an address it cannot write to, then accepts a real one. */
export const SubscribesAtTheFoot: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByLabelText("Email");
    await userEvent.type(email, "not-an-address");
    await userEvent.click(canvas.getByRole("button", { name: "Subscribe" }));
    await expect(canvas.getByText("Enter an email address we can write to.")).toBeVisible();
    await userEvent.clear(email);
    await userEvent.type(email, "ops@northwind.example");
    await userEvent.click(canvas.getByRole("button", { name: "Subscribe" }));
    await expect(await canvas.findByText(/You are on the list/)).toBeVisible();
  },
};

/**
 * “Copy link” writes the post’s address and says so for a moment, or — where the
 * clipboard is blocked, as in this headless runner — says that instead. Never a silent click.
 */
export const CopiesTheLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy link" }));
    await expect(
      await canvas.findByText(/Link copied to the clipboard|Copying is blocked here/),
    ).toBeInTheDocument();
  },
};
