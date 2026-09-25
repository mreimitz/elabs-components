import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import NotFoundPage from "@/components/not-found-page/not-found-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: NotFoundPage,
  title: "Patterns/Templates/Pages/Not Found",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For the 404 route of a website",
      description: {
        component:
          "The 404 page: an empty-state panel with the two ways out (home, search the help center) inside the site frame, and the resources library so the visit is not wasted.\n\nCopy-own it: `npx shadcn add not-found-page`.",
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
} satisfies Meta<typeof NotFoundPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
