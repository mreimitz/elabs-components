import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MentionInput,
  MentionInputContent,
  MentionInputEmpty,
  MentionInputItem,
  MentionInputList,
  MentionInputTextarea,
  type MentionOption,
  type MentionValue,
} from "./mention-input";

const ROSTER: MentionOption[] = [
  { id: "u1", label: "Ada Lovelace", keywords: ["math"] },
  { id: "u2", label: "Grace Hopper" },
  { id: "u3", label: "Alan Turing", disabled: true },
  { id: "u4", label: "Katherine Johnson" },
];

/** The full compound arrangement, exactly as a consumer composes it. */
function Harness({
  options = ROSTER,
  ...props
}: Partial<React.ComponentProps<typeof MentionInput>> & { options?: MentionOption[] }) {
  return (
    <MentionInput options={options} {...props}>
      <MentionInputTextarea aria-label="Comment" />
      <MentionInputContent>
        <MentionInputList>
          {(option) => (
            <MentionInputItem key={option.id} option={option}>
              {option.label}
            </MentionInputItem>
          )}
        </MentionInputList>
        <MentionInputEmpty />
      </MentionInputContent>
    </MentionInput>
  );
}

const field = () => screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

/** Put the caret at `index` and let React observe the selection change. */
async function setCaret(el: HTMLTextAreaElement, index: number) {
  const user = userEvent.setup();
  await user.click(el);
  el.setSelectionRange(index, index);
  // `setSelectionRange` fires no event; `select` is what React listens for.
  el.dispatchEvent(new Event("select", { bubbles: true }));
}

// ---------------------------------------------------------------------------
// T3 — trigger boundary
// ---------------------------------------------------------------------------

describe("T3 trigger boundary", () => {
  it("opens the popup for a trigger at index 0", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@");
    expect(field()).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("opens the popup for a trigger after a space", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "hello @");
    expect(field()).toHaveAttribute("data-state", "open");
  });

  it("does NOT open for a trigger mid-word (an email address)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "ada@");
    expect(field()).toHaveAttribute("data-state", "closed");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes again once the query runs into whitespace", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@ada");
    expect(field()).toHaveAttribute("data-state", "open");
    await user.type(field(), " ");
    expect(field()).toHaveAttribute("data-state", "closed");
  });

  it("filters the roster as the query grows", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@grace");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Grace Hopper");
  });

  it("shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@zzzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T4 — chip atomicity (the headline acceptance criterion)
// ---------------------------------------------------------------------------

describe("T4 chip atomicity", () => {
  it("Backspace with the caret right after a mention removes the WHOLE token", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    await user.type(field(), "@ada");
    await user.keyboard("{Enter}");
    expect(field().value).toBe("@Ada Lovelace ");

    // Caret currently sits after the trailing space; step back onto the token end.
    await user.keyboard("{Backspace}"); // eats the trailing space
    expect(field().value).toBe("@Ada Lovelace");

    await user.keyboard("{Backspace}"); // must eat the entire token, not one char
    expect(field().value).toBe("");
    expect(onValueChange).toHaveBeenLastCalledWith({ text: "", mentions: [] });
  });

  it("Delete with the caret right before a mention removes the WHOLE token", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@ada");
    await user.keyboard("{Enter}");
    expect(field().value).toBe("@Ada Lovelace ");

    await setCaret(field(), 0);
    await user.keyboard("{Delete}");
    expect(field().value).toBe(" ");
  });

  it("ArrowLeft from the end of a mention lands on its START boundary, never inside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@ada");
    await user.keyboard("{Enter}");
    // "@Ada Lovelace " — token is [0, 13), caret is at 14.
    await setCaret(field(), 13);
    await user.keyboard("{ArrowLeft}");
    expect(field().selectionStart).toBe(0);
  });

  it("ArrowRight from the start of a mention lands on its END boundary", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@ada");
    await user.keyboard("{Enter}");
    await setCaret(field(), 0);
    await user.keyboard("{ArrowRight}");
    expect(field().selectionStart).toBe(13);
  });

  it("editing INSIDE a mention drops it from the value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    await user.type(field(), "@ada");
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith({
      text: "@Ada Lovelace ",
      mentions: [{ id: "u1", label: "Ada Lovelace", start: 0 }],
    });

    // Type a character into the middle of the label.
    await setCaret(field(), 6);
    await user.keyboard("x");
    expect(onValueChange).toHaveBeenLastCalledWith({ text: "@Ada Lxovelace ", mentions: [] });
  });
});

