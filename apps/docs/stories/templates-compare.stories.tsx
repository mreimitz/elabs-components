import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ComparePage from "@/components/compare-page/compare-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ComparePage,
  title: "Patterns/Templates/Pages/Compare",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a versus / alternative-to page",
      description: {
        component:
          "The comparison page: a side-by-side table against the alternatives with a best-for row, testimonials from people who switched, the FAQ and the closing CTA.\n\nCopy-own it: `npx shadcn add compare-page`.",
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
} satisfies Meta<typeof ComparePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
