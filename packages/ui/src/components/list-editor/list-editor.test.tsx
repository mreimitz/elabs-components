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
