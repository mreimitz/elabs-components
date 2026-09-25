import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import CustomerStoryPage from "@/components/customer-story-page/customer-story-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CustomerStoryPage,
  title: "Patterns/Templates/Pages/Customer Story",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a single customer story",
      description: {
        component:
          "A single customer story: the headline outcome, the customer's facts, the challenge/solution/results narrative with pull quotes, before-and-after numbers and the CTA to talk to sales.\n\nCopy-own it: `npx shadcn add customer-story-page`.",
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
} satisfies Meta<typeof CustomerStoryPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
