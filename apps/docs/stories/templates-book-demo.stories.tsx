import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import BookDemoPage from "@/components/book-demo-page/book-demo-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: BookDemoPage,
  title: "Patterns/Templates/Pages/Talk to Sales",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a talk-to-sales page with a bookable walkthrough",
      description: {
        component:
          "The talk-to-sales page: the booking form with the walkthrough agenda, hosts and time slots, the logo strip and a testimonial spotlight underneath for the person who is still deciding.\n\nCopy-own it: `npx shadcn add book-demo-page`.",
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
} satisfies Meta<typeof BookDemoPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
