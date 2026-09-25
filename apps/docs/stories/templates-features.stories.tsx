import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import FeaturesPage from "@/components/features-page/features-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: FeaturesPage,
  title: "Patterns/Templates/Pages/Features",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a long-form features page",
      description: {
        component:
          "The features page: an alternating showcase of copy and product, tabs that switch the product screen, the bento grid for the smaller capabilities, the process in steps and the closing CTA.\n\nCopy-own it: `npx shadcn add features-page`.",
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
} satisfies Meta<typeof FeaturesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