// ---------------------------------------------------------------------------
// T5 — keyboard model
// ---------------------------------------------------------------------------

describe("T5 keyboard", () => {
  it("ArrowDown / ArrowUp move aria-activedescendant, wrapping and skipping disabled", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@");

    const ids = screen.getAllByRole("option").map((o) => o.id);
    expect(ids).toHaveLength(4);
    expect(field()).toHaveAttribute("aria-activedescendant", ids[0]);

    await user.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-activedescendant", ids[1]);

    // ids[2] is `disabled` — ArrowDown must skip straight past it.
    await user.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-activedescendant", ids[3]);

    // …and wrap back to the first.
    await user.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-activedescendant", ids[0]);

    await user.keyboard("{ArrowUp}");
    expect(field()).toHaveAttribute("aria-activedescendant", ids[3]);
  });

  it("Home / End jump to the first / last enabled option", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@");
    const ids = screen.getAllByRole("option").map((o) => o.id);

    await user.keyboard("{End}");
    expect(field()).toHaveAttribute("aria-activedescendant", ids[3]);
    await user.keyboard("{Home}");
    expect(field()).toHaveAttribute("aria-activedescendant", ids[0]);
  });

  it("Enter inserts the highlighted option", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(field().value).toBe("@Grace Hopper ");
  });

  it("Tab inserts the highlighted option", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@ada");
    await user.keyboard("{Tab}");
    expect(field().value).toBe("@Ada Lovelace ");
  });

  it("a disabled option cannot be inserted, and Enter falls through to the host", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@alan");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    // The only match is disabled, so nothing is highlighted…
    expect(field()).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{Enter}");
    // …the option is not inserted, AND the key is NOT intercepted — it does
    // what it would have done anyway (a newline here; a submit in a composer).
    // That fall-through is what lets `PromptInput` keep Enter when the roster
    // has nothing to offer.
    expect(field().value).not.toContain("Alan Turing");
    expect(field().value).toBe("@alan\n");
  });

  it("Escape closes the popup WITHOUT clearing the textarea", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@ada");
    expect(field()).toHaveAttribute("data-state", "open");

    await user.keyboard("{Escape}");
    expect(field()).toHaveAttribute("data-state", "closed");
    expect(field().value).toBe("@ada");
    expect(field()).toHaveFocus();
  });

  it("leaves Enter alone when the popup is closed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "hello{Enter}world");
    expect(field().value).toBe("hello\nworld");
  });
});

// ---------------------------------------------------------------------------
// T6 — the ARIA invariant (the screen-reader acceptance criterion)
// ---------------------------------------------------------------------------

describe("T6 ARIA invariant", () => {
  /**
   * `aria-activedescendant` must always name the element that is actually
   * carrying `aria-selected="true"` in the SAME commit — the generalised
   * lesson from cmdk's `selectedItemId` hole (see command.tsx).
   */
  function expectActiveDescendantInvariant() {
    const el = field();
    const active = el.getAttribute("aria-activedescendant");
    const selected = screen
      .queryAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(active === null ? 0 : 1);
    if (active !== null) {
      expect(selected[0]!.id).toBe(active);
      expect(document.getElementById(active)).not.toBeNull();
    }
  }

  it("keeps the field a spec-valid textbox and wires the autocomplete properties", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const el = field();
    expect(el.tagName).toBe("TEXTAREA");

    // `<textarea>` permits NO role override (ARIA in HTML), and `aria-expanded`
    // is not in `textbox`'s supported set — axe flags the first as
    // `aria-allowed-role` and the second as `aria-allowed-attr` (critical).
    // Everything the field DOES carry is in `textbox`'s supported set.
    expect(el).not.toHaveAttribute("role");
    expect(el).not.toHaveAttribute("aria-expanded");
    expect(el).toHaveAttribute("aria-autocomplete", "list");
    expect(el).toHaveAttribute("aria-haspopup", "listbox");
    expect(el).toHaveAttribute("data-state", "closed");
    // Nothing to control while the portalled listbox is unmounted.
    expect(el).not.toHaveAttribute("aria-controls");

    await user.type(el, "@");
    expect(field()).toHaveAttribute("data-state", "open");
    expect(field().getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
  });

  it("holds the invariant on open, after a filter keystroke, and after an arrow move", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "@");
    expectActiveDescendantInvariant(); // on open

    await user.type(field(), "a");
    expectActiveDescendantInvariant(); // after a filter keystroke

    await user.type(field(), "d");
    expectActiveDescendantInvariant();

    await user.keyboard("{ArrowDown}");
    expectActiveDescendantInvariant(); // after an arrow move
  });

  it("drops aria-activedescendant entirely when nothing is highlighted", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@zzzz");
    expect(field()).not.toHaveAttribute("aria-activedescendant");
    expectActiveDescendantInvariant();
  });

  it("never leaves a dangling aria-activedescendant when the list shrinks", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@");
    await user.keyboard("{End}"); // highlight index 3
    await user.type(field(), "grace"); // list collapses to one option
    expectActiveDescendantInvariant();
  });

  it("names the listbox and keeps focus on the textarea", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "@");
    expect(screen.getByRole("listbox", { name: "Mention suggestions" })).toBeInTheDocument();
    expect(field()).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// T7 — controlled/uncontrolled parity + ref
