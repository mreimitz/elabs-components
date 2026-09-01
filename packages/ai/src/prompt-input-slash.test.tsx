import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type SlashCommand } from "@elabs-ai/components-ui";
import { PromptInput } from "./prompt-input";
import { PromptInputSlash, PromptInputSlashTextarea } from "./prompt-input-slash";

// jsdom does not implement `Element.prototype.scrollIntoView`, and `cmdk`
// calls it unconditionally (not feature-detected — it's a third-party
// dependency, not brand-ui code) whenever the highlighted item changes.
// `packages/ui/vitest.setup.ts` deliberately does NOT stub this globally, so —
// mirroring `command.test.tsx`'s local stub for the same jsdom gap — every
// test in this file gets a local no-op stub instead.
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

beforeEach(() => {
  originalScrollIntoView = Element.prototype.scrollIntoView;
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
  onSelect,
  onValueChangeSpy,
}: {
  commands?: SlashCommand[];
  onSelect?: (command: SlashCommand) => void;
  onValueChangeSpy?: (next: { text: string; caret: number }) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  return (
    <PromptInput onSubmit={vi.fn()}>
      <PromptInputSlash
        commands={commands}
        value={text}
        textareaRef={textareaRef}
        onValueChange={(next) => {
          setText(next.text);
          onValueChangeSpy?.(next);
        }}
        onSelect={onSelect}
      >
        <PromptInputSlashTextarea
          aria-label="Message"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </PromptInputSlash>
    </PromptInput>
  );
}

const field = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;

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

  it("shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/zzzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    // The locale key isn't registered in this test environment, so `t()`
    // falls back to the raw key — assert the empty slot renders at all
    // rather than coupling to English copy this component doesn't own.
    // Assert the real English default, not the data-slot: the key now ships in
    // `packages/ui/src/components/locale-provider/messages.ts`, so this proves
    // the central catalogue carries it rather than that a node with the right
    // attribute exists.
    expect(document.querySelector('[data-slot="prompt-input-slash-empty"]')).toHaveTextContent(
      "No matching commands.",
    );
  });
});

describe("active-index clamp (the narrowing-list bug)", () => {
  it("clamps the active option into range when typing narrows the list from 5 to 1", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    expect(screen.getAllByRole("option")).toHaveLength(5);

    // Move the highlight to the LAST of the 5 matches (index 4).
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    const beforeActive = screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("aria-selected") === "true");
    expect(beforeActive).toHaveTextContent("harvest");

    // Narrow the list to the single command that still matches.
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
    // Re-render with a shrunk `commands` prop directly (rather than an
    // outside click) — a real Popover legitimately dismisses on an outside
    // pointerdown, which would test that behavior instead of the clamp.
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

  it("selects the active command on Enter and inserts it into the field", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness commands={[{ name: "help" }]} onSelect={onSelect} />);
    await user.type(field(), "/h");
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith({ name: "help" });
    expect(field()).toHaveValue("/help ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not submit the form on the Enter that selects a command", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    function Submitting() {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
      const [text, setText] = useState("");
      return (
        <PromptInput onSubmit={onSubmit}>
          <PromptInputSlash
            commands={[{ name: "help" }]}
            value={text}
            textareaRef={textareaRef}
            onValueChange={(next) => setText(next.text)}
          >
            <PromptInputSlashTextarea
              aria-label="Message"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </PromptInputSlash>
        </PromptInput>
      );
    }
    render(<Submitting />);
    await user.type(field(), "/h");
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to the textarea", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });
});

describe("accessibility", () => {
  it("renders a listbox of options and wires aria-activedescendant on the textarea", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);

    const active = options.find((o) => o.getAttribute("aria-selected") === "true");
    expect(active).toBeDefined();
    expect(field()).toHaveAttribute("aria-activedescendant", active!.id);
    expect(field()).toHaveAttribute("aria-controls", listbox.id);
  });

  it("drops aria-activedescendant and aria-controls once the palette closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "/h");
    await user.keyboard("{Escape}");
    expect(field()).not.toHaveAttribute("aria-activedescendant");
    expect(field()).not.toHaveAttribute("aria-controls");
  });
});
