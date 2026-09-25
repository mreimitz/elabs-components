import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import SignInPage from "@/components/sign-in-page/sign-in-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SignInPage,
  title: "Patterns/Templates/Pages/Sign In",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For the sign-in route of a product website",
      description: {
        component:
          "The sign-in page: the split login (form beside the brand aside) between the site's navbar and footer, with the sign-in link hidden from the navbar because you are already there.\n\nCopy-own it: `npx shadcn add sign-in-page`.",
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
} satisfies Meta<typeof SignInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
