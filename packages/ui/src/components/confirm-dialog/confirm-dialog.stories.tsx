import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@qlik-coe-emea/qlabs-components-tokens";
import { Button } from "../button";
import { Text } from "../typography";
import { ConfirmDialog } from "./confirm-dialog";

const meta = {
  title: "Overlays/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  // Every story drives its own `open` state through a `render`; these args exist
  // so the autodocs props table has real values to describe.
  args: {
    open: false,
    onOpenChange: () => {},
    title: "Delete this skill?",
    description: "Removing it also deletes its 42 saved runs. This cannot be undone.",
    confirmLabel: "Delete skill",
    onConfirm: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

function DestructiveConfirm({ loading = false }: { loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete skill
      </Button>
      {deleted ? <Text variant="caption">Skill deleted</Text> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        loading={loading}
        title="Delete this skill?"
        description="Removing it also deletes its 42 saved runs. This cannot be undone."
        confirmLabel="Delete skill"
        onConfirm={() => {
          setDeleted(true);
          setOpen(false);
        }}
      />
    </>
  );
}

/**
 * The confirm tier. Initial focus lands on **Cancel**, not on the destructive
 * action — asserted below rather than eyeballed, because that is the whole
 * reason this component exists instead of a hand-built `Dialog`.
 */
export const Default: Story = {
  render: () => <DestructiveConfirm />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete skill" }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("alertdialog");
    await waitFor(() => expect(within(dialog).getByText("Delete this skill?")).toBeVisible());

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Delete skill" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(document.activeElement).not.toBe(confirm);

    // Cancel is FIRST in the DOM (so AT reads the safe action first) while the
    // footer still paints the confirm action to its inline end.
    expect(cancel.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(confirm.getBoundingClientRect().left).toBeGreaterThan(
      cancel.getBoundingClientRect().left,
    );

    await userEvent.click(confirm);
    await waitFor(() => expect(canvas.getByText("Skill deleted")).toBeVisible());
  },
};

/** Escape cancels — the keyboard route to the safe outcome. */
export const EscapeCancels: Story = {
  render: () => <DestructiveConfirm />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete skill" }));
    const doc = within(canvasElement.ownerDocument.body);
    await doc.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(doc.queryByRole("alertdialog")).toBeNull());
    expect(canvas.queryByText("Skill deleted")).toBeNull();
  },
};

/**
 * The request is in flight. The action swaps in a spinner and reports
 * `aria-busy`, but it is never pre-disabled — and repeat activations are
 * swallowed, so a double-click cannot fire the deletion twice.
 */
export const Loading: Story = {
  render: () => <DestructiveConfirm loading />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete skill" }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: /delete skill/i });

    await waitFor(() => expect(confirm).toHaveAttribute("aria-busy", "true"));
    expect(confirm).not.toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).not.toBeDisabled();

    await userEvent.click(confirm);
    expect(canvas.queryByText("Skill deleted")).toBeNull();
  },
};

function NeutralConfirm() {
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Publish version</Button>
      {published ? <Text variant="caption">Version 4 published</Text> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Publish version 4?"
        description="Everyone in the workspace gets the new prompt on their next run."
        confirmLabel="Publish version"
        onConfirm={() => {
          setPublished(true);
          setOpen(false);
        }}
      />
    </>
  );
}

const openNeutral: Story["play"] = async ({ canvas, canvasElement, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Publish version" }));
  const doc = within(canvasElement.ownerDocument.body);
  const dialog = await doc.findByRole("alertdialog");
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  await waitFor(() => expect(document.activeElement).toBe(cancel));
};

/** A neutral, non-destructive confirmation — same contract, calmer action. */
export const NeutralTone: Story = {
  render: () => <NeutralConfirm />,
  play: openNeutral,
};

/**
 * The DESTRUCTIVE tone in qlik-dark — the third theme of the sweep, alongside
 * qlik-bright (`Default`) and blueprint (`Destructive — blueprint`).
 *
 * This story used to sweep the *neutral* tone here on purpose, because
 * `--destructive-foreground` on `--destructive` measured 3.02:1 in qlik-dark —
 * a token defect every `variant="destructive"` control in the theme shared,
 * which this component could not fix. That token is now the theme's own
 * warm-dark ink at 5.50:1 (#321), so the destructive tone finally gets a real
 * qlik-dark sweep and the workaround is retired.
 */
export const DestructiveQlikDark: Story = {
  name: "Destructive — qlik-dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="qlik-dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: () => <DestructiveConfirm />,
  play: Default.play,
};

export const DestructiveHighDecoration: Story = {
  name: "Destructive — high decoration",
  globals: { decoration: "10" },
  render: () => <DestructiveConfirm />,
  play: Default.play,
};
