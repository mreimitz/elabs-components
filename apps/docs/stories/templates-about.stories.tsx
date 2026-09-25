import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import AboutPage from "@/components/about-page/about-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AboutPage,
  title: "Patterns/Templates/Pages/About",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For a company about page",
      description: {
        component:
          "The about page: mission, story, milestones, values and numbers, the team grid, a careers teaser with open roles and the closing CTA.\n\nCopy-own it: `npx shadcn add about-page`.",
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
} satisfies Meta<typeof AboutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
