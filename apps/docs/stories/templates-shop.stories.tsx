import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ShopPage from "@/components/shop-page/shop-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ShopPage,
  title: "Patterns/Templates/Pages/Shop",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a storefront listing page",
      description: {
        component:
          "The shop page: the product grid with sort and quick add in the site frame, followed by the trust band and the newsletter.\n\nCopy-own it: `npx shadcn add shop-page`.",
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
} satisfies Meta<typeof ShopPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
