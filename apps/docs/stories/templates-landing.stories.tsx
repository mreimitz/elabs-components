import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import LandingPage from "@/components/landing-page/landing-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: LandingPage,
  title: "Patterns/Templates/Pages/Landing",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For the front door of a SaaS product",
      description: {
        component:
          "The classic marketing landing page: a release banner, the hero with its logo strip, the feature grid, a showcase that alternates copy and product, the stats band, testimonials, the pricing table, an FAQ and the closing CTA \u2014 with a cookie banner that stays out of the way until it is answered.\n\nCopy-own it: `npx shadcn add landing-page`.",
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
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
