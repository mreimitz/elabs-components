import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { CustomerStory } from "@/components/customer-story-01/customer-story";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CustomerStory,
  title: "Patterns/Blocks/Media/Customer story",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I tell a customer’s story with their film, the numbers and the screens?",
      description: {
        component:
          "A case study as a reading page: headline and lead, the customer’s film in the ui `Video` player (poster, captions, docked controls), results as metric tiles, then the numbered narrative with pull quotes beside a sticky fact sheet. A screenshot gallery opens each screen in a lightbox with previous/next and the arrow keys; related stories and a call to action close the page.\n\nCopy-own it: `npx shadcn add customer-story-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole page: film, results, narrative, fact sheet, screens, related stories. */
export const Default: Story = {};

/** The screenshot gallery after the first section instead of the second. */
export const ScreensAfterTheChallenge: Story = { args: { screenshotsAfter: "challenge" } };

/** A screen opens in the lightbox; Next and the arrow keys move through the set. */
export const OpensAScreen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The film loads its metadata (the duration display fills in) and nothing failed.
    const player = canvas.getByRole("region", { name: /^Film:/ });
    await expect(await within(player).findByText("0:12")).toBeVisible();
    await expect(within(player).queryByRole("alert")).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /^Open screen 1 of 5/ }));
    const dialog = await screen.findByRole("dialog", { name: "Screen 1 of 5" });
    await expect(within(dialog).getByRole("button", { name: "Previous screen" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Next screen" }));
    await expect(await screen.findByRole("dialog", { name: "Screen 2 of 5" })).toBeVisible();
    await userEvent.keyboard("{ArrowRight}");
    await expect(await screen.findByRole("dialog", { name: "Screen 3 of 5" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};
