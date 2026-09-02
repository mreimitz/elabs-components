/**
 * terminal-todo-list.test.tsx — the load-bearing accessibility lock for
 * `TerminalTodoList` (#117).
 *
 * The whole point of this component is that its three states survive
 * WITHOUT colour: a glyph shape plus an announced word. Asserting that two
 * class strings differ passes on colour-only code and proves nothing — so
 * every assertion below is either the announced WORD itself, or the
 * greyscale-visible signal (glyph character / strikethrough / bold),
 * never a bare class-string comparison.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TerminalTodoList,
  terminalTodoItemVariants,
  type TerminalTodoItem,
} from "./terminal-todo-list";

const ITEMS: TerminalTodoItem[] = [
  { id: "a", text: "Write the todo list", status: "done" },
  { id: "b", text: "Wire it into the surface", status: "active" },
  { id: "c", text: "Ship the changelog entry", status: "pending" },
];

describe("TerminalTodoList", () => {
  it("renders a real ordered list, not a stack of divs", () => {
    const { container } = render(<TerminalTodoList items={ITEMS} />);
    expect(container.querySelector("ol[data-slot='terminal-todo-list']")).not.toBeNull();
    expect(container.querySelectorAll("li[data-slot='terminal-todo-list-item']")).toHaveLength(3);
  });

  it("renders every item's text", () => {
    render(<TerminalTodoList items={ITEMS} />);
    expect(screen.getByText("Write the todo list")).toBeInTheDocument();
    expect(screen.getByText("Wire it into the surface")).toBeInTheDocument();
    expect(screen.getByText("Ship the changelog entry")).toBeInTheDocument();
  });

  // The load-bearing assertion: the announced WORD per state, not a class
  // difference. Break `terminal.todoList.*` in messages.ts and this fails.
  it("announces each state as a distinct word, not just a glyph", () => {
    render(<TerminalTodoList items={ITEMS} />);

    const [done, active, pending] = screen.getAllByRole("listitem");

    expect(within(done!).getByText("(completed)")).toBeInTheDocument();
    expect(within(active!).getByText("(in progress)")).toBeInTheDocument();
    expect(within(pending!).getByText("(pending)")).toBeInTheDocument();
  });

  it("hides the state glyph from assistive tech so the word is announced once, not twice", () => {
    const { container } = render(<TerminalTodoList items={[ITEMS[0]!]} />);
    const gutter = container.querySelector("[data-slot='terminal-row-gutter']");

    expect(gutter?.querySelector("[aria-hidden='true']")).toHaveTextContent("✔");
    expect(gutter?.textContent).toContain("(completed)");
  });

  it("renders the upstream glyph per state", () => {
    const { container } = render(<TerminalTodoList items={ITEMS} />);
    const glyphs = [
      ...container.querySelectorAll("[data-slot='terminal-row-gutter'] [aria-hidden='true']"),
    ].map((node) => node.textContent);

    expect(glyphs).toEqual(["✔", "◼", "◻"]);
  });

  it("keeps the state distinguishable in greyscale — not colour alone (WCAG 1.4.1)", () => {
    // Independent of the announced word: a sighted user with no colour
    // perception must still tell the three states apart from shape alone.
    // `done` and `active` each carry a distinct, colour-independent CSS
    // property (strikethrough / bold); `pending` deliberately carries none.
    expect(terminalTodoItemVariants({ status: "done" })).toContain("line-through");
    expect(terminalTodoItemVariants({ status: "active" })).toContain("font-semibold");
    expect(terminalTodoItemVariants({ status: "active" })).not.toContain("line-through");
    expect(terminalTodoItemVariants({ status: "pending" })).not.toContain("line-through");
    expect(terminalTodoItemVariants({ status: "pending" })).not.toContain("font-semibold");
  });

  it("keeps the meaning even when the surrounding variant suppresses the glyph (rail)", () => {
    render(<TerminalTodoList items={[ITEMS[1]!]} variant="rail" />);

    // `rail` suppresses the visual glyph but never the announced word.
    expect(screen.queryByText("◼")).not.toBeInTheDocument();
    expect(screen.getByText("(in progress)")).toBeInTheDocument();
  });

  it("lets a row-level override win over the ambient TerminalSurface variant", () => {
    render(<TerminalTodoList items={[ITEMS[0]!]} variant="boxed" />);
    const row = screen.getByText("Write the todo list").closest("[data-slot='terminal-row']");

    expect(row).toHaveAttribute("data-variant", "boxed");
  });

  it("falls back to the item's index when no id is given", () => {
    const { container } = render(
      <TerminalTodoList
        items={[
          { text: "one", status: "pending" },
          { text: "two", status: "pending" },
        ]}
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });
});
