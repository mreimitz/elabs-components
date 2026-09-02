import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TerminalStatusBar } from "./terminal-status-bar";

describe("TerminalStatusBar", () => {
  it("renders nothing at all when every segment is empty", () => {
    const { container } = render(<TerminalStatusBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the segments whose prop is supplied", () => {
    render(<TerminalStatusBar branch="main" />);

    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.queryByTestId("terminal-status-bar-workspace")).not.toBeInTheDocument();
  });

  it("renders branch and workspace together, left to right", () => {
    const { container } = render(
      <TerminalStatusBar branch="feature/status-bar" workspace="~/dev/app" />,
    );

    expect(screen.getByText("feature/status-bar")).toBeInTheDocument();
    expect(screen.getByText("~/dev/app")).toBeInTheDocument();
    const segments = container.querySelectorAll("[data-slot^='terminal-status-bar-']");
    expect(segments[0]).toHaveAttribute("data-slot", "terminal-status-bar-branch");
    expect(segments[1]).toHaveAttribute("data-slot", "terminal-status-bar-workspace");
  });

  it("carries the session-status live region on the container", () => {
    const { container } = render(<TerminalStatusBar branch="main" />);
    const root = container.querySelector("[data-slot='terminal-status-bar']");

    expect(root).toHaveAttribute("role", "status");
    expect(root).toHaveAttribute("aria-label", "Session status");
    expect(root).toHaveAttribute("aria-live", "polite");
  });

  it("truncates a long working directory in place and keeps the full value in title", () => {
    const longPath = "/very/long/working/directory/that/would/otherwise/overflow/the/bar";
    const { container } = render(<TerminalStatusBar workspace={longPath} />);

    const label = screen.getByTitle(longPath);
    expect(label).toHaveTextContent(longPath);
    expect(label.className).toContain("truncate");

    const segment = container.querySelector("[data-slot='terminal-status-bar-workspace']");
    expect(segment?.className).toContain("min-w-0");
  });

  it("renders a connection count and a distinct connecting state", () => {
    const { rerender } = render(<TerminalStatusBar connections={{ connected: 2, total: 4 }} />);
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 connections")).toBeInTheDocument();

    rerender(<TerminalStatusBar connections={{ connected: 0, total: 4, connecting: true }} />);
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  // The load-bearing accessibility lock for this component: a disconnected
  // integration must be recoverable in greyscale (a distinct glyph plus a
  // VISIBLE text label) and by a screen reader (the same words, announced).
  // This asserts the announced WORDS, not that two class strings differ — a
  // class-difference assertion passes on colour-only code and proves nothing
  // (`.claude/rules/accessibility.md`).
  it("marks a lost connection with a distinct glyph and a visible, announced text label — never colour alone", () => {
    const { container, rerender } = render(
      <TerminalStatusBar connections={{ connected: 0, total: 4 }} />,
    );
    // The connected rung shows the numeric fraction, not the word.
    expect(screen.queryByText("Disconnected")).not.toBeInTheDocument();

    rerender(<TerminalStatusBar connections={{ connected: 0, total: 4, disconnected: true }} />);

    // The word itself is visible (not sr-only), so it survives greyscale.
    const label = screen.getByText("Disconnected");
    expect(label).toBeInTheDocument();
    expect(label.className).not.toContain("sr-only");

    // The numeric fraction is replaced, not merely joined by the word.
    expect(screen.queryByText("0/4")).not.toBeInTheDocument();

    // A distinct glyph from the connected/connecting rungs (Unplug vs PlugZap/Loader2).
    const segment = container.querySelector("[data-slot='terminal-status-bar-connections']");
    expect(segment?.querySelector("svg.lucide-unplug")).toBeInTheDocument();
    expect(segment?.querySelector("svg.lucide-plug-zap")).not.toBeInTheDocument();
  });

  it("renders already-formatted context usage strings verbatim, without reformatting them", () => {
    render(<TerminalStatusBar context={{ limit: "500K", used: "16K" }} />);

    expect(screen.getByText("16K / 500K")).toBeInTheDocument();
    expect(screen.getByText("16K of 500K context used")).toBeInTheDocument();
  });

  it("pairs the turn progress's aria-hidden checkmark with an sr-only 'steps complete' label", () => {
    const { container } = render(<TerminalStatusBar turn={{ current: 3, total: 5 }} />);

    expect(screen.getByText("3/5")).toBeInTheDocument();
    const check = container.querySelector("[data-slot='terminal-status-bar-turn'] svg");
    expect(check).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("3 of 5 steps complete")).toBeInTheDocument();
  });

  it("renders the divider only between a preceding right-hand fact and turn progress", () => {
    const { container, rerender } = render(<TerminalStatusBar turn={{ current: 1, total: 2 }} />);
    expect(container.querySelector("[data-slot='terminal-status-bar-divider']")).toBeNull();

    rerender(
      <TerminalStatusBar
        context={{ limit: "500K", used: "16K" }}
        turn={{ current: 1, total: 2 }}
      />,
    );
    expect(container.querySelector("[data-slot='terminal-status-bar-divider']")).not.toBeNull();
  });
});
