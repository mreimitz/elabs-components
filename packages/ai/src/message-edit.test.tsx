import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MessageEdit,
  MessageEditContent,
  MessageEditProvider,
  MessageEditTrigger,
} from "./message-edit";

describe("MessageEdit", () => {
  it("shows the display content and an edit trigger", () => {
    render(<MessageEdit value="Original text">Original text</MessageEdit>);
    expect(screen.getByText("Original text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it("enters edit mode seeded with the original text", async () => {
    const user = userEvent.setup();
    render(<MessageEdit value="Original text">Original text</MessageEdit>);
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByLabelText("Edit message")).toHaveValue("Original text");
  });

  it("submits the new text and leaves edit mode", async () => {
    const user = userEvent.setup();
    const onEditSubmit = vi.fn();
    render(
      <MessageEdit value="Original" onEditSubmit={onEditSubmit}>
        Original
      </MessageEdit>,
    );
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const textarea = screen.getByLabelText("Edit message");
    await user.clear(textarea);
    await user.type(textarea, "Updated");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onEditSubmit).toHaveBeenCalledWith("Updated");
    expect(screen.queryByLabelText("Edit message")).not.toBeInTheDocument();
  });

  it("submits on Enter (Shift+Enter inserts a newline)", async () => {
    const user = userEvent.setup();
    const onEditSubmit = vi.fn();
    render(
      <MessageEdit value="Hi" onEditSubmit={onEditSubmit}>
        Hi
      </MessageEdit>,
    );
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const textarea = screen.getByLabelText("Edit message");
    await user.clear(textarea);
    await user.type(textarea, "Done{Enter}");
    expect(onEditSubmit).toHaveBeenCalledWith("Done");
  });

  it("cancels on Escape without calling onEditSubmit and restores the original", async () => {
    const user = userEvent.setup();
    const onEditSubmit = vi.fn();
    render(
      <MessageEdit value="Original" onEditSubmit={onEditSubmit}>
        Original
      </MessageEdit>,
    );
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const textarea = screen.getByLabelText("Edit message");
    await user.clear(textarea);
    await user.type(textarea, "changed{Escape}");
    expect(onEditSubmit).not.toHaveBeenCalled();
    // Back to display; re-entering shows the original again (draft was discarded).
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByLabelText("Edit message")).toHaveValue("Original");
  });

  it("restores focus to the trigger after cancel", async () => {
    const user = userEvent.setup();
    render(<MessageEdit value="Original">Original</MessageEdit>);
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /Edit/ })).toHaveFocus();
  });

  it("supports controlled editing via the provider parts", async () => {
    const user = userEvent.setup();
    const onEditingChange = vi.fn();
    render(
      <MessageEditProvider value="Original" editing onEditingChange={onEditingChange}>
        <MessageEditContent>Original</MessageEditContent>
        <MessageEditTrigger />
      </MessageEditProvider>,
    );
    // Controlled `editing` → editor is shown; the trigger is hidden while editing.
    expect(screen.getByLabelText("Edit message")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });

  it("does NOT trap Tab in the inline editor (non-modal — focus flows out)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MessageEdit value="Original" defaultEditing>
          Original
        </MessageEdit>
        <button type="button">after</button>
      </>,
    );
    // Move to the Save button, then Tab once more — a trap would send focus back
    // to the textarea; instead it must reach the element after the editor.
    screen.getByRole("button", { name: "Save" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });
});
