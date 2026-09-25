import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import HelpCenterPage from "@/components/help-center-page/help-center-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: HelpCenterPage,
  title: "Patterns/Templates/Pages/Help Center",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a help center / support landing page",
      description: {
        component:
          "The help center landing: search with suggestions, categories with article counts, popular articles, the status/community/contact links, and the contact form for what the articles do not answer.\n\nCopy-own it: `npx shadcn add help-center-page`.",
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
} satisfies Meta<typeof HelpCenterPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
