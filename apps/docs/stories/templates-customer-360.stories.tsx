import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import Customer360Page from "@/components/customer-360-page/customer-360-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: Customer360Page,
  title: "Patterns/Templates/Customers/Customer 360",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For account, success and CRM products",
      description: {
        component:
          "One account, everything the team needs before they pick up the phone. A record header that answers who, how much, how healthy and when the renewal is; four `MetricCard`s, one carrying a `Meter` with the contract commitment as its marker; usage against the contract as a `LineChart` with a labelled rule; a health score that explains itself through the `score-explanation-01` block; the account's shape against its peers as a `RadarChart`; next actions you complete in place, with the card title counting what is left; an activity `Timeline`; and the people, with the gap in the relationship stated in the title. The docked brief answers from the same facts.\n\nCopy-own it: `npx shadcn add customer-360-page`.",
      },
    },
  },
  tags: ["autodocs"],
  // The shell's <ThemeSwitcher /> reads the @elabs-ai/components-tokens React
  // context, so the screen needs a real provider — the global preview decorator
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
} satisfies Meta<typeof Customer360Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
