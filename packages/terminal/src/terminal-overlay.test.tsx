/**
 * terminal-overlay.test.tsx — smoke + dialog-semantics lock for the
 * console-dress modal frame (#117 T13).
 *
 * The load-bearing assertions in this file are the dialog semantics that
 * actually matter — focus moves into the panel on open, Escape dismisses,
 * and the close control has a real accessible name — not that two class
 * strings differ, which would pass on colour-only code and prove nothing
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel").
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { TerminalOverlay } from "./terminal-overlay";

function Overlay(props: Partial<ComponentProps<typeof TerminalOverlay>> = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  return (
    <TerminalOverlay open onOpenChange={onOpenChange} title="Keyboard shortcuts" {...props}>
      <p>Overlay body content</p>
    </TerminalOverlay>
  );
}

describe("TerminalOverlay", () => {
  it("renders nothing when closed, and the title + body when open", () => {
    const { rerender } = render(
      <TerminalOverlay open={false} onOpenChange={vi.fn()} title="Keyboard shortcuts">
        <p>Overlay body content</p>
      </TerminalOverlay>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<Overlay />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Overlay body content")).toBeInTheDocument();
  });

  // The load-bearing accessibility lock: Radix's focus trap must actually be
  // wired, which is only true if this component reuses `DialogContent` rather
  // than a hand-rolled overlay. Asserting CONTAINMENT (not a specific control)
  // keeps the lock robust to which control happens to be first-tabbable.
  it("moves focus into the panel on open", async () => {
    render(<Overlay />);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Overlay onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // The close control must be reachable WITHOUT the keyboard chord it may
  // advertise in the footer legend — a real, named button, not only Escape.
  // Scoped to OUR control via its stable data-slot (rather than a bare
  // accessible-name query) because DialogContent's own baked-in close button
  // also reads as "Close" — see the next test's comment for why that
  // ambiguity is resolved by CSS this suite cannot execute.
  it("exposes a close control with an accessible name, which dismisses the panel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Overlay onOpenChange={onOpenChange} />);

    const close = document.querySelector('[data-slot="terminal-overlay-close"]') as HTMLElement;
    expect(close).toHaveAccessibleName("Close");
    await user.click(close);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // DialogContent's own baked-in close icon is hidden via a Tailwind `hidden`
  // utility (`**:data-[slot=dialog-close]:hidden`) targeting its stable
  // data-slot. This suite runs with `css: false` (repo-wide convention, every
  // package), so jsdom never computes that rule and cannot observe the hide —
  // exactly the "a unit test cannot clear a component of this" limitation
  // `.claude/rules/terminal-components.md` already documents for this ground's
  // colour contrast. The real lock lives in the Storybook browser pass: its
  // `getByRole("button", { name: "Close" })` resolves to exactly one element
  // only because the built-in control is genuinely `display: none` there — if
  // the hide ever broke, that query would start throwing on an ambiguous
  // match. This test only asserts the element is still present in markup with
  // the class that hides it, which is what jsdom CAN see.
  it("marks DialogContent's own baked-in close icon hidden (real hide verified in the browser pass)", () => {
    render(<Overlay />);
    expect(document.querySelector('[data-slot="dialog-close"]')).not.toBeNull();
    const panel = document.querySelector('[data-slot="terminal-overlay"]');
    expect(panel?.className).toContain("data-[slot=dialog-close]:hidden");
  });

  it("renders no description or aria-describedby reference when description is omitted", () => {
    render(<Overlay />);
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby");
  });

  it("renders a caller-supplied description, linked via aria-describedby", () => {
    render(<Overlay description="Every shortcut available in this session." />);
    const dialog = screen.getByRole("dialog");
    expect(screen.getByText("Every shortcut available in this session.")).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-describedby");
  });

  // `Dialog` portals its content to `document.body` (a sibling of RTL's
  // `container`, not a descendant of it) — queries here go through
  // `document`/`screen`, never `container`, or they would silently pass
  // vacuously against an empty subtree regardless of what actually rendered.
  it("renders no footer legend when hints is omitted or empty", () => {
    const { rerender } = render(<Overlay />);
    expect(document.querySelector("[data-slot='terminal-overlay-legend']")).toBeNull();

    rerender(<Overlay hints={[]} />);
    expect(document.querySelector("[data-slot='terminal-overlay-legend']")).toBeNull();
  });

  // Both halves of a hint row reach assistive tech. This test used to assert
  // the opposite — that the keys were `aria-hidden` "like `TerminalRow`'s
  // gutter glyph" — and that analogy was wrong: a gutter glyph is hidden
  // because `gutterLabel` restates it in words, whereas here nothing restates
  // the key. Hiding it left a non-visual user of a KEYBOARD-SHORTCUT legend
  // with the actions and none of the shortcuts.
  it("renders the footer legend with both the action and the keys reaching assistive tech", () => {
    render(<Overlay hints={[{ action: "Close overlay", keys: ["Esc"] }]} />);

    expect(screen.getByText("Close overlay")).toBeInTheDocument();
    const hint = document.querySelector("[data-slot='terminal-overlay-hint']");
    expect(hint).toHaveTextContent("Esc");
    expect(hint?.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("forwards a ref to the panel element", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <TerminalOverlay ref={ref} open onOpenChange={vi.fn()} title="Keyboard shortcuts">
        content
      </TerminalOverlay>,
    );
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("carries the terminal-overlay data-slot on its root", () => {
    render(<Overlay />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "terminal-overlay");
  });
});