// ---------------------------------------------------------------------------

describe("T7 controlled / uncontrolled parity", () => {
  function Controlled({ onValueChange }: { onValueChange: (v: MentionValue) => void }) {
    const [value, setValue] = useState<MentionValue>({ text: "", mentions: [] });
    return (
      <Harness
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onValueChange(v);
        }}
      />
    );
  }

  it("produces an identical MentionValue in both modes", async () => {
    const uncontrolled = vi.fn();
    const { unmount } = render(<Harness onValueChange={uncontrolled} />);
    const user = userEvent.setup();
    await user.type(field(), "hi @ada");
    await user.keyboard("{Enter}");
    const uncontrolledValue = uncontrolled.mock.calls.at(-1)?.[0];
    unmount();

    const controlled = vi.fn();
    render(<Controlled onValueChange={controlled} />);
    await user.type(field(), "hi @ada");
    await user.keyboard("{Enter}");
    const controlledValue = controlled.mock.calls.at(-1)?.[0];

    expect(uncontrolledValue).toEqual({
      text: "hi @Ada Lovelace ",
      mentions: [{ id: "u1", label: "Ada Lovelace", start: 3 }],
    });
    expect(controlledValue).toEqual(uncontrolledValue);
  });

  it("a controlled value the parent refuses to update never mutates the field", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness value={{ text: "frozen", mentions: [] }} onValueChange={onValueChange} />);
    await user.type(field(), "abc");
    expect(onValueChange).toHaveBeenCalled();
    expect(field().value).toBe("frozen");
  });

  it("seeds an uncontrolled field from defaultValue", () => {
    render(<Harness defaultValue={{ text: "hello", mentions: [] }} />);
    expect(field().value).toBe("hello");
  });

  it("forwards a ref to the real HTMLTextAreaElement", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(
      <MentionInput options={ROSTER}>
        <MentionInputTextarea ref={ref} aria-label="Comment" />
      </MentionInput>,
    );
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("forwards a ref to the real HTMLTextAreaElement THROUGH asChild", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(
      <MentionInput options={ROSTER}>
        <MentionInputTextarea ref={ref} asChild>
          <textarea aria-label="Comment" name="message" />
        </MentionInputTextarea>
      </MentionInput>,
    );
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    // The child's own props survive the Slot merge…
    expect(ref.current).toHaveAttribute("name", "message");
    // …and so do the slot's, which is what makes the composer binding work.
    expect(ref.current).toHaveAttribute("aria-autocomplete", "list");
    expect(ref.current).toHaveAttribute("data-slot", "mention-input-textarea");
  });
});

// ---------------------------------------------------------------------------
// T8 — the Slot handler-order contract (the `onKeyDownCapture` requirement)
// ---------------------------------------------------------------------------

