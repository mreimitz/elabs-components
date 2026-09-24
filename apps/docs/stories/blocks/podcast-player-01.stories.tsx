import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { PodcastPlayer } from "@/components/podcast-player-01/podcast-player";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: PodcastPlayer,
  title: "Patterns/Blocks/Media/Podcast player",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does a listener move through a show — episodes, chapters, the transcript?",
      description: {
        component:
          "A show’s episodes beside one player composed from the ui `MediaPlayer*` parts — cover art, the waveform stage as the scrubber, a bar with speed — plus two parts of the block’s own that read the player’s context: clickable chapters and a transcript that follows playback. Choosing an episode from the list starts it; the list’s button pauses and resumes the one playing.\n\nCopy-own it: `npx shadcn add podcast-player-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PodcastPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The newest episode loaded, six in the list. */
export const Default: Story = {};

/** Opened on an older episode. */
export const OlderEpisode: Story = { args: { defaultEpisodeId: "ep-21" } };

/** A chapter seeks the player; choosing another episode from the list swaps to it. */
export const ChaptersAndSwitching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const player = canvas.getByRole("region", { name: /^Episode 24:/ });
    // Metadata loads (the duration display fills in) and nothing failed to decode.
    await expect(await within(player).findByText("0:16")).toBeVisible();
    await expect(within(player).queryByRole("alert")).toBeNull();

    const chapters = within(player).getByRole("navigation", { name: "Chapters" });
    await userEvent.click(within(chapters).getByRole("button", { name: /Cost of delay/ }));
    await expect(within(chapters).getByRole("button", { name: /Cost of delay/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await userEvent.click(canvas.getByRole("button", { name: "Play episode 22" }));
    const next = await canvas.findByRole("region", { name: /^Episode 22:/ });
    await expect(await within(next).findByText("0:12")).toBeVisible();
    await expect(within(next).queryByRole("alert")).toBeNull();
    // The list marks the chosen episode; whether it is already playing depends on the
    // browser's autoplay policy, so the button's label is not asserted here.
    const current = canvas.getByRole("listitem", { current: true });
    await expect(
      within(current).getByText("Migrating off spreadsheets without a big bang"),
    ).toBeVisible();
  },
};
