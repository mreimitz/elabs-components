import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readSelectionWithin, SelectionToolbar } from "./selection-toolbar";

function mockSelection(node: Node | null, text: string, collapsed = false) {
  const range = {
    getBoundingClientRect: () => ({
      top: 100,
      left: 50,
      width: text ? 80 : 0,
      height: text ? 18 : 0,
      right: 130,
      bottom: 118,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }),
  };
  return {
    isCollapsed: collapsed,
    rangeCount: collapsed ? 0 : 1,
    anchorNode: node,
    focusNode: node,
    toString: () => text,
    getRangeAt: () => range,
  } as unknown as Selection;
}

afterEach(() => vi.restoreAllMocks());

describe("readSelectionWithin", () => {
  it("returns null for a collapsed selection", () => {
    const container = document.createElement("div");
    vi.spyOn(window, "getSelection").mockReturnValue(mockSelection(container, "", true));
    expect(readSelectionWithin(container)).toBeNull();
  });

  it("returns a snapshot for a non-empty selection inside the container", () => {
    const container = document.createElement("div");
    const child = document.createElement("p");
    container.appendChild(child);
    vi.spyOn(window, "getSelection").mockReturnValue(mockSelection(child, "hello"));
    const snap = readSelectionWithin(container);
    expect(snap?.text).toBe("hello");
    expect(snap?.rect.width).toBe(80);
  });

  it("returns null when the selection is outside the container", () => {
    const container = document.createElement("div");
    const outside = document.createElement("p");
    vi.spyOn(window, "getSelection").mockReturnValue(mockSelection(outside, "hello"));
    expect(readSelectionWithin(container)).toBeNull();
  });
});

describe("SelectionToolbar", () => {
  it("shows a Quote toolbar over a selection and calls onQuote", async () => {
    const user = userEvent.setup();
    const onQuote = vi.fn();
    render(
      <SelectionToolbar data-testid="region" onQuote={onQuote}>
        <p>Quote me please, this is the transcript.</p>
      </SelectionToolbar>,
    );
    const region = screen.getByTestId("region");
    const para = screen.getByText(/Quote me please/);
    vi.spyOn(window, "getSelection").mockReturnValue(mockSelection(para, "Quote me please"));

    fireEvent.pointerUp(region);

    const quote = await screen.findByRole("button", { name: /Quote/ });
    await user.click(quote);
    expect(onQuote).toHaveBeenCalledWith("Quote me please");
  });

  it("does not open when disabled", () => {
    render(
      <SelectionToolbar data-testid="region" disabled onQuote={vi.fn()}>
        <p>Some text</p>
      </SelectionToolbar>,
    );
    const region = screen.getByTestId("region");
    const para = screen.getByText("Some text");
    vi.spyOn(window, "getSelection").mockReturnValue(mockSelection(para, "Some text"));
    fireEvent.pointerUp(region);
    expect(screen.queryByRole("button", { name: /Quote/ })).not.toBeInTheDocument();
  });
});
