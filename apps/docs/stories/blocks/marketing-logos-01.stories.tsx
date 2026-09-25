import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingLogos } from "@/components/marketing-logos-01/marketing-logos";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingLogos,
  title: "Patterns/Blocks/Marketing/Logos",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Who else uses this?",
      description: {
        component:
          "A logo cloud of text wordmarks, each in its own typographic voice, muted until hovered. As a grid the marks wrap; as a marquee they scroll in a loop that pauses on hover and focus and stands still under reduced motion. An optional stat line sits under the marks.\n\nCopy-own it: `npx shadcn add marketing-logos-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingLogos>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The marks scroll continuously; hover or focus the strip to pause it. */
export const Marquee: Story = { args: { layout: "marquee" } };

/** One line of proof under the marks. */
export const WithStat: Story = {
  args: {
    layout: "grid",
    stat: "1,900 depots in 38 countries plan their day on it.",
  },
};
