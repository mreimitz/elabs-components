/**
 * TerminalSlashMenu — the console composer's `/`-command palette (#117, T12).
 *
 * Typing `/` at the START of a line (never mid-word, never mid-path — `cd
 * /usr` does not open it) opens a filtered listbox of app-defined commands
 * anchored to the composer's own textarea; arrow keys move the highlight
 * (wrapping at both ends, clamping into a narrowed list), Enter splices the
 * command in, Escape dismisses — focus never leaves the field. Ships no
 * command vocabulary of its own; `commands` is entirely prop-driven.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { type SlashCommand } from "@elabs-ai/components-ui";

import { TerminalSlashMenu } from "./terminal-slash-menu";

const COMMANDS: SlashCommand[] = [
  { name: "help", description: "Show available commands" },
  { name: "history", description: "Show recent turn history" },
  { name: "hide", description: "Hide this panel" },
  { name: "clear", description: "Clear the transcript" },
  { name: "settings", description: "Open workspace settings" },
];

/** The stateful arrangement every story below composes. */
function Field({ commands = COMMANDS }: { commands?: SlashCommand[] }) {
  const [value, setValue] = useState("");
  return (
    <div className="mx-auto w-[28rem]">
      <TerminalSlashMenu
        commands={commands}
        value={value}
        onValueChange={(next) => setValue(next.text)}
      />
    </div>
  );
}

const meta = {
  title: "Terminal/TerminalSlashMenu",
  component: TerminalSlashMenu,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/Composer/PromptInputSlash` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The console skin's `/`-command palette: a popover listbox anchored to " +
          "`TerminalComposer`'s own textarea, filtered by prefix, navigated with " +
          "wrapping/clamped arrow keys, and spliced into the text on Enter — the caret " +
          "never leaves the field. Renders the whole `TerminalComposer` internally " +
          "rather than exposing it as a sub-part (see the module doc).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TerminalSlashMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting state — an empty console composer with nothing but its placeholder. */
export const Default: Story = {
  render: () => <Field />,
};

/**
 * Typing `/` at the start of the line opens the palette; arrow keys move the
 * highlight without ever moving focus off the textarea.
 */
export const PaletteOpen: Story = {
  render: () => <Field />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText("Type your next instruction…");

    await step("typing '/' at the start of the line opens the palette", async () => {
      await userEvent.click(field);
      await userEvent.keyboard("/h");
      await expect(within(document.body).getByRole("listbox")).toBeInTheDocument();
    });

    await step("arrow keys move the highlight without moving focus", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(field).toHaveFocus();

      const activeId = field.getAttribute("aria-activedescendant");
      await expect(activeId).toBeTruthy();
      const active = document.getElementById(activeId!);
      await expect(active).not.toBeNull();
      await expect(active).toHaveAttribute("aria-selected", "true");
      // The non-colour channel: the active row's reserved-width marker.
      await expect(active).toHaveTextContent("❯");
    });
  },
};

/**
 * Typing `/` mid-word (not at the start of a line) never opens the palette —
 * the acceptance test for the line-start boundary this palette uses instead
 * of `MentionInput`'s word boundary.
 */
export const NotMidWord: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText("Type your next instruction…");
    await userEvent.click(field);
    await userEvent.keyboard("cd /usr");
    await expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument();
  },
};

/**
 * Narrowing the query clamps the highlighted option into the filtered list —
 * it can never point at an option that has scrolled out of the results.
 */
export const NarrowingClampsTheHighlight: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText("Type your next instruction…");
    await userEvent.click(field);
    await userEvent.keyboard("/h");
    await expect(within(document.body).getAllByRole("option")).toHaveLength(3);

    // Highlight the LAST of the three "h" matches.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    // Narrow to the single command that still matches.
    await userEvent.keyboard("id");
    const options = within(document.body).getAllByRole("option");
    await expect(options).toHaveLength(1);
    await expect(options[0]).toHaveAttribute("aria-selected", "true");
    await expect(field).toHaveAttribute("aria-activedescendant", options[0]!.id);
  },
};

/** Enter inserts the highlighted command and closes the palette. */
export const SelectWithEnter: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText("Type your next instruction…") as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard("/h");
    await userEvent.keyboard("{Enter}");

    await expect(field.value).toBe("/help ");
    // The popover exits with an animation (Radix Presence keeps it mounted
    // until the exit transition finishes), so the removal is asynchronous.
    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await expect(field).toHaveFocus();
  },
};

/** Escape closes the palette and returns focus to the textarea, selecting nothing. */
export const CloseWithEscape: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText("Type your next instruction…") as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard("/h");
    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await expect(field).toHaveFocus();
    await expect(field.value).toBe("/h");
    await expect(field).not.toHaveAttribute("aria-activedescendant");
  },
};

/**
 * No commands match the typed query — a real empty state renders as a
 * sibling of the listbox (never a collapsed popover with nothing in it).
 */
export const NoMatches: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText("Type your next instruction…");
    await userEvent.click(field);
    await userEvent.keyboard("/zzzz");
    await expect(within(document.body).queryAllByRole("option")).toHaveLength(0);
    await expect(within(document.body).getByRole("listbox")).toBeInTheDocument();
    await expect(
      document.querySelector('[data-slot="terminal-slash-menu-empty"]'),
    ).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};
