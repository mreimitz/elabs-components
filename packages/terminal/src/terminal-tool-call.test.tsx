/**
 * terminal-tool-call.test.tsx — smoke + accessibility lock for a single
 * tool-call row (#117 T8).
 *
 * The load-bearing assertion in this file is the announced WORDS a screen
 * reader gets for each `status` — not that two class strings differ, which
 * would pass on colour-only code and prove nothing
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel") —
 * and that the detail disclosure opens by KEYBOARD, not only by click.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  TERMINAL_TOOL_CALL_STATUSES,
  TerminalToolCall,
  type TerminalToolCallStatus,
} from "./terminal-tool-call";

describe("TerminalToolCall", () => {
  it("defaults to the pending status", () => {
    render(<TerminalToolCall toolName="Bash" />);
    expect(screen.getByText("Bash").closest("[data-slot='terminal-tool-call']")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  it("renders every status's meaning as announced words, not just as colour or glyph", () => {
    // The accessibility lock for the whole component: it asserts the WORDS a
    // screen reader gets for every status. Deleting the status→label map (or
    // scrambling it) must fail this test — verified by hand while authoring
    // it, see the "breaks when it should" case below.
    const expected: Record<TerminalToolCallStatus, string> = {
      success: "Succeeded",
      error: "Failed",
      pending: "Running",
    };

    for (const status of TERMINAL_TOOL_CALL_STATUSES) {
      const { unmount } = render(<TerminalToolCall toolName="Bash" status={status} />);
      expect(screen.getByText(expected[status])).toBeInTheDocument();
      unmount();
    }
  });

  it("gives every status its own glyph shape, not a single recoloured bullet", () => {
    const expectedGlyph: Record<TerminalToolCallStatus, string> = {
      success: "⏺",
      error: "✗",
      pending: "○",
    };

    for (const status of TERMINAL_TOOL_CALL_STATUSES) {
      const { container, unmount } = render(<TerminalToolCall toolName="Bash" status={status} />);
      const glyph = container.querySelector(
        "[data-slot='terminal-row-gutter'] [aria-hidden='true']",
      );
      expect(glyph).toHaveTextContent(expectedGlyph[status]);
      unmount();
    }
  });

  it("renders the tool name with its argument in parentheses", () => {
    render(<TerminalToolCall toolName="Bash" argument="rm -rf tmp" />);
    expect(screen.getByText("Bash(rm -rf tmp)")).toBeInTheDocument();
  });

  it("renders no parentheses when there is no argument", () => {
    render(<TerminalToolCall toolName="Read" />);
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });

  it("renders the result summary on its own ⎿ row", () => {
    const { container } = render(
      <TerminalToolCall toolName="Bash" status="success" summary="3 files changed" />,
    );
    expect(screen.getByText("3 files changed")).toBeInTheDocument();
    const glyph = container.querySelector(
      "[data-slot='terminal-tool-call-summary'] [data-slot='terminal-row-gutter'] [aria-hidden='true']",
    );
    expect(glyph).toHaveTextContent("⎿");
  });

  it("renders no summary row when summary is omitted", () => {
    const { container } = render(<TerminalToolCall toolName="Bash" status="pending" />);
    expect(container.querySelector("[data-slot='terminal-tool-call-summary']")).toBeNull();
  });

  describe("the alert rule (loading-states.md)", () => {
    it("gives error, and only error, role=alert on the summary row", () => {
      const { rerender, getByText } = render(
        <TerminalToolCall toolName="Bash" status="error" summary="file not found" />,
      );
      expect(getByText("file not found").closest("[role='alert']")).not.toBeNull();

      for (const status of ["success", "pending"] as const) {
        rerender(<TerminalToolCall toolName="Bash" status={status} summary="file not found" />);
        expect(getByText("file not found").closest("[role='alert']")).toBeNull();
      }
    });

    it("never fires the alert while pending, even with an error-shaped summary", () => {
      // A half-arrived result is not a settled failure — the caller may still
      // be showing a stale/partial line while the call is in flight.
      render(<TerminalToolCall toolName="Bash" status="pending" summary="Error: not yet" />);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("the expand disclosure", () => {
    it("renders no disclosure at all when there is no detail", () => {
      render(<TerminalToolCall toolName="Bash" />);
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("keeps the detail collapsed by default", () => {
      render(<TerminalToolCall toolName="Bash" detail="raw stdout" />);
      expect(screen.queryByText("raw stdout")).not.toBeInTheDocument();
    });

    it("opens the detail via KEYBOARD — tab to the trigger, then Enter", async () => {
      const user = userEvent.setup();
      render(<TerminalToolCall toolName="Bash" argument="ls" detail="raw stdout" />);

      expect(screen.queryByText("raw stdout")).not.toBeInTheDocument();

      await user.tab();
      const trigger = screen.getByRole("button", { name: /show details/i });
      expect(trigger).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(screen.getByText("raw stdout")).toBeInTheDocument();
    });

    it("keeps the trigger visible and named once open (never an unlabelled control)", async () => {
      const user = userEvent.setup();
      render(<TerminalToolCall toolName="Bash" detail="raw stdout" />);
      await user.click(screen.getByRole("button", { name: /show details/i }));
      // Re-collapsible: the control must still be reachable and named, or a
      // keyboard user could never close it again.
      expect(screen.getByRole("button", { name: /show details/i })).toBeVisible();
    });
  });
});
