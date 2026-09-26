import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { expect, userEvent, within } from "storybook/test";
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
export const Marquee: Story = {
  // The test runner is a reduced-motion user, under whom the marquee stands still on purpose;
  // the JS hook reads the provider, so the story opts back into full motion there.
  decorators: [
    (Story) => (
      <ThemeProvider
        decorationStorageKey={null}
        defaultMotionPreference="full"
        densityStorageKey={null}
        motionStorageKey={null}
        storageKey={null}
      >
        <Story />
      </ThemeProvider>
    ),
  ],
  args: { layout: "marquee" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("group", { name: "Customer marks, scrolling" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Pause scrolling" }));
    await expect(canvas.getByRole("button", { name: "Resume scrolling" })).toBeVisible();
  },
};

/** One line of proof under the marks. */
export const WithStat: Story = {
  args: {
    layout: "grid",
    stat: "1,900 depots in 38 countries plan their day on it.",
  },
};
