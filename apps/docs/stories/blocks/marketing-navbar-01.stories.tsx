import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingNavbar } from "@/components/marketing-navbar-01/marketing-navbar";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingNavbar,
  title: "Patterns/Blocks/Marketing/Navbar",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Site navigation with the links inline when there is room and in a `Sheet` when there is not. The current route is marked with `aria-current`, the theme switcher and sign-in stand down before the call to action does, and the layout follows its container rather than the window.\n\nCopy-own it: `npx shadcn add marketing-navbar-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingNavbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** On the Pricing page: the link is marked current. */
export const ActiveLink: Story = { args: { activeHref: "#pricing" } };

/** In a narrow column the links move into the menu. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <MarketingNavbar {...args} />
    </div>
  ),
};
