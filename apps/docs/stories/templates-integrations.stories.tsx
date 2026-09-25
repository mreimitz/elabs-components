import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import IntegrationsPage from "@/components/integrations-page/integrations-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: IntegrationsPage,
  title: "Patterns/Templates/Pages/Integrations",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For an integrations directory page",
      description: {
        component:
          "The integrations page: a filterable wall of integration tiles with a request-an-integration link, the trust and security band that answers the data question, and a CTA banner.\n\nCopy-own it: `npx shadcn add integrations-page`.",
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
} satisfies Meta<typeof IntegrationsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
