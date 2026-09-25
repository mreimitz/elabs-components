import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import BlogPage from "@/components/blog-page/blog-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: BlogPage,
  title: "Patterns/Templates/Pages/Blog",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a blog index page",
      description: {
        component:
          "The blog index: a filterable, paged list of posts with a featured post on top, and the newsletter signup below.\n\nCopy-own it: `npx shadcn add blog-page`.",
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
} satisfies Meta<typeof BlogPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
