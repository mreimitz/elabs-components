import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListEditor } from "./list-editor";

describe("ListEditor", () => {
  it("renders one input per row", () => {
    render(<ListEditor defaultValue={["a", "b", "c"]} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });

  it("renders a real empty state for an empty list", () => {
    render(<ListEditor defaultValue={[]} />);
    expect(screen.getByText("No items yet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("adds a row via the Add item button", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor defaultValue={["a"]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(onValueChange).toHaveBeenCalledWith(["a", ""]);
  });

  it("edits a row's value", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor defaultValue={["a", "b"]} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Item 1" });
    await userEvent.type(input, "x");
    expect(onValueChange).toHaveBeenLastCalledWith(["ax", "b"]);
  });

  it("removes a row via the remove button", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor defaultValue={["a", "b"]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onValueChange).toHaveBeenCalledWith(["b"]);
  });

  it("moves a row up via the move-up button (keyboard-operable, real <button>)", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor defaultValue={["a", "b", "c"]} onValueChange={onValueChange} />);
    const moveUp = screen.getByRole("button", { name: "Move item 2 up" });
    expect(moveUp.tagName).toBe("BUTTON");
    await userEvent.click(moveUp);
    expect(onValueChange).toHaveBeenCalledWith(["b", "a", "c"]);
  });

  it("moves a row down via the move-down button", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor defaultValue={["a", "b", "c"]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Move item 1 down" }));
    expect(onValueChange).toHaveBeenCalledWith(["b", "a", "c"]);
  });

  it("disables move-up on the first row and move-down on the last row", () => {
    render(<ListEditor defaultValue={["a", "b"]} />);
    expect(screen.getByRole("button", { name: "Move item 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move item 2 down" })).toBeDisabled();
  });

  it("move-up/move-down buttons are reachable via Tab and activate via Enter", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor defaultValue={["a", "b"]} onValueChange={onValueChange} />);
    const moveDown = screen.getByRole("button", { name: "Move item 1 down" });
    moveDown.focus();
    expect(moveDown).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(["b", "a"]);
  });

  it("keeps keyboard focus on the moved row's own move-down button after a non-boundary move", async () => {
    render(<ListEditor defaultValue={["a", "b", "c", "d"]} />);
    const moveDown = screen.getByRole("button", { name: "Move item 2 down" });
    moveDown.focus();
    await userEvent.keyboard("{Enter}");
    // Row "b" moved from position 2 to position 3 — index-keyed rows would
    // leave focus sitting on whatever the DOM slot at the old position now
    // renders (the row that got swapped INTO it), not on the row the user
    // actually moved.
    expect(screen.getByRole("button", { name: "Move item 3 down" })).toHaveFocus();
  });

  it("redirects focus to the complementary button when a move disables the one just pressed", async () => {
    render(<ListEditor defaultValue={["a", "b", "c"]} />);
    const moveUp = screen.getByRole("button", { name: "Move item 2 up" });
    moveUp.focus();
    await userEvent.keyboard("{Enter}");
    // "b" is now row 1 (the top) — its own "move up" is now disabled, and a
    // browser blurs a focused element the moment it goes disabled. Focus
    // must land on that same row's still-enabled "move down" button instead
    // of falling through to <body>.
    expect(screen.getByRole("button", { name: "Move item 1 down" })).toHaveFocus();
  });

  it("hides reorder buttons when reorderable=false", () => {
    render(<ListEditor defaultValue={["a", "b"]} reorderable={false} />);
    // Anchored at the start — "Remove item 1" contains the substring "move
    // item" (as in "Re-move item"), so an unanchored /move item/i overmatches.
    expect(screen.queryByRole("button", { name: /^move item/i })).not.toBeInTheDocument();
  });

  it("enforces max row count", () => {
    render(<ListEditor defaultValue={["a", "b"]} max={2} />);
    expect(screen.getByRole("button", { name: /add item/i })).toBeDisabled();
  });

  it("supports the controlled mode via value/onValueChange", async () => {
    const onValueChange = vi.fn();
    render(<ListEditor value={["a"]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(onValueChange).toHaveBeenCalledWith(["a", ""]);
  });

  it("is disabled when disabled prop is set", () => {
    render(<ListEditor defaultValue={["a"]} disabled />);
    expect(screen.getByRole("textbox", { name: "Item 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /add item/i })).toBeDisabled();
  });
});