describe("T8 Slot handler-order contract", () => {
  /**
   * `asChild` around a child that binds `onKeyDown` on a HOST ELEMENT — the
   * shape Radix `Slot`'s child-first merge actually breaks.
   *
   * The child mirrors `PromptInputTextarea`'s contract: run, then bail if an
   * outer handler already claimed the key. With the interception bound as
   * `onKeyDownCapture` it runs in the capture pass, so `defaultPrevented` is
   * already true and the host bails. Bound as `onKeyDown`, `Slot` composes
   * child-then-slot, the host runs FIRST with `defaultPrevented === false`, and
   * it submits — which is the regression this test exists to catch.
   */
  function HostBindingHarness({ onHostEnter }: { onHostEnter: () => void }) {
    return (
      <MentionInput options={ROSTER}>
        <MentionInputTextarea asChild>
          <textarea
            aria-label="Comment"
            onKeyDown={(event) => {
              if (event.defaultPrevented) return;
              if (event.key === "Enter") onHostEnter();
            }}
          />
        </MentionInputTextarea>
        <MentionInputContent>
          <MentionInputList>
            {(option) => <MentionInputItem key={option.id} option={option} />}
          </MentionInputList>
        </MentionInputContent>
      </MentionInput>
    );
  }

  it("intercepts BEFORE the child's own onKeyDown when the roster is open", async () => {
    const user = userEvent.setup();
    const onHostEnter = vi.fn();
    render(<HostBindingHarness onHostEnter={onHostEnter} />);

    await user.type(field(), "@ada");
    expect(field()).toHaveAttribute("data-state", "open");

    await user.keyboard("{Enter}");

    expect(field().value).toBe("@Ada Lovelace ");
    // THE discriminating assertion: bound as `onKeyDown`, the child would have
    // run first and fired.
    expect(onHostEnter).not.toHaveBeenCalled();
  });

  it("leaves the child's onKeyDown alone when the roster is closed", async () => {
    const user = userEvent.setup();
    const onHostEnter = vi.fn();
    render(<HostBindingHarness onHostEnter={onHostEnter} />);

    await user.type(field(), "hello");
    expect(field()).toHaveAttribute("data-state", "closed");

    await user.keyboard("{Enter}");
    expect(onHostEnter).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Consumer prop composition (props spread must not clobber internal wiring)
// ---------------------------------------------------------------------------

describe("consumer prop composition", () => {
  it("keeps tracking the value when the consumer ALSO passes onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <MentionInput options={ROSTER} onValueChange={onValueChange}>
        <MentionInputTextarea aria-label="Comment" onChange={onChange} />
      </MentionInput>,
    );

    await user.type(field(), "@ada");

    // Spreading `...props` after the handlers used to replace `onValueInput`
    // outright, leaving the provider-controlled field permanently empty.
    expect(field().value).toBe("@ada");
    expect(onValueChange).toHaveBeenLastCalledWith({ text: "@ada", mentions: [] });
    // …and the consumer's handler still runs.
    expect(onChange).toHaveBeenCalled();
  });

  it("composes the other handlers rather than replacing them", async () => {
    const user = userEvent.setup();
    const onKeyDownCapture = vi.fn();
    const onClick = vi.fn();
    const onBlur = vi.fn();
    render(
      <MentionInput options={ROSTER}>
        <MentionInputTextarea
          aria-label="Comment"
          onKeyDownCapture={onKeyDownCapture}
          onClick={onClick}
          onBlur={onBlur}
        />
        <MentionInputContent>
          <MentionInputList>
            {(option) => <MentionInputItem key={option.id} option={option} />}
          </MentionInputList>
        </MentionInputContent>
      </MentionInput>,
    );

    await user.click(field());
    expect(onClick).toHaveBeenCalled();

    // The internal keyboard model still runs (the roster opens and Enter
    // inserts) AND the consumer's capture handler is called.
    await user.keyboard("@ada");
    expect(field()).toHaveAttribute("data-state", "open");
    await user.keyboard("{Enter}");
    expect(field().value).toBe("@Ada Lovelace ");
    expect(onKeyDownCapture).toHaveBeenCalled();

    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it("lets consumer NON-handler props win, so <Label htmlFor> keeps working", () => {
    render(
      <MentionInput options={ROSTER}>
        <MentionInputTextarea
          id="my-field"
          name="comment"
          placeholder="Say something…"
          aria-label="Comment"
          aria-describedby="my-hint"
          data-testid="field"
        />
      </MentionInput>,
    );
    const el = screen.getByTestId("field");
    expect(el).toHaveAttribute("id", "my-field");
    expect(el).toHaveAttribute("name", "comment");
    expect(el).toHaveAttribute("placeholder", "Say something…");
    expect(el).toHaveAttribute("aria-describedby", "my-hint");
    // The component's own wiring is still present alongside them.
    expect(el).toHaveAttribute("aria-autocomplete", "list");
    expect(el).toHaveAttribute("data-slot", "mention-input-textarea");
  });
});

// ---------------------------------------------------------------------------
// Async rosters / query reporting
// ---------------------------------------------------------------------------

describe("onQueryChange", () => {
  it("reports the query while open and null when the popup closes", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<Harness onQueryChange={onQueryChange} filter={() => true} />);

    await user.type(field(), "@ad");
    expect(onQueryChange).toHaveBeenLastCalledWith("ad");

    await user.keyboard("{Escape}");
    expect(onQueryChange).toHaveBeenLastCalledWith(null);
  });
});
