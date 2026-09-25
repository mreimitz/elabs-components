import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import BlogArticlePage from "@/components/blog-article-page/blog-article-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: BlogArticlePage,
  title: "Patterns/Templates/Pages/Blog Article",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a single blog post",
      description: {
        component:
          "A single blog article: the post with its table of contents, author, share controls, related posts and an inline subscribe \u2014 the reading page of the blog.\n\nCopy-own it: `npx shadcn add blog-article-page`.",
      },
    },
  },
  tags: ["autodocs"],
  // The navbar's <ThemeSwitcher /> reads the @elabs-ai/components-tokens React
  // context, so the page needs a real provider — the global preview decorator
  // only writes the `data-theme` attribute. In a consuming app this sits at the
  // root. It mounts DEEPER than the preview's own theme boundary, so a
  // `STORYBOOK_THEME=<slug>` sweep still wins (child effects flush first).
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof BlogArticlePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
