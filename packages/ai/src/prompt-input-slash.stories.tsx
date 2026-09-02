/**
 * PromptInputSlash — a `/`-triggered slash-command palette for the composer.
 *
 * Typing `/` at the START of a line (never mid-word) opens a filtered listbox
 * of app-defined commands; arrow keys move the highlight, Enter/Tab inserts
 * `/name `, Escape dismisses — and, like `MentionInput`, **focus never leaves
 * the textarea**. Ships no command vocabulary of its own; `commands` is
 * entirely prop-driven.
 */
import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { type SlashCommand } from "@elabs-ai/components-ui";

import { PromptInput } from "./prompt-input";
import { PromptInputSlash, PromptInputSlashTextarea } from "./prompt-input-slash";

const COMMANDS: SlashCommand[] = [
  { name: "help", description: "Show available commands" },
  { name: "history", description: "Show recent conversation history" },
  { name: "hide", description: "Hide this panel" },
  { name: "clear", description: "Clear the conversation" },
  { name: "settings", description: "Open workspace settings" },
];

/** The stateful arrangement every story below composes — mirrors the docblock example. */
function Field({ commands = COMMANDS }: { commands?: SlashCommand[] }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  return (
    <div className="mx-auto w-[28rem]">
      <PromptInput onSubmit={() => undefined}>
        <PromptInputSlash
          commands={commands}
          value={text}
          textareaRef={textareaRef}
          onValueChange={(next) => setText(next.text)}
        >
          <PromptInputSlashTextarea
            aria-label="Message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type / for commands…"
          />
        </PromptInputSlash>
      </PromptInput>
    </div>
  );
}

const meta = {
  title: "AI/PromptInputSlash",
  component: PromptInputSlash,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A /-triggered command palette for the composer. Triggers at the start of a line only, filters case-insensitively by prefix, and keeps focus in the textarea throughout — aria-activedescendant on the field always names the highlighted option.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PromptInputSlash>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting state — an empty field with nothing but its placeholder. */
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
    const field = canvas.getByRole("textbox", { name: "Message" });

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
    });
  },
};

/**
 * Typing `/` mid-word (not at the start of a line) never opens the palette —
 * the acceptance test for the line-start boundary.
 */
export const NotMidWord: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Message" });
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
    const field = canvas.getByRole("textbox", { name: "Message" });
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
    const field = canvas.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard("/h");
    await userEvent.keyboard("{Enter}");

    await expect(field.value).toBe("/help ");
    // The popover exits with an animation (Radix Presence keeps it mounted
    // until the exit transition finishes), so the removal is asynchronous.
    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};

/** Escape closes the palette and returns focus to the textarea. */
export const CloseWithEscape: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Message" });
    await userEvent.click(field);
    await userEvent.keyboard("/h");
    await userEvent.keyboard("{Escape}");

    // See SelectWithEnter: the exit animation delays the actual unmount.
    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await expect(field).toHaveFocus();
    await expect(field).not.toHaveAttribute("aria-activedescendant");
  },
};

/**
 * No commands match the typed query — the empty state renders in the
 * listbox. Ends by dismissing the palette: `cmdk`'s empty state is a bare
 * `role="presentation"` node with no `option`/`group` children, which is a
 * pre-existing `aria-required-children` shape shared by every cmdk-based
 * combobox in this repo (already baselined for `overlays-command--groups`)
 * — closing the palette before the story's axe pass avoids re-asserting that
 * same, already-accepted primitive limitation here too.
 */
export const NoMatches: Story = {
  render: () => <Field />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Message" });
    await userEvent.click(field);
    await userEvent.keyboard("/zzzz");
    await expect(within(document.body).queryAllByRole("option")).toHaveLength(0);
    await expect(
      document.querySelector('[data-slot="prompt-input-slash-empty"]'),
    ).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};
