import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ComingSoonPage from "@/components/coming-soon-page/coming-soon-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ComingSoonPage,
  title: "Patterns/Templates/Pages/Coming Soon",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a pre-launch / waitlist page",
      description: {
        component:
          "The pre-launch page: an email-first hero with benefits and social proof, the waitlist with its milestones, and a preview of the features to come.\n\nCopy-own it: `npx shadcn add coming-soon-page`.",
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
} satisfies Meta<typeof ComingSoonPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
