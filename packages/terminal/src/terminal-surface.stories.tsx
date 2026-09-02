import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { TerminalRow } from "./terminal-row";
import { TerminalSurface } from "./terminal-surface";

const meta = {
  title: "Terminal/TerminalSurface",
  component: TerminalSurface,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The console **ground** for the agent-session family: it establishes the " +
          "surface, the monospace type role and the two-column gutter grid exactly " +
          "once, then publishes a single value — the gutter grammar — to every row " +
          "inside. Rows stay independent components; coherence comes from the " +
          "cascade rather than from a provider that owns a transcript. It " +
          "deliberately owns no scroll container: a long transcript is the " +
          "caller's to virtualize.",
      },
    },
  },
} satisfies Meta<typeof TerminalSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A short transcript, so each variant story shows the same content. */
function Transcript() {
  return (
    <>
      <TerminalRow gutter=">">pnpm build</TerminalRow>
      <TerminalRow gutter="◼" gutterLabel="in progress">
        Compiling 42 modules
      </TerminalRow>
      <TerminalRow gutter="✔" gutterLabel="completed">
        Build complete in 1.8s
      </TerminalRow>
      <TerminalRow gutter="⎿">
        A long, unbroken path wraps under the content column rather than pushing the row out of the
        surface: packages/terminal/src/very/long/path/that/keeps/going.tsx
      </TerminalRow>
    </>
  );
}

export const Default: Story = {
  args: { children: <Transcript /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The row's meaning survives without colour or glyph — the third channel.
    await expect(canvas.getByText("in progress")).toBeInTheDocument();
  },
};

/** A glyph in the gutter cell. Reads as a bullet transcript. */
export const Marker: Story = {
  args: { variant: "marker", children: <Transcript /> },
};

/** A rule down the gutter, glyph suppressed — the accessible label remains. */
export const Rail: Story = {
  args: { variant: "rail", children: <Transcript /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Suppressing the glyph must not suppress the meaning.
    await expect(canvas.getByText("completed")).toBeInTheDocument();
  },
};

/** A square framed block per row. Reads as frame-drawing output. */
export const Boxed: Story = {
  args: { variant: "boxed", children: <Transcript /> },
};

/**
 * Restoring a past session. Layout-shaped placeholders reserve the real grid
 * — never a spinner — behind exactly one polite announcement.
 */
export const Loading: Story = {
  args: { loading: true, loadingRows: 5 },
};

/** A wider gutter, for a two-character marker. */
export const WideGutter: Story = {
  args: {
    gutter: "2.5rem",
    children: (
      <>
        <TerminalRow gutter="++" gutterLabel="added">
          src/terminal-surface.tsx
        </TerminalRow>
        <TerminalRow gutter="--" gutterLabel="removed">
          src/legacy-console.tsx
        </TerminalRow>
      </>
    ),
  },
};

/**
 * A row outside any surface still renders legibly. That is the difference
 * between a surface and a required provider.
 */
export const RowWithoutSurface: Story = {
  render: () => (
    <TerminalRow gutter="◼" gutterLabel="in progress">
      Standalone row, no surrounding surface
    </TerminalRow>
  ),
};
