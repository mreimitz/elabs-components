import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalEventLine } from "./terminal-event-line";

describe("TerminalEventLine (#117 T6)", () => {
  it("renders the label and the fixed marker glyph, hidden from assistive tech", () => {
    const { container } = render(<TerminalEventLine label="user_prompt_submit" />);
    expect(screen.getByText("user_prompt_submit")).toBeInTheDocument();

    const glyph = container.querySelector("[data-slot='terminal-row-gutter'] [aria-hidden='true']");
    expect(glyph).toHaveTextContent("◆");
  });

  it("carries the row's data-slot, not TerminalRow's own default", () => {
    render(<TerminalEventLine label="stop" data-testid="row" />);
    // A composed row takes ownership of the root slot, exactly like AgentEvent
    // does over AgentStep — a consumer selector targets `terminal-event-line`,
    // never the generic `terminal-row` underneath it.
    expect(screen.getByTestId("row")).toHaveAttribute("data-slot", "terminal-event-line");
  });

  it("maps outcome onto the shared closed Status, like AgentEvent", () => {
    const { rerender } = render(<TerminalEventLine label="stop" outcome="ok" />);
    expect(screen.getByText("stop").closest("[data-slot='terminal-event-line']")).toHaveAttribute(
      "data-outcome",
      "ok",
    );

    rerender(<TerminalEventLine label="pre_tool_use" outcome="blocked" />);
    expect(
      screen.getByText("pre_tool_use").closest("[data-slot='terminal-event-line']"),
    ).toHaveAttribute("data-outcome", "blocked");

    rerender(<TerminalEventLine label="post_tool_use" outcome="failed" />);
    expect(
      screen.getByText("post_tool_use").closest("[data-slot='terminal-event-line']"),
    ).toHaveAttribute("data-outcome", "failed");
  });

  // The load-bearing accessibility assertion for this unit. Every outcome —
  // including the default "ok" — announces a real, distinct word to assistive
  // tech, and the three words differ from each other. Asserting that two
  // class strings differ would pass on colour-only code and prove nothing;
  // this asserts the ANNOUNCED TEXT itself.
  it("announces a distinct outcome word for every outcome, never colour alone", () => {
    const outcomeWord = (label: string) =>
      screen
        .getByText(label)
        .closest("[data-slot='terminal-event-line']")
        ?.querySelector("[data-slot='terminal-event-line-outcome']")?.nextElementSibling
        ?.textContent;

    const { rerender } = render(<TerminalEventLine label="ok-event" outcome="ok" />);
    const okWord = outcomeWord("ok-event");
    expect(okWord).toBeTruthy();

    rerender(<TerminalEventLine label="blocked-event" outcome="blocked" />);
    const blockedWord = outcomeWord("blocked-event");
    expect(blockedWord).toBeTruthy();

    rerender(<TerminalEventLine label="failed-event" outcome="failed" />);
    const failedWord = outcomeWord("failed-event");
    expect(failedWord).toBeTruthy();

    expect(okWord).not.toBe(blockedWord);
    expect(okWord).not.toBe(failedWord);
    expect(blockedWord).not.toBe(failedWord);
  });

  it("renders a bare hook total as the terminal's own [hooks: N] vocabulary", () => {
    render(<TerminalEventLine label="List ." hooks={3} />);
    expect(screen.getByText("[hooks: 3]")).toBeInTheDocument();
  });

  it("renders a hooks summary as [hooks: ran/passed]", () => {
    render(<TerminalEventLine label="user_prompt_submit" hooks={{ ran: 3, passed: 1 }} />);
    expect(screen.getByText("[hooks: 3/1]")).toBeInTheDocument();
  });

  // The instruction this unit exists to satisfy: a partial hook failure must
  // read as bad to someone who cannot see colour, independently of `outcome`.
  it("flags a partial hook failure as bad in words, not only in colour", () => {
    const { container } = render(
      <TerminalEventLine label="stop" outcome="ok" hooks={{ ran: 3, passed: 1 }} />,
    );

    const hooksNode = container.querySelector("[data-slot='terminal-event-line-hooks']");
    expect(hooksNode).toHaveAttribute("data-hooks-failed", "true");
    // The sr-only word states the failing count as text — recoverable by a
    // screen reader from this node alone, with no colour involved.
    expect(hooksNode?.textContent).toContain("2");
    expect(hooksNode?.textContent?.toLowerCase()).toContain("fail");
  });

  it("does not flag a fully-passing hooks summary as a failure", () => {
    const { container } = render(<TerminalEventLine label="stop" hooks={{ ran: 3, passed: 3 }} />);
    const hooksNode = container.querySelector("[data-slot='terminal-event-line-hooks']");
    expect(hooksNode).toHaveAttribute("data-hooks-failed", "false");
  });

  it("renders no hooks part when hooks is omitted", () => {
    const { container } = render(<TerminalEventLine label="stop" />);
    expect(container.querySelector("[data-slot='terminal-event-line-hooks']")).toBeNull();
  });

  it("renders the phase as its own visible data-slot part, omitted by default", () => {
    const { container, rerender } = render(<TerminalEventLine label="stop" />);
    expect(container.querySelector("[data-slot='terminal-event-line-phase']")).toBeNull();

    rerender(<TerminalEventLine label="user_prompt_submit" phase="lifecycle" />);
    const phaseNode = container.querySelector("[data-slot='terminal-event-line-phase']");
    expect(phaseNode).not.toBeNull();
    expect(phaseNode?.textContent?.trim()).toBeTruthy();
  });

  it("renders duration via the shared formatElapsed, not a second formatter", () => {
    render(<TerminalEventLine label="stop" durationMs={8000} />);
    // formatElapsed(8000) === "8.0s" (packages/ui/src/lib/format-duration.ts)
    expect(screen.getByText((_, node) => node?.textContent === "· 8.0s")).toBeInTheDocument();
  });

  it("lets a row override the surrounding surface's gutter variant, like TerminalRow", () => {
    const { container } = render(<TerminalEventLine label="stop" variant="rail" />);
    // The root carries `terminal-event-line`, not TerminalRow's own default
    // slot (asserted above) — `data-variant` still rides the same element.
    expect(container.querySelector("[data-slot='terminal-event-line']")).toHaveAttribute(
      "data-variant",
      "rail",
    );
  });

  it("merges className and spreads props onto the underlying row", () => {
    render(<TerminalEventLine label="stop" className="custom-event" aria-label="event" />);
    const row = screen.getByText("stop").closest("[data-slot='terminal-event-line']");
    expect(row).toHaveClass("custom-event");
    expect(row).toHaveAttribute("aria-label", "event");
  });
});
