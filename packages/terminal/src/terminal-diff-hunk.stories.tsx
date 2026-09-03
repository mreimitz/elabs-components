import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { DiffLine } from "@elabs-ai/components-ui";

import { TerminalDiffHunk } from "./terminal-diff-hunk";
import { TerminalSurface } from "./terminal-surface";

const GREET_LINES: DiffLine[] = [
  { type: "context", oldNumber: 1, newNumber: 1, text: "function greet(name) {" },
  { type: "del", oldNumber: 2, text: "  console.log('hi ' + name);" },
  { type: "add", newNumber: 2, text: "  console.log(`hi ${name}`);" },
  { type: "context", oldNumber: 3, newNumber: 3, text: "}" },
];

const meta = {
  title: "Terminal/TerminalDiffHunk",
  component: TerminalDiffHunk,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/DiffView` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "An inline unified diff hunk in console dress (#117, derived from Claude " +
          "Code's own diff view — see `packages/terminal/references/agent-session-family.md`). " +
          "Each real line carries a marker glyph, an `sr-only` polarity word riding " +
          "`TerminalRow`'s `gutterLabel` (`add`/`del` only — `context` announces nothing " +
          "extra), and a redundant colour wash — never colour alone. A long run of " +
          "`context` lines collapses behind a real, keyboard-operable Radix `Collapsible`.",
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
    file: "src/greet.ts",
    lines: GREET_LINES,
  },
} satisfies Meta<typeof TerminalDiffHunk>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A small hunk: one deletion, one addition, unchanged lines either side. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Update (src/greet.ts)")).toBeInTheDocument();
    // The load-bearing accessibility assertion: the announced polarity WORD,
    // not merely a colour difference between the add/del rows.
    await expect(canvas.getByText("Added:", { exact: false })).toBeInTheDocument();
    await expect(canvas.getByText("Removed:", { exact: false })).toBeInTheDocument();
  },
};

/** An optional second header line, prefixed with the `⎿` continuation glyph. */
export const WithSummary: Story = {
  args: { summary: "Use a template literal instead of string concatenation" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Use a template literal instead of string concatenation"),
    ).toBeInTheDocument();
  },
};

/**
 * `hunk`/`meta` diff-header lines render through the same shared model —
 * no line number, no marker, a muted/italic full-width treatment.
 */
export const HunkAndMetaLines: Story = {
  args: {
    lines: [
      { type: "meta", text: "diff --git a/src/greet.ts b/src/greet.ts" },
      { type: "hunk", text: "@@ -1,4 +1,4 @@" },
      ...GREET_LINES,
    ] satisfies DiffLine[],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("diff --git a/src/greet.ts b/src/greet.ts")).toBeInTheDocument();
    await expect(canvas.getByText("@@ -1,4 +1,4 @@")).toBeInTheDocument();
  },
};

/**
 * `rail` suppresses every row's glyph in favour of a vertical rule — the
 * announced polarity word is the ONLY thing left carrying add/del, and it
 * must still be there.
 */
export const Rail: Story = {
  args: { variant: "rail" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("+")).not.toBeInTheDocument();
    await expect(canvas.getByText("Added:", { exact: false })).toBeInTheDocument();
  },
};

/** A square framed block per row — the frame-drawing CLI reading. */
export const Boxed: Story = {
  args: { variant: "boxed" },
};

/**
 * A long run of unchanged lines collapses behind a real disclosure — a
 * keyboard user opens it with Tab then Enter, never a CLI chord, and it
 * genuinely re-collapses (a `Collapsible`, not a one-way reveal).
 */
export const CollapsedContext: Story = {
  args: {
    contextLines: 2,
    lines: [
      { type: "add", newNumber: 1, text: "top of the hunk" },
      { type: "context", oldNumber: 2, newNumber: 2, text: "unchanged line 1" },
      { type: "context", oldNumber: 3, newNumber: 3, text: "unchanged line 2" },
      { type: "context", oldNumber: 4, newNumber: 4, text: "unchanged line 3" },
      { type: "context", oldNumber: 5, newNumber: 5, text: "unchanged line 4" },
      { type: "context", oldNumber: 6, newNumber: 6, text: "unchanged line 5" },
      { type: "context", oldNumber: 7, newNumber: 7, text: "unchanged line 6" },
      { type: "del", oldNumber: 8, text: "bottom of the hunk" },
    ] satisfies DiffLine[],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("unchanged line 3")).not.toBeInTheDocument();

    const trigger = canvas.getByRole("button", { name: /show \d+ more lines?/i });
    trigger.focus();
    await expect(trigger).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("unchanged line 3")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /show \d+ more lines?/i })).toBeVisible();
  },
};

/** Long lines wrap under the content column instead of pushing the row wide. */
export const LongLine: Story = {
  args: {
    lines: [
      {
        type: "add",
        newNumber: 1,
        text: "  const message = `A long, unbroken generated line that must wrap under the content column instead of overflowing the console surface`;",
      },
    ] satisfies DiffLine[],
  },
};
