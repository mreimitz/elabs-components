import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Toolbar, ToolbarButton, ToolbarSeparator } from "./toolbar";

function Fixture() {
  return (
    <>
      <button type="button">before</button>
      <Toolbar aria-label="Document">
        <ToolbarButton>First</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton>Second</ToolbarButton>
        <ToolbarButton>Third</ToolbarButton>
      </Toolbar>
      <button type="button">after</button>
    </>
  );
}

describe("Toolbar", () => {
  it("is a named toolbar", () => {
    render(<Fixture />);
    expect(screen.getByRole("toolbar", { name: "Document" })).toBeInTheDocument();
  });

  it("is ONE tab stop — the promise the role makes", async () => {
    render(<Fixture />);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "before" })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    // Not "Second": the whole row is a single stop, so Tab leaves it.
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("moves between controls with the arrow keys", async () => {
    render(<Fixture />);

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("returns focus to the control the user left, not to the first one", async () => {
    render(<Fixture />);

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Third" })).toHaveFocus();

    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Third" })).toHaveFocus();
  });

  it("keeps the separator out of the accessibility tree's control list", () => {
    render(<Fixture />);
    // Radix renders it as a real separator, not a focusable child.
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});
