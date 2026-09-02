import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button, KeyboardShortcuts, type ShortcutGroup } from "@elabs-ai/components-ui";

import { TerminalOverlay, type TerminalOverlayHint } from "./terminal-overlay";

const HINTS: TerminalOverlayHint[] = [
  { action: "Close overlay", keys: ["Esc"] },
  { action: "Open shortcuts", keys: ["⌘", "K"] },
];

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "session",
    label: "Session",
    defaultOpen: true,
    items: [
      { action: "Open this panel", keys: ["⌘", "K"] },
      { action: "Clear transcript", keys: ["⌘", "L"] },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    items: [{ action: "Interrupt the agent", keys: ["Esc"] }],
  },
];

const meta = {
  title: "Terminal/TerminalOverlay",
  component: TerminalOverlay,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The console-dress modal FRAME: a real Radix `Dialog` painted on the terminal " +
          "ground, with a title row, arbitrary caller content, and an optional key-hint " +
          "footer legend. It is a frame, not a catalogue of panels — the canonical filler " +
          "is `KeyboardShortcuts` (`@elabs-ai/components-ui`), which this component HOSTS " +
          "rather than re-implements (see `WithKeyboardShortcuts`).",
      },
    },
  },
  // Every story drives its own `open` state through a `render`; these args exist
  // so the autodocs props table has real values to describe.
  args: {
    open: false,
    onOpenChange: () => {},
    title: "Keyboard shortcuts",
  },
} satisfies Meta<typeof TerminalOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

function OverlayDemo({
  description,
  hints,
  children,
}: {
  description?: string;
  hints?: TerminalOverlayHint[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open panel</Button>
      <TerminalOverlay
        open={open}
        onOpenChange={setOpen}
        title="Keyboard shortcuts"
        description={description}
        hints={hints}
      >
        {children ?? <p>Reference content lives here — the frame supplies the ground only.</p>}
      </TerminalOverlay>
    </>
  );
}

/** A minimal panel: title, body content, and the footer key-hint legend. */
export const Default: Story = {
  render: () => <OverlayDemo hints={HINTS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open panel" }));

    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await expect(within(dialog).getByText("Keyboard shortcuts")).toBeVisible();
    await expect(within(dialog).getByText("Close overlay")).toBeVisible();
    await expect(within(dialog).getByText("Open shortcuts")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(doc.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

/** A caller-supplied description, linked to the panel via `aria-describedby`. */
export const WithDescription: Story = {
  render: () => (
    <OverlayDemo description="Every shortcut available in this session." hints={HINTS} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open panel" }));

    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-describedby");
    // The dialog's own enter transition (`animate-in`/`fade-in-0`) can still be
    // mid-flight right after `findByRole` resolves, so a strict `toBeVisible()`
    // taken immediately can catch it at a transient opacity — wait it out
    // rather than asserting on an animation frame.
    await waitFor(() =>
      expect(within(dialog).getByText("Every shortcut available in this session.")).toBeVisible(),
    );
  },
};

/** No `hints` at all — the footer legend does not render, never an empty bar. */
export const NoHints: Story = {
  render: () => <OverlayDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open panel" }));

    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    await expect(
      dialog.querySelector("[data-slot='terminal-overlay-legend']"),
    ).not.toBeInTheDocument();
  },
};

/**
 * The canonical filler: `KeyboardShortcuts` (`@elabs-ai/components-ui`) hosted
 * inside the frame. `KeyboardShortcuts` is calibrated against
 * `--card`/`--background`, not the always-dark terminal ground, so it is
 * wrapped in its own ordinary card surface — "a chip punched out of the
 * console", inverted: an ordinary card punched INTO the console frame.
 */
export const WithKeyboardShortcuts: Story = {
  render: () => (
    <OverlayDemo hints={HINTS}>
      <div className="rounded-md bg-card p-3 text-card-foreground">
        <KeyboardShortcuts groups={SHORTCUT_GROUPS} />
      </div>
    </OverlayDemo>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open panel" }));

    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    // See the `WithDescription` story: wait out the dialog's own enter
    // transition rather than asserting `toBeVisible()` on an animation frame.
    await waitFor(() => expect(within(dialog).getByText("Session")).toBeVisible());
    await expect(within(dialog).getByText("Clear transcript")).toBeVisible();
  },
};
