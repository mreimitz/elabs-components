import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { MediaGallery } from "@/components/media-gallery-01/media-gallery";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MediaGallery,
  title: "Patterns/Blocks/Media/Media gallery",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does one gallery hold photos, films and recordings together?",
      description: {
        component:
          "Photographs, films and recordings side by side in a masonry of tiles, each marked by kind and length, filtered by kind. Selecting a tile opens the lightbox with the right viewer: the ui `Image` for a photo, the `Video` player for a film, the `Media` player with cover art above the waveform for a recording. Previous/next and the arrow keys move through the filtered set.\n\nCopy-own it: `npx shadcn add media-gallery-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MediaGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every kind, in the order taken — twelve tiles in a four-column masonry. */
export const Default: Story = {};

/** The filter narrowed to recordings. */
export const AudioOnly: Story = { args: { defaultFilter: "audio" } };

/** A film opens in its player; Next moves on to a photo, then a recording in its player. */
export const OpensEachKind: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Play Opening keynote, 0:14/ }));
    const dialog = await screen.findByRole("dialog", { name: /Opening keynote/ });
    const film = within(dialog).getByRole("region", { name: "Opening keynote" });
    await expect(await within(film).findByText("0:14")).toBeVisible();
    await expect(within(dialog).queryByRole("alert")).toBeNull();

    await userEvent.click(within(dialog).getByRole("button", { name: "Next item" }));
    const photo = await screen.findByRole("dialog", { name: /Gate 4 at first light/ });
    await expect(within(photo).getByRole("img", { name: "Gate 4 at first light" })).toBeVisible();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    const recording = await screen.findByRole("dialog", { name: /Ingrid Solberg/ });
    const player = within(recording).getByRole("region", { name: /Ingrid Solberg/ });
    await expect(await within(player).findByText("0:12")).toBeVisible();
  },
};
