import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import PricingPage from "@/components/pricing-page/pricing-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: PricingPage,
  title: "Patterns/Templates/Pages/Pricing",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a pricing page with plans, a comparison table and an FAQ",
      description: {
        component:
          "The pricing page: the plan cards with a monthly/yearly toggle, the full feature-by-plan comparison table, testimonials for reassurance, the pricing FAQ and the closing CTA.\n\nCopy-own it: `npx shadcn add pricing-page`.",
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
} satisfies Meta<typeof PricingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
