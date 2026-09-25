import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingCookieBanner } from "@/components/marketing-cookie-banner-01/marketing-cookie-banner";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingCookieBanner,
  title: "Patterns/Blocks/Marketing/Cookie Banner",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Which cookies may we set?",
      description: {
        component:
          "Cookie consent that treats the visitor as an adult: two sentences on what the cookies do, then “Accept all”, “Reject non-essential” and “Manage” side by side, none of them hidden or greyed. Manage opens a dialog with one switch per category, Essential visibly locked on and a running count of what is on. The block reports the decision through `onDecision` and hides itself; the app decides where to store it.\n\nCopy-own it: `npx shadcn add marketing-cookie-banner-01`.",
      },
    },
  },
  tags: ["autodocs"],
  args: { placement: "inline" },
  // A stand-in page underneath so the banner has something to sit over while the
  // canvas scrolls; in an app the banner is `fixed` to the viewport.
  decorators: [
    (Story) => (
      <div className="relative flex min-h-[70vh] flex-col bg-background">
        <div className="@container mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12">
          <div className="h-8 w-2/3 rounded-md bg-muted" />
          <div className="h-4 w-full rounded-md bg-muted" />
          <div className="h-4 w-5/6 rounded-md bg-muted" />
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
            <div className="h-40 rounded-lg bg-muted" />
            <div className="h-40 rounded-lg bg-muted" />
            <div className="h-40 rounded-lg bg-muted" />
          </div>
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarketingCookieBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The visitor chose “Manage”: one switch per category, Essential locked on. */
export const PreferencesOpen: Story = { args: { defaultPreferencesOpen: true } };

/** One line of text and the three answers — for sites that want the banner out of the way. */
export const Compact: Story = {
  args: {
    variant: "compact",
    description: "We use cookies to keep you signed in and to learn which pages help.",
  },
};
