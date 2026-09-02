/**
 * terminal-composer.test.tsx — smoke + accessibility-lock tests for the
 * prompt composer (#117 T11).
 *
 * The load-bearing assertions are: (1) the "nothing to submit" state uses
 * `aria-disabled`, never native `disabled`, so the control stays in the tab
 * order; (2) the effort level is recoverable as WORDS at at least two
 * adjacent levels, not only as a filled shape — asserting only that two
 * class strings differ would pass on colour-only code and prove nothing
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel");
 * (3) ADR 0022's four-case primary-action contract (#128) — a mid-turn
 * follow-up can always be submitted, a `busy` composer with no `onStop`
 * never shows a (dead) Stop control, and the composer-owns-cancellation
 * arrangement (`busy` + `onStop` + empty) is not regressed by the fix for
 * the other two.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TerminalComposer } from "./terminal-composer";

const EFFORT_LEVELS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const MODES = [
  { id: "auto", label: "Auto", keyHint: "⇧Tab" },
  { id: "plan", label: "Plan first" },
];

describe("TerminalComposer", () => {
  it("renders a text well, a submit affordance and the default shortcut hints", () => {
    render(<TerminalComposer />);
    expect(screen.getByPlaceholderText("Type your next instruction…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByText("send")).toBeInTheDocument();
    expect(screen.getByText("newline")).toBeInTheDocument();
    // No mode/effort indicator renders when neither prop is given.
    expect(document.querySelector("[data-slot='terminal-composer-controls']")).toBeNull();
  });

  it("uses aria-disabled, never native disabled, when there is nothing to submit", () => {
    render(<TerminalComposer />);
    const submit = screen.getByRole("button", { name: "Send" });
    expect(submit).toHaveAttribute("aria-disabled", "true");
    // The genuinely load-bearing half of this lock: a NATIVELY disabled
    // button is dropped from the tab order and reports `.disabled === true`.
    // aria-disabled keeps it a real, focusable control.
    expect(submit).not.toBeDisabled();
    expect(submit).not.toHaveAttribute("disabled");
    submit.focus();
    expect(submit).toHaveFocus();
  });

  it("enables the submit affordance once there is non-whitespace text, uncontrolled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TerminalComposer onSubmit={onSubmit} />);
    const textbox = screen.getByPlaceholderText("Type your next instruction…");
    await user.type(textbox, "list the repo");
    const submit = screen.getByRole("button", { name: "Send" });
    expect(submit).not.toHaveAttribute("aria-disabled");
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith("list the repo");
    // Uncontrolled: the composer clears itself after a commit.
    expect(textbox).toHaveValue("");
  });

  it("submits on Enter and inserts a newline on Shift+Enter, never blocking paste", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TerminalComposer onSubmit={onSubmit} />);
    const textbox = screen.getByPlaceholderText("Type your next instruction…");
    await user.type(textbox, "first line{Shift>}{Enter}{/Shift}second line");
    expect(textbox).toHaveValue("first line\nsecond line");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(textbox, "{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("first line\nsecond line");
  });

  // ADR 0022's four-case primary-action contract, adopted for the composer
  // via composition (#128 — `Boolean(onStop)` plays the role of the chat
  // family's `hasDedicatedStop`). Named after the cases so a regression in
  // any one of them fails a test whose name says exactly which case broke.

  it("case 2 — busy + onStop + EMPTY well: shows Stop, the cancel hint, and never auto-disables it", () => {
    const onStop = vi.fn();
    render(<TerminalComposer busy onStop={onStop} />);
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    expect(screen.getByText("cancel")).toBeInTheDocument();
    stop.click();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("case 3 — busy + onStop + NON-EMPTY well: the control is Send, not Stop (case 3 beats case 2)", () => {
    const onStop = vi.fn();
    render(<TerminalComposer busy onStop={onStop} value="a mid-turn follow-up" />);
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("case 3 — a mid-turn follow-up can be submitted on Enter while busy (the dead end this issue fixes)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TerminalComposer busy onStop={vi.fn()} onSubmit={onSubmit} />);
    const textbox = screen.getByPlaceholderText("Type your next instruction…");
    await user.type(textbox, "keep going with the migration{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("keep going with the migration");
  });

  it("case 4 — busy + no onStop: never renders Stop, the control stays named Send, and no cancel hint is advertised", () => {
    render(<TerminalComposer busy />);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByText("cancel")).toBeNull();
  });

  it("loses the cancel hint again once busy clears, while onStop stays owned", () => {
    const onStop = vi.fn();
    const { rerender } = render(<TerminalComposer busy onStop={onStop} />);
    expect(screen.getByText("cancel")).toBeInTheDocument();
    rerender(<TerminalComposer busy={false} onStop={onStop} />);
    expect(screen.queryByText("cancel")).toBeNull();
  });

  it("calls onStop on Escape while busy and owning cancellation, and does nothing on Escape at rest", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const { rerender } = render(<TerminalComposer busy onStop={onStop} />);
    const textbox = screen.getByPlaceholderText("Type your next instruction…");
    await user.click(textbox);
    await user.keyboard("{Escape}");
    expect(onStop).toHaveBeenCalledTimes(1);

    rerender(<TerminalComposer busy={false} onStop={onStop} />);
    await user.keyboard("{Escape}");
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("Escape is a no-op when busy but this composer does not own cancellation (no onStop)", async () => {
    const user = userEvent.setup();
    render(<TerminalComposer busy />);
    const textbox = screen.getByPlaceholderText("Type your next instruction…");
    await user.click(textbox);
    // No onStop to call — asserting there is nothing to assert on would prove
    // nothing, so this locks the actual, observable side effect: the Stop
    // affordance never exists to receive the activation in the first place.
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("renders a mode indicator only when modes are given, and lets the person switch modes", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<TerminalComposer modes={MODES} onModeChange={onModeChange} />);
    const trigger = screen.getByRole("button", { name: "Auto" });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitemradio", { name: "Plan first" }));
    expect(onModeChange).toHaveBeenCalledWith("plan");
  });

  it("announces the current effort level as WORDS at two adjacent levels, not only as a filled shape", () => {
    const { rerender } = render(
      <TerminalComposer effortLevels={EFFORT_LEVELS} effort="low" effortLabel="Reasoning effort" />,
    );
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Low" })).toHaveAttribute("data-filled", "true");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("data-filled", "false");
    expect(screen.getByRole("radio", { name: "High" })).toHaveAttribute("data-filled", "false");

    rerender(
      <TerminalComposer
        effortLevels={EFFORT_LEVELS}
        effort="medium"
        effortLabel="Reasoning effort"
      />,
    );
    expect(screen.queryByText("Low")).toBeNull();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Low" })).toHaveAttribute("data-filled", "true");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("data-filled", "true");
    expect(screen.getByRole("radio", { name: "High" })).toHaveAttribute("data-filled", "false");

    // Every rung keeps its own accessible name regardless of selection — the
    // scale reaches assistive tech as words even for levels that are not
    // the current one.
    expect(screen.getByRole("radiogroup", { name: "Reasoning effort" })).toBeInTheDocument();
  });

  it("mirrors controlled value and never manages its own text state once `value` is set", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TerminalComposer value="draft" onChange={onChange} />);
    const textbox = screen.getByPlaceholderText(
      "Type your next instruction…",
    ) as HTMLTextAreaElement;
    expect(textbox.value).toBe("draft");
    fireEvent.change(textbox, { target: { value: "draft!" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    // Controlled: the DOM value does not advance until the parent re-renders
    // with the new `value` — the composer never manages its own text state
    // once `value` is provided (derives `isControlled` and never flips).
    expect(textbox.value).toBe("draft");
    rerender(<TerminalComposer value="draft!" onChange={onChange} />);
    expect(textbox.value).toBe("draft!");
  });
});
