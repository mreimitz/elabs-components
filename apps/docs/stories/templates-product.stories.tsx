import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ProductPage from "@/components/product-page/product-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProductPage,
  title: "Patterns/Templates/Pages/Product",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a product detail page of a store",
      description: {
        component:
          "The product page: gallery, options, price and add-to-cart in the site frame, then the reviews with their rating breakdown and a review form, and the newsletter.\n\nCopy-own it: `npx shadcn add product-page`.",
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
} satisfies Meta<typeof ProductPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
