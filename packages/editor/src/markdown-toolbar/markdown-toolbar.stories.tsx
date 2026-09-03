import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import type { MonacoCodeEditor } from "../code-editor";
import { BRAND_SLASH_COMMANDS } from "../markdown-editor/slash";
import { MarkdownToolbar } from "./markdown-toolbar";

// A no-op stand-in so the toolbar's controls (and the Insert trigger) are enabled
// in the story. Listing the Insert items never calls editor methods — only an
// item click does — so an empty object is enough to render and open the menu.
const fakeEditor = {} as unknown as MonacoCodeEditor;

const meta = {
  title: "Editor/MarkdownToolbar",
  component: MarkdownToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The markdown SOURCE-pane toolbar; the general-purpose roving control strip is " +
          "`Layout/Toolbar` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Formatting chrome for the markdown SOURCE pane, composed from @elabs-ai/components-ui. " +
          "The Insert menu is driven by the slash-command registry, so source mode " +
          "reaches the same brand blocks as the WYSIWYG `/` menu.",
      },
    },
  },
} satisfies Meta<typeof MarkdownToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { editor: fakeEditor },
};

/**
 * Source / split Insert-menu parity (A4): passing the slash registry as
 * `insertCommands` makes the Insert menu list every command that carries a
 * source-mode `snippet` — Card · Callout · Metric · Timeline · Iterate · Pivot ·
 * Calc — so a markdown-first author can insert `/calc`, `/iterate` and `/pivot`
 * from the toolbar, not only from the WYSIWYG slash menu.
 */
export const InsertParity: Story = {
  args: { editor: fakeEditor, insertCommands: BRAND_SLASH_COMMANDS },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Insert block" }));
    const menu = within(canvasElement.ownerDocument.body);
    // The blocks the old hardcoded 4-item menu lacked are now present.
    // waitFor rides out the DropdownMenu entrance animation (opacity starts
    // at 0) — the dropdown-menu.stories.tsx precedent (#278 D2).
    const calc = await menu.findByRole("menuitem", { name: "Calc" });
    await waitFor(() => expect(calc).toBeVisible());
    await waitFor(() => expect(menu.getByRole("menuitem", { name: "Iterate" })).toBeVisible());
    await waitFor(() => expect(menu.getByRole("menuitem", { name: "Pivot" })).toBeVisible());
  },
};
