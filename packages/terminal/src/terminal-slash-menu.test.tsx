/**
 * terminal-slash-menu.test.tsx — smoke + accessibility-lock tests for the
 * console composer's `/`-command palette (#117, work unit T12).
 *
 * The load-bearing assertion in this file is that the active row is
 * recoverable WITHOUT colour — the reserved-width `❯` marker actually renders
 * on the active row and nowhere else — and that the textarea carries the
 * combobox ARIA quintet for assistive tech. Asserting only that
 * `aria-selected`/a class string differs would pass on colour-only code and
 * prove nothing (`.claude/rules/accessibility.md` § "Colour is never the only
 * channel").
 */
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type SlashCommand } from "@elabs-ai/components-ui";
import { TerminalSlashMenu } from "./terminal-slash-menu";

// jsdom does not implement `Element.prototype.scrollIntoView`; nothing here
// calls it directly, but Radix's `Popover` positioning machinery reads layout
// APIs jsdom stubs poorly. Mirrors `prompt-input-slash.test.tsx`'s own guard.
const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const COMMANDS: SlashCommand[] = [
  { name: "help", description: "Show help" },
  { name: "history", description: "Show history" },
  { name: "hide", description: "Hide the panel" },
  { name: "home", description: "Go home" },
  { name: "harvest", description: "Harvest data" },
];

function Harness({
  commands = COMMANDS,
  onSelectCommand,
}: {
  commands?: SlashCommand[];
  onSelectCommand?: (command: SlashCommand) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <TerminalSlashMenu
      commands={commands}
      value={value}
      onValueChange={(next) => setValue(next.text)}
      onSelectCommand={onSelectCommand}
    />
  );
}

const field = () =>
  screen.getByPlaceholderText("Type your next instruction…") as HTMLTextAreaElement;

describe("trigger — line-start boundary", () => {
  it("opens the palette when '/' is typed at the start of an empty line", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("does not open when '/' is typed mid-word", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "cd /usr");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens again on a new line after a newline", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "hello{Shift>}{Enter}{/Shift}/h");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

describe("filtering", () => {
  it("matches case-insensitively by prefix on the command name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // "history" and "hide" both start with "hi" — "hid" narrows to "hide" only.
    await user.type(field(), "/HID");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("hide");
  });

  it("shows a real empty state, as a sibling of the listbox, when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/zzzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    // Still open (a real empty state, never a collapsed popover).
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const empty = document.querySelector('[data-slot="terminal-slash-menu-empty"]');
    expect(empty).toHaveTextContent("No results.");
    // The empty state is a SIBLING of the listbox, never nested inside it —
    // `role="listbox"` may only contain `option`/`group` children.
    expect(screen.getByRole("listbox")).not.toContainElement(empty as HTMLElement);
  });
});

describe("active-index clamp (the narrowing-list bug)", () => {
  it("clamps the active option into range when typing narrows the list from 5 to 1", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    expect(screen.getAllByRole("option")).toHaveLength(5);

    // Move the highlight to the LAST of the 5 matches (index 4, "harvest").
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    const beforeActive = screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("aria-selected") === "true");
    expect(beforeActive).toHaveTextContent("harvest");

    // Narrow the list to the single command that still matches "ha".
    await user.type(field(), "a");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    // The textarea's aria-activedescendant must point at THAT option, never a
    // stale id from the shrunk-away list.
    expect(field()).toHaveAttribute("aria-activedescendant", options[0]!.id);
  });

  it("clamps when the `commands` prop itself shrinks, independent of the query", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness commands={COMMANDS} />);
    await user.type(field(), "/h");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(
      screen.getAllByRole("option").find((o) => o.getAttribute("aria-selected") === "true"),
    ).toHaveTextContent("harvest");

    const harvest = COMMANDS.find((c) => c.name === "harvest");
    if (!harvest) throw new Error("fixture missing 'harvest'");
    rerender(<Harness commands={[harvest]} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(field()).toHaveAttribute("aria-activedescendant", options[0]!.id);
  });
});

