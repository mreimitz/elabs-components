import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import DevelopersPage from "@/components/developers-page/developers-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DevelopersPage,
  title: "Patterns/Templates/Pages/Developers",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a developer-facing landing page: install, code, integrate",
      description: {
        component:
          "The developer landing page: a code-first hero with install commands and switchable snippets, the process in three steps, the integrations wall, the trust and security band and a CTA banner \u2014 the page a developer reads before opening the docs.\n\nCopy-own it: `npx shadcn add developers-page`.",
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
} satisfies Meta<typeof DevelopersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
