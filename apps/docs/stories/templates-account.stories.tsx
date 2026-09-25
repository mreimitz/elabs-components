import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import AccountPage from "@/components/account-page/account-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AccountPage,
  title: "Patterns/Templates/Pages/Account",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a signed-in account page of a store or community",
      description: {
        component:
          "The account page: the public profile with its stats and contribution strip, and the order history with track, reorder and invoice actions \u2014 a signed-in route inside the site frame.\n\nCopy-own it: `npx shadcn add account-page`.",
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
} satisfies Meta<typeof AccountPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
