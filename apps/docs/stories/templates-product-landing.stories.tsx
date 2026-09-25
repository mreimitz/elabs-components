import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ProductLandingPage from "@/components/product-landing-page/product-landing-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProductLandingPage,
  title: "Patterns/Templates/Pages/Product Landing",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a product-led landing page with the product in the hero",
      description: {
        component:
          "A product-led variant of the landing page: the hero shows the product itself with live metrics and a sparkline, a marquee logo strip, feature tabs that switch the product screen, the bento grid, the big-number stats band, a testimonial spotlight and a CTA banner with social proof.\n\nCopy-own it: `npx shadcn add product-landing-page`.",
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
} satisfies Meta<typeof ProductLandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
