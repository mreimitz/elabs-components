import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  useCommandActiveItemId,
} from "./command";

// jsdom does not implement `Element.prototype.scrollIntoView`, and `cmdk`
// calls it unconditionally (not feature-detected — it's a third-party
// dependency, not brand-ui code) whenever the highlighted item changes.
// `packages/ui/vitest.setup.ts` deliberately does NOT stub this globally (it
// would mask a real brand-ui component skipping its own feature-detection),
// so — mirroring `tree.test.tsx`'s local stub for the same jsdom gap — every
// test in this file gets a local no-op stub instead.
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

beforeEach(() => {
  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

/** #365 — cmdk assigns each item's `id`/`role`/`aria-selected` internally, so
 * `Command`'s `onActiveItemIdChange` (and the `useCommandActiveItemId` hook)
 * are the supported way to read the highlighted item's DOM id. */
describe("Command — onActiveItemIdChange (#365)", () => {
  function Harness({ onActiveItemIdChange }: { onActiveItemIdChange: (id?: string) => void }) {
    return (
      <Command onActiveItemIdChange={onActiveItemIdChange}>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandGroup heading="Fruit">
            <CommandItem value="apple">Apple</CommandItem>
            <CommandItem value="banana">Banana</CommandItem>
            <CommandItem value="cherry">Cherry</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  it("reports the DOM id of the currently-selected item — never by positional index", async () => {
    const onActiveItemIdChange = vi.fn();
    const { container } = render(<Harness onActiveItemIdChange={onActiveItemIdChange} />);

    const input = screen.getByPlaceholderText("Search…");
    await userEvent.type(input, "{ArrowDown}{ArrowDown}");

    const selected = container.querySelector('[aria-selected="true"]') as HTMLElement;
    expect(selected).not.toBeNull();

    // The LAST reported id must match the committed DOM id of the selected
    // item — read from cmdk's own `aria-selected` attribute, never a
    // positional/index match against the item list.
    const lastCall = onActiveItemIdChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(selected.id);
  });

  it("reports undefined once filtering leaves no matches, and a defined id again once restored", async () => {
    const onActiveItemIdChange = vi.fn();
    const { container } = render(<Harness onActiveItemIdChange={onActiveItemIdChange} />);

    const input = screen.getByPlaceholderText("Search…");
    await userEvent.type(input, "zzz-no-match");
    await waitFor(() => expect(onActiveItemIdChange.mock.calls.at(-1)?.[0]).toBeUndefined());

    // Clearing the filter re-highlights an item, and the id must come back on
    // its own — with NO keyboard navigation to nudge it (cmdk's own
    // `state.selectedItemId` stays `undefined` here; see the next two tests).
    await userEvent.clear(input);
    await waitFor(() => {
      const selected = container.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(selected).not.toBeNull();
      expect(onActiveItemIdChange.mock.calls.at(-1)?.[0]).toBe(selected.id);
    });
  });

  // The two tests below lock the gap in cmdk 1.1.1 that `Command` works around.
  // cmdk only recomputes `state.selectedItemId` in a callback queued from
  // `setState("value", …)`, and its own `selectFirstItem()` runs inside the very
  // layout-effect flush that drains that queue — so the callback reads the DOM
  // before React has committed the new `aria-selected`, and the field stays
  // `undefined`. Reproduced with zero brand-ui code: cmdk's own `Command.Input`
  // renders NO `aria-activedescendant` in either state. Without the workaround a
  // consumer wiring an `@`-mention popup gets `undefined` for exactly the two
  // states the popup spends its life in, and is pushed back to the positional
  // DOM query this issue exists to remove.
  it("reports the item cmdk auto-highlights on MOUNT, before any interaction", async () => {
    const onActiveItemIdChange = vi.fn();
    const { container } = render(<Harness onActiveItemIdChange={onActiveItemIdChange} />);

    await waitFor(() => {
      const selected = container.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(selected).not.toBeNull();
      expect(onActiveItemIdChange.mock.calls.at(-1)?.[0]).toBe(selected.id);
    });
  });

  it("reports the item re-highlighted by FILTERING, with no keyboard navigation", async () => {
    const onActiveItemIdChange = vi.fn();
    const { container } = render(<Harness onActiveItemIdChange={onActiveItemIdChange} />);

    // "an" matches Banana only — cmdk moves the highlight off Apple without an
    // arrow key ever being pressed.
    await userEvent.type(screen.getByPlaceholderText("Search…"), "an");

    await waitFor(() => {
      const selected = container.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(selected).not.toBeNull();
      expect(selected.textContent).toBe("Banana");
      expect(onActiveItemIdChange.mock.calls.at(-1)?.[0]).toBe(selected.id);
    });
  });

  it("does not change cmdk's own selection/filtering behaviour (control)", async () => {
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandGroup heading="Fruit">
            <CommandItem value="apple" onSelect={onSelect}>
              Apple
            </CommandItem>
            <CommandItem value="banana" onSelect={onSelect}>
              Banana
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    const input = screen.getByPlaceholderText("Search…");
    await userEvent.type(input, "banana");
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();

    await userEvent.type(input, "{Enter}");
    expect(onSelect).toHaveBeenCalledWith("banana");
  });

  function InnerReader({ onId }: { onId: (id?: string) => void }) {
    const id = useCommandActiveItemId();
    onId(id);
    return null;
  }

  it("useCommandActiveItemId reports the same id as the onActiveItemIdChange callback", async () => {
    const fromCallback = vi.fn();
    const fromHook = vi.fn();

    function HookHarness() {
      return (
        <Command onActiveItemIdChange={fromCallback}>
          <CommandInput placeholder="Search…" />
          <InnerReader onId={fromHook} />
          <CommandList>
            <CommandGroup heading="Fruit">
              <CommandItem value="apple">Apple</CommandItem>
              <CommandItem value="banana">Banana</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      );
    }

    render(<HookHarness />);
    const input = screen.getByPlaceholderText("Search…");
    await userEvent.type(input, "{ArrowDown}");

    expect(fromHook.mock.calls.at(-1)?.[0]).toBe(fromCallback.mock.calls.at(-1)?.[0]);
  });
});

describe("CommandItem — dev-only warning for cmdk-overridden props", () => {
  it("warns when a consumer passes id, role, or aria-selected", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      render(
        <Command>
          <CommandList>
            <CommandItem id="my-custom-id">Apple</CommandItem>
          </CommandList>
        </Command>,
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"id"'));
    } finally {
      warn.mockRestore();
    }
  });
});

/**
 * A plain external input ABOVE the `Command` tree — the composer-textarea shape
 * this issue was filed for. Arrow keys typed into the input are forwarded onto
 * the `Command` root (the same technique `command.stories.tsx`'s
 * `ExternalInputCombobox` story uses), and `aria-activedescendant` is driven off
 * `onActiveItemIdChange` — never a positional DOM query.
 */
describe("Command — external combobox input wiring (integration)", () => {
  function ExternalCombobox() {
    const [activeId, setActiveId] = useState<string | undefined>();
    const listRef = useRef<HTMLDivElement>(null);

    const forwardKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (["ArrowDown", "ArrowUp", "Enter", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        listRef.current?.dispatchEvent(
          new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true }),
        );
      }
    };

    return (
      <div>
        <input
          aria-activedescendant={activeId}
          aria-controls="fruit-list"
          aria-expanded="true"
          role="combobox"
          onKeyDown={forwardKey}
          placeholder="Type to search fruit…"
        />
        <Command id="fruit-list" ref={listRef} onActiveItemIdChange={setActiveId}>
          <CommandList>
            <CommandGroup heading="Fruit">
              <CommandItem value="apple">Apple</CommandItem>
              <CommandItem value="banana">Banana</CommandItem>
              <CommandItem value="cherry">Cherry</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    );
  }

  it("keeps the external input's aria-activedescendant in sync with the selected item's id", async () => {
    const { container } = render(<ExternalCombobox />);
    const input = screen.getByPlaceholderText("Type to search fruit…");

    // FIRST, before any interaction at all: a screen-reader user who focuses
    // the input while the popup is already open must be told which option is
    // highlighted. cmdk highlights the first item on mount, so
    // aria-activedescendant has to point at it right away.
    await waitFor(() => {
      const onMount = container.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(onMount).not.toBeNull();
      expect(input).toHaveAttribute("aria-activedescendant", onMount.id);
    });

    // Forward one ArrowDown to move cmdk's selection (exercising the real
    // keyboard-navigation path the ExternalInputCombobox story drives), then
    // assert the external input's aria-activedescendant tracks the newly
    // highlighted item's DOM id — never a positional index.
    await userEvent.type(input, "{ArrowDown}");
    await waitFor(() => {
      const nowSelected = container.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(nowSelected).not.toBeNull();
      expect(input).toHaveAttribute("aria-activedescendant", nowSelected.id);
    });

    // A second ArrowDown must move it again, to a DIFFERENT id.
    const firstId = input.getAttribute("aria-activedescendant");
    await userEvent.type(input, "{ArrowDown}");
    await waitFor(() => {
      const nowSelected = container.querySelector('[aria-selected="true"]') as HTMLElement;
      expect(nowSelected.id).not.toBe(firstId);
      expect(input).toHaveAttribute("aria-activedescendant", nowSelected.id);
    });
  });
});
