import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ForgotPasswordPage from "@/components/forgot-password-page/forgot-password-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ForgotPasswordPage,
  title: "Patterns/Templates/Pages/Forgot Password",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For the password-reset route",
      description: {
        component:
          "The forgot-password page: the reset card (email in, confirmation out) centred in the site frame \u2014 the same route shape as sign-in and sign-up.\n\nCopy-own it: `npx shadcn add forgot-password-page`.",
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
} satisfies Meta<typeof ForgotPasswordPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
