import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "../button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../dialog";

function open(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete this skill?"
      description="Removing it also deletes its saved runs. This cannot be undone."
      confirmLabel="Delete skill"
      tone="destructive"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("ConfirmDialog initial focus", () => {
  // The headline AC: opening a confirmation must NOT put the keyboard on the
  // destructive action. `AlertDialogContent` prevents its own open-autofocus and
  // focuses the mounted Cancel — which is why ConfirmDialog always renders one.
  it("lands focus on the safe action, not the destructive one", async () => {
    open();
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Delete skill" }));
  });

  // The negative twin — this documents WHY the named component exists. A plain
  // `Dialog` focuses whatever comes first in the DOM, so a confirmation built
  // from one is only ever safe by accident: reorder the footer and the keyboard
  // now starts on the destructive action.
  it("a plain Dialog focuses by DOM order — the destructive action when it is first", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete this skill?</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
          <DialogFooter>
            <Button variant="destructive">Delete skill</Button>
            <Button variant="outline">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const destructive = await screen.findByRole("button", { name: "Delete skill" });
    await waitFor(() => expect(document.activeElement).toBe(destructive));
  });

  // …whereas ConfirmDialog cannot be mis-ordered: Cancel is always rendered, and
  // Radix focuses IT rather than the first tabbable child.
  it("keeps focus on Cancel even with extra focusable content above it", async () => {
    open({
      children: (
        <a href="#docs" data-testid="learn-more">
          What happens to my runs?
        </a>
      ),
    });
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });

  it("uses role=alertdialog and is described by its description", async () => {
    open();
    const dialog = await screen.findByRole("alertdialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain("cannot be undone");
  });
});

describe("ConfirmDialog actions", () => {
  it("fires onConfirm once and leaves closing to the app", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = open();

    await user.click(await screen.findByRole("button", { name: "Delete skill" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The app owns `open` — confirming must not close behind its back, which is
    // what makes an async `loading` state possible.
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancel closes through onOpenChange(false) and calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { onOpenChange, onConfirm } = open({ onCancel });

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape cancels", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirm } = open();
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("labels the confirm action with the consequence, defaulting to Confirm", async () => {
    open({ confirmLabel: undefined });
    expect(await screen.findByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
});

describe("ConfirmDialog loading", () => {
  it("shows a spinner, reports aria-busy and stays ENABLED", async () => {
    open({ loading: true });
    const confirm = await screen.findByRole("button", { name: /delete skill/i });

    expect(confirm).toHaveAttribute("aria-busy", "true");
    // interaction-guidelines (Forms): a submit is never pre-disabled.
    expect(confirm).not.toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument();
  });

  it("ignores repeat activations while the request is in flight", async () => {
    const user = userEvent.setup();
    const { onConfirm } = open({ loading: true });

    await user.click(await screen.findByRole("button", { name: /delete skill/i }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("never disables the safe action", async () => {
    open({ loading: true });
    expect(await screen.findByRole("button", { name: "Cancel" })).not.toBeDisabled();
  });
});
