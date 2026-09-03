import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { useState } from "react";

import { MarkdownEditor } from "../markdown-editor";
import { BRAND_SLASH_COMMANDS, filterSlashCommands } from "./brand-slash-commands";
import { SlashMenu } from "./slash-menu";

/**
 * The `/` command menu for the WYSIWYG markdown editor. Typing `/` at a block
 * start (or after whitespace) opens a branded popup that inserts the brand `:::`
 * directives (card / callout / metric / timeline) + basic blocks live at the
 * caret. Opt in via the `slashMenu` prop on `MarkdownEditor` /
 * `MarkdownWorkspace` (default `true`).
 *
 * The popup itself is rendered here standalone (the `SlashMenu` stories) so its
 * branding + a11y can be verified directly across every theme; the in-editor
 * stories exercise the integration (mount + the `slashMenu={false}` no-op). The
 * live keyboard/insert UX is best verified in a real browser — ProseMirror
 * keystroke dispatch can't be fully simulated in jsdom.
 */
const meta = {
  title: "Editor/MarkdownEditor/SlashMenu",
  component: SlashMenu,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The EDITOR slash menu, which inserts ProseMirror nodes; a chat composer uses " +
          "`AI/PromptInputSlash` and a console composer `Terminal/TerminalSlashMenu` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Branded `/` command menu for the WYSIWYG editor. Inserts brand `:::` " +
          "directives + basic blocks at the caret. Token-driven `listbox`/`option` " +
          "list; the editor `textbox` owns `aria-activedescendant`.",
      },
    },
  },
} satisfies Meta<typeof SlashMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The popup standalone, with the first command highlighted (default state). */
export const Default: Story = {
  args: {
    commands: BRAND_SLASH_COMMANDS,
    activeId: BRAND_SLASH_COMMANDS[0]?.id,
    onSelect: () => {},
  },
  render: (args) => (
    <div className="p-6">
      <SlashMenu {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The popup is a labelled listbox of options grouped by section.
    await expect(canvas.getByRole("listbox", { name: "Insert block" })).toBeVisible();
    await expect(canvas.getByRole("option", { name: /Card/ })).toBeVisible();
    // The first option is selected by default.
    await expect(canvas.getByRole("option", { name: /Card/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

/** Filtered to a query (`/ca`) — Card + Callout match by label, the Brand group leads. */
export const Filtered: Story = {
  args: {
    commands: filterSlashCommands(BRAND_SLASH_COMMANDS, "ca"),
    onSelect: () => {},
  },
  render: function FilteredStory(args) {
    const [activeId, setActiveId] = useState(args.commands[0]?.id);
    return (
      <div className="p-6">
        <SlashMenu {...args} activeId={activeId} onSelect={(c) => setActiveId(c.id)} />
      </div>
    );
  },
};

/** The empty state when nothing matches the query. */
export const Empty: Story = {
  args: {
    commands: [],
    onSelect: () => {},
  },
  render: (args) => (
    <div className="p-6">
      <SlashMenu {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No matching blocks")).toBeVisible();
  },
};

const SAMPLE = `# Release notes

Type "/" on a new line to insert a brand block (card, callout, metric, timeline)
or a basic block.
`;

/**
 * The slash menu wired into the live editor. Place the caret on an empty line and
 * type `/` to open the menu. (The play test only asserts the editor mounts — drive
 * the keyboard/insert flow in a real browser.)
 */
export const InEditor: StoryObj<typeof MarkdownEditor> = {
  name: "In editor (slashMenu enabled)",
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <MarkdownEditor defaultValue={SAMPLE} slashMenu />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("textbox", { name: "Markdown editor" }, { timeout: 8000 }),
    ).toBeVisible();
  },
};

/** `slashMenu={false}` disables the menu (the editor renders normally). */
export const Disabled: StoryObj<typeof MarkdownEditor> = {
  name: "In editor (slashMenu disabled)",
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <MarkdownEditor defaultValue={SAMPLE} slashMenu={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("textbox", { name: "Markdown editor" }, { timeout: 8000 }),
    ).toBeVisible();
  },
};
