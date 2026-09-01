import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeyboardShortcuts, type ShortcutGroup } from "./keyboard-shortcuts";

const groups: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    items: [
      { action: "Open command palette", keys: ["⌘", "K"] },
      { action: "Go to file", keys: ["⌘", "P"] },
    ],
  },
  {
    id: "general",
    label: "General",
    items: [
      { action: "Close tab", keys: ["⌘", "W"] },
      { action: "Save", keys: ["⌘", "S"] },
      { action: "New window", keys: ["⌘", "⇧", "N"] },
    ],
  },
];

describe("KeyboardShortcuts", () => {
  it("renders every group with a count derived from items.length", () => {
    render(<KeyboardShortcuts groups={groups} searchable={false} />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    // "Navigation" has 2 items, "General" has 3 — neither count was passed in.
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("a query matching only one group hides the others, and derives the visible group's count from the matches", () => {
    render(<KeyboardShortcuts groups={groups} query="close" />);

    // Only "General" has an item matching "close" — "Navigation" is hidden entirely,
    // not rendered empty.
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();

    // The visible group's displayed count is the number of MATCHING items (1),
    // never its total item count (3) — this is the "count is derived" lock.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.getByText("Close tab")).toBeInTheDocument();
  });

  it("matches on key tokens as well as action text", () => {
    render(<KeyboardShortcuts groups={groups} query="⇧" />);
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
    expect(screen.getByText("New window")).toBeInTheDocument();
  });

  it("renders a designed empty message, not a blank area, when nothing matches", () => {
    render(<KeyboardShortcuts groups={groups} query="does-not-exist" />);
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.getByText("No shortcuts found")).toBeInTheDocument();
  });

  it("supports an uncontrolled query without a query prop", () => {
    render(<KeyboardShortcuts groups={groups} />);
    expect(screen.getByLabelText("Search shortcuts")).toHaveValue("");
  });

  it("renders no search field when searchable is false", () => {
    render(<KeyboardShortcuts groups={groups} searchable={false} />);
    expect(screen.queryByLabelText("Search shortcuts")).not.toBeInTheDocument();
  });
});