describe("keyboard navigation", () => {
  it("wraps ArrowDown/ArrowUp at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS.slice(0, 2)} />);
    await user.type(field(), "/h");
    const active = () =>
      screen.getAllByRole("option").find((o) => o.getAttribute("aria-selected") === "true");
    expect(active()).toHaveTextContent("help");

    await user.keyboard("{ArrowUp}"); // wraps to the last item
    expect(active()).toHaveTextContent("history");

    await user.keyboard("{ArrowDown}"); // wraps back to the first
    expect(active()).toHaveTextContent("help");
  });

  it("selects the active command on Enter, splices it into the field, and closes the palette", async () => {
    const onSelectCommand = vi.fn();
    const user = userEvent.setup();
    render(<Harness commands={[{ name: "help" }]} onSelectCommand={onSelectCommand} />);
    await user.type(field(), "/h");
    await user.keyboard("{Enter}");

    expect(onSelectCommand).toHaveBeenCalledWith({ name: "help" });
    expect(field()).toHaveValue("/help ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // The caret never leaves the field — Enter never blurs the textarea.
    expect(field()).toHaveFocus();
  });

  it("does not submit the composer on the Enter that selects a command", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    function Submitting() {
      const [value, setValue] = useState("");
      return (
        <TerminalSlashMenu
          commands={[{ name: "help" }]}
          value={value}
          onValueChange={(next) => setValue(next.text)}
          onSubmit={onSubmit}
        />
      );
    }
    render(<Submitting />);
    await user.type(field(), "/h");
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes on Escape without selecting, and keeps focus on the textarea", async () => {
    const onSelectCommand = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelectCommand={onSelectCommand} />);
    await user.type(field(), "/h");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelectCommand).not.toHaveBeenCalled();
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("/h");
  });
});

describe("accessibility", () => {
  it("wires the combobox ARIA quintet onto the real textarea node", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Always present, even closed — this is a combobox field.
    expect(field()).toHaveAttribute("aria-autocomplete", "list");
    expect(field()).toHaveAttribute("aria-haspopup", "listbox");
    expect(field()).not.toHaveAttribute("aria-controls");
    expect(field()).not.toHaveAttribute("aria-activedescendant");

    await user.type(field(), "/h");
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");
    const active = options.find((o) => o.getAttribute("aria-selected") === "true");
    expect(active).toBeDefined();
    expect(field()).toHaveAttribute("aria-controls", listbox.id);
    expect(field()).toHaveAttribute("aria-activedescendant", active!.id);
  });

  it("drops aria-activedescendant and aria-controls once the palette closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    await user.keyboard("{Escape}");
    expect(field()).not.toHaveAttribute("aria-activedescendant");
    expect(field()).not.toHaveAttribute("aria-controls");
  });

  // The load-bearing accessibility lock for this component: a sighted user in
  // greyscale (or with the theme's colour stripped entirely) must still be
  // able to tell the active row apart. The `❯` marker is the second,
  // non-colour channel WCAG 1.4.1 requires alongside `aria-selected` and the
  // background tint.
  it("marks the active row with a reserved-width glyph, present on exactly one row", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(5);
    const withMarker = options.filter((o) => o.textContent?.includes("❯"));
    expect(withMarker).toHaveLength(1);
    expect(withMarker[0]).toHaveAttribute("aria-selected", "true");
    expect(withMarker[0]).toHaveTextContent("help");

    await user.keyboard("{ArrowDown}");
    const afterMove = screen.getAllByRole("option").filter((o) => o.textContent?.includes("❯"));
    expect(afterMove).toHaveLength(1);
    expect(afterMove[0]).toHaveTextContent("history");
  });
});

describe("composition", () => {
  it("forwards the root ref and keeps the base TerminalComposer root slot", () => {
    const ref = vi.fn();
    render(<TerminalSlashMenu ref={ref} commands={COMMANDS} value="" onValueChange={vi.fn()} />);
    expect(ref).toHaveBeenCalled();
    // A named preset that wraps a base component keeps the BASE root slot
    // (`.claude/rules/component-api.md` § Stable selectors) — this is a skin
    // around `TerminalComposer`, not a new root shape.
    expect(document.querySelector('[data-slot="terminal-composer"]')).toBeInTheDocument();
  });

  it("passes non-slash-menu props through to the underlying TerminalComposer", () => {
    render(
      <TerminalSlashMenu
        commands={COMMANDS}
        value=""
        onValueChange={vi.fn()}
        busy
        placeholder="Ask the console…"
        aria-label="Console input"
      />,
    );
    // `busy` and `placeholder` reach the textarea/well;`aria-label` (an
    // `HTMLAttributes<HTMLDivElement>` prop on `TerminalComposerProps`) labels
    // the composer's own root surface, not the field — this wrapper does not
    // reinterpret it.
    //
    // `busy` is observed through `data-busy`, NOT through a Stop button. This
    // render passes `busy` with no `onStop`, which is ADR 0022 case 4 (#128):
    // something else owns cancellation, so the composer's primary action stays
    // Send. Asserting a Stop here is what this test used to do, and it was
    // asserting the dead-button defect #128 removed — a control that called
    // `onStop?.()` on `undefined`. The absent-Stop assertion below is now the
    // lock, and it also proves the wrapper does not reinterpret `busy`.
    expect(document.querySelector('[data-slot="terminal-composer"]')).toHaveAttribute(
      "data-busy",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask the console…")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="terminal-composer"]')).toHaveAttribute(
      "aria-label",
      "Console input",
    );
  });
});
