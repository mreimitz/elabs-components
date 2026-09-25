import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ChangelogPage from "@/components/changelog-page/changelog-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChangelogPage,
  title: "Patterns/Templates/Pages/Changelog",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a product changelog page",
      description: {
        component:
          "The changelog: releases in reverse order, each with its typed changes, an RSS link and a subscribe form, followed by a CTA banner for readers who are not customers yet.\n\nCopy-own it: `npx shadcn add changelog-page`.",
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
} satisfies Meta<typeof ChangelogPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
