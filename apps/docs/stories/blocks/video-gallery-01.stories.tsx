import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { VideoGallery } from "@/components/video-gallery-01/video-gallery";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: VideoGallery,
  title: "Patterns/Blocks/Media/Video gallery",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does a team browse its videos and play one without leaving the page?",
      description: {
        component:
          "A filterable grid of video tiles — poster, play mark, duration, title and date — that opens the chosen video in a dialog with the ui `Video` player (captions, keyboard, docked controls) and previous/next to move through the set. Tiles are real buttons; the dialog handles focus, Escape and the backdrop.\n\nCopy-own it: `npx shadcn add video-gallery-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof VideoGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every category, newest first in each — nine tiles in a three-column grid. */
export const Default: Story = {};

/** The filter narrowed to one category; the count in the header follows it. */
export const Tutorials: Story = { args: { defaultCategory: "Tutorials" } };

/** A tile opens the dialog with the player; Next moves through the filtered set. */
export const OpensFromTile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Play Onboarding tour, 0:15" }));
    const dialog = await screen.findByRole("dialog", { name: "Onboarding tour" });
    const player = within(dialog).getByRole("region", { name: "Video player" });
    // Metadata loads (the duration display fills in) and nothing failed to decode.
    await expect(await within(player).findByText("0:15")).toBeVisible();
    await expect(within(dialog).queryByRole("alert")).toBeNull();
    await expect(within(dialog).getByRole("button", { name: "Previous video" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Next video" }));
    await expect(
      await screen.findByRole("dialog", { name: "What’s new in September" }),
    ).toBeVisible();
  },
};
