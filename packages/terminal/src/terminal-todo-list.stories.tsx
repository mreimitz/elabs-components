import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { TerminalSurface } from "./terminal-surface";
import { TerminalTodoList, type TerminalTodoItem } from "./terminal-todo-list";

const CHECKLIST: TerminalTodoItem[] = [
  { id: "1", text: "Read the terminal-components rule", status: "done" },
  { id: "2", text: "Build TerminalTodoList", status: "active" },
  { id: "3", text: "Ship the changelog entry", status: "pending" },
  { id: "4", text: "Run the quality gates", status: "pending" },
];

const meta = {
  title: "Terminal/TerminalTodoList",
  component: TerminalTodoList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The coding-agent CLI three-state checklist (#117, derived from Claude " +
          "Code's own todo list — see `packages/terminal/references/agent-session-family.md`). " +
          "Each row is a real `<li>`, one glyph (`✔` / `◼` / `◻`), and an announced word " +
          "riding `TerminalRow`'s `gutterLabel` — the state survives greyscale AND reaches " +
          "assistive tech without a second, hand-rolled `sr-only` span.",
      },
    },
  },
  decorators: [
    (Story) => (
      <TerminalSurface>
        <Story />
      </TerminalSurface>
    ),
  ],
  args: {
    items: CHECKLIST,
  },
} satisfies Meta<typeof TerminalTodoList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every state at once: a real `<ol>`, one glyph and one announced word per row. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The load-bearing assertion for this component: the announced WORD per
    // state, not merely that the rows render with different classes.
    await expect(canvas.getByText("(completed)")).toBeInTheDocument();
    await expect(canvas.getByText("(in progress)")).toBeInTheDocument();
    await expect(canvas.getAllByText("(pending)")).toHaveLength(2);
  },
};

/**
 * `rail` suppresses every row's glyph in favour of a vertical rule — the
 * announced word is the ONLY thing left carrying the state, and it must
 * still be there.
 */
export const Rail: Story = {
  args: { variant: "rail" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("✔")).not.toBeInTheDocument();
    await expect(canvas.getByText("(in progress)")).toBeInTheDocument();
  },
};

/** A square framed block per row — the frame-drawing CLI reading. */
export const Boxed: Story = {
  args: { variant: "boxed" },
};

/** A single in-flight item, shown bold with no strikethrough. */
export const SingleActiveItem: Story = {
  args: { items: [{ text: "Refactor the parser", status: "active" }] },
};

/** A row dropped with no `id` still renders — the list falls back to its index. */
export const NoStableId: Story = {
  args: {
    items: [
      { text: "First task", status: "done" },
      { text: "Second task", status: "pending" },
    ],
  },
};
