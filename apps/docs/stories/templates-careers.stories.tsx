import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import CareersPage from "@/components/careers-page/careers-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CareersPage,
  title: "Patterns/Templates/Pages/Careers",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a careers page with open roles",
      description: {
        component:
          "The careers page: the values that make the pitch, the open roles grouped by team with a leave-your-details fallback, the team grid, and testimonials from the people who work there.\n\nCopy-own it: `npx shadcn add careers-page`.",
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
} satisfies Meta<typeof CareersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
