/**
 * terminal-permission.test.tsx — smoke + accessibility lock for the per-call
 * scoped approval prompt (#117 T10).
 *
 * The load-bearing assertion in this file is that every option is reachable
 * and selectable BY KEYBOARD ALONE, and that its scope is announced as real
 * WORDS (the accessible name) — not that two class strings differ, which
 * would pass on colour-only code and prove nothing
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel").
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ApprovalOption } from "@elabs-ai/components-ui";
import { TerminalPermission } from "./terminal-permission";

describe("TerminalPermission", () => {
  it("renders the default title, question and three scoped options", () => {
    render(<TerminalPermission />);

    expect(screen.getByText("Bash command")).toBeInTheDocument();
    expect(screen.getByText("Do you want to proceed?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Yes, and don’t ask again this session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "No, and tell the agent what to do differently" }),
    ).toBeInTheDocument();
  });

  it("never names a vendor product anywhere in its default copy", () => {
    const { container } = render(<TerminalPermission />);
    expect(container.textContent).not.toMatch(/claude|anthropic/i);
  });

  it("lets a caller override title, question and preview with arbitrary content", () => {
    render(
      <TerminalPermission
        title="Run script"
        question="Proceed?"
        preview={<code>rm -rf build</code>}
      />,
    );

    expect(screen.getByText("Run script")).toBeInTheDocument();
    expect(screen.getByText("Proceed?")).toBeInTheDocument();
    expect(screen.getByText("rm -rf build")).toBeInTheDocument();
    expect(screen.queryByText("Bash command")).not.toBeInTheDocument();
  });

  it("renders no preview row when preview is omitted", () => {
    const { container } = render(<TerminalPermission />);
    expect(container.querySelector("[data-slot='terminal-permission-preview']")).toBeNull();
  });

  it("links every option's consequence sentence as an accessible DESCRIPTION, not just nearby text", () => {
    render(<TerminalPermission />);

    const once = screen.getByRole("radio", { name: "Yes" });
    const describedBy = once.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Applies to this action only.",
    );
  });

  // The load-bearing accessibility lock for this component: every option must
  // be reachable AND selectable with no mouse, and each announces its scope
  // as a real accessible name — the `❯` glyph is decorative only.
  it("keeps every option reachable and selectable by keyboard alone, and each announces its scope in words", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<TerminalPermission onConfirm={onConfirm} />);

    await user.tab();
    const onceRadio = screen.getByRole("radio", { name: "Yes" });
    expect(onceRadio).toHaveFocus();
    expect(onceRadio).toHaveAccessibleName("Yes");

    // `ArrowDown` moves roving focus — real, native `RadioGroup` behavior, no
    // hand-rolled `parentElement.children[i]` walk. Committing the newly
    // focused option via `Space` is standard browser button activation,
    // independent of Radix's own auto-select-on-arrow-move (which relies on
    // a document-level focus/click ordering jsdom does not reproduce
    // faithfully — see `@elabs-ai/components-ai`'s `confirmation.test.tsx`
    // for the same, proven pattern). Either path is a real keyboard user
    // reaching and choosing the option with no mouse.
    await user.keyboard("{ArrowDown}");
    const sessionRadio = screen.getByRole("radio", {
      name: "Yes, and don’t ask again this session",
    });
    expect(sessionRadio).toHaveFocus();
    await user.keyboard(" ");
    await waitFor(() => expect(sessionRadio).toBeChecked());
    expect(sessionRadio).toHaveAccessibleName("Yes, and don’t ask again this session");
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "session", scope: "session" }),
      undefined,
    );

    await user.keyboard("{ArrowDown}");
    const denyRadio = screen.getByRole("radio", {
      name: "No, and tell the agent what to do differently",
    });
    expect(denyRadio).toHaveFocus();
    await user.keyboard(" ");
    await waitFor(() => expect(denyRadio).toBeChecked());
    expect(denyRadio).toHaveAccessibleName("No, and tell the agent what to do differently");
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "deny", scope: "deny" }),
      undefined,
    );

    // Arrowing back up steps through every option again — nothing is a
    // one-way trap. `ArrowUp` moves one item at a time (deny → session →
    // once), never jumps straight to the first item.
    await user.keyboard("{ArrowUp}");
    expect(sessionRadio).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(onceRadio).toHaveFocus();
    await user.keyboard(" ");
    await waitFor(() => expect(onceRadio).toBeChecked());
  });

  it("reveals the reason field only once the deny-scoped option is selected", () => {
    const { rerender } = render(<TerminalPermission value="once" />);
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();

    rerender(<TerminalPermission value="session" />);
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();

    rerender(<TerminalPermission value="deny" />);
    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
  });

  it("reports the typed reason via onConfirm once the deny option is selected", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<TerminalPermission defaultValue="deny" onConfirm={onConfirm} />);

    const reasonField = screen.getByLabelText("Reason");
    await user.type(reasonField, "use pnpm instead");

    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "deny", scope: "deny" }),
      "use pnpm instead",
    );
  });

  it("does not report a reason for a non-deny option even if text was typed earlier", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<TerminalPermission defaultValue="deny" onConfirm={onConfirm} />);

    await user.type(screen.getByLabelText("Reason"), "explain");
    await user.click(screen.getByRole("radio", { name: "Yes" }));

    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "once", scope: "once" }),
      undefined,
    );
  });

  it("does not hardcode any option vocabulary — a caller can replace the options entirely", () => {
    const customOptions: ApprovalOption[] = [
      { id: "a", label: "Allow", scope: "once" },
      { id: "b", label: "Always allow", scope: "always" },
      { id: "c", label: "Refuse", scope: "deny" },
    ];
    render(<TerminalPermission options={customOptions} />);

    expect(screen.getByRole("radio", { name: "Allow" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Always allow" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Refuse" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Yes" })).not.toBeInTheDocument();
  });

  it("lets an option supply its own description instead of the scope-derived default", () => {
    render(
      <TerminalPermission
        options={[{ id: "once", label: "Yes", scope: "once", description: "Just this one time." }]}
      />,
    );
    expect(screen.getByText("Just this one time.")).toBeInTheDocument();
    expect(screen.queryByText("Applies to this action only.")).not.toBeInTheDocument();
  });

  it("carries the terminal-permission root slot and merges className/props", () => {
    render(<TerminalPermission className="custom-permission" aria-label="permission" />);
    const root = document.querySelector("[data-slot='terminal-permission']");
    expect(root).toHaveClass("custom-permission");
    expect(root).toHaveAttribute("aria-label", "permission");
    expect(root).toHaveAttribute("role", "group");
  });

  it("passes the gutter variant through to every OPTION row, like every other row in the family", () => {
    render(<TerminalPermission variant="boxed" />);
    expect(document.querySelector("[data-slot='terminal-permission-option']")).toHaveAttribute(
      "data-variant",
      "boxed",
    );
  });

  it("passes marker/rail through to the prompt rows unchanged — only boxed is special-cased", () => {
    const { rerender } = render(<TerminalPermission preview="pnpm test" variant="rail" />);
    expect(document.querySelector("[data-slot='terminal-permission-title']")).toHaveAttribute(
      "data-variant",
      "rail",
    );
    expect(document.querySelector("[data-slot='terminal-permission-preview']")).toHaveAttribute(
      "data-variant",
      "rail",
    );

    rerender(<TerminalPermission preview="pnpm test" variant="marker" />);
    expect(document.querySelector("[data-slot='terminal-permission-title']")).toHaveAttribute(
      "data-variant",
      "marker",
    );
  });

  // Locks the cross-theme sweep fix on `terminal-terminalpermission--boxed`: the
  // title/command/question rows read as ONE continuous sentence inside a
  // single outer frame, instead of each drawing its own
  // `border-terminal-border` box — see the module doc, "`boxed` frames the
  // PROMPT as one block, not three". The options list is the reviewer's own
  // reference for "correct" and is asserted unchanged in the same test so a
  // future edit can't silently regress either half.
  it("boxed merges the title/preview/question rows into ONE frame instead of three", () => {
    render(<TerminalPermission preview="pnpm test" variant="boxed" />);

    const prompt = document.querySelector("[data-slot='terminal-permission-prompt']");
    expect(prompt).toHaveClass("rounded-md", "border", "border-terminal-border");

    // The individual prompt rows carry NO border of their own — the wrapper
    // above is the only frame this group draws. `data-variant="marker"` is
    // exactly the row grammar that renders no border (see `terminalRowVariants`).
    for (const slot of [
      "terminal-permission-title",
      "terminal-permission-preview",
      "terminal-permission-question",
    ]) {
      const row = document.querySelector(`[data-slot='${slot}']`);
      expect(row).toHaveAttribute("data-variant", "marker");
      expect(row).not.toHaveClass("border-terminal-border");
    }

    // The options list is untouched by this fix — it already read as one
    // shared frame with internal hairlines, and stays that way.
    const optionRows = document.querySelectorAll("[data-slot='terminal-permission-option']");
    expect(optionRows.length).toBeGreaterThan(0);
    for (const option of optionRows) {
      expect(option).toHaveAttribute("data-variant", "boxed");
      expect(option).toHaveClass("border-terminal-border");
    }
  });

  it("boxed leaves marker/rail spacing untouched — the prompt wrapper adds no border outside boxed", () => {
    render(<TerminalPermission preview="pnpm test" variant="marker" />);
    const prompt = document.querySelector("[data-slot='terminal-permission-prompt']");
    expect(prompt).not.toHaveClass("border-terminal-border");
  });
});
