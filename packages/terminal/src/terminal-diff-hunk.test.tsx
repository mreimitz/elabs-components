/**
 * terminal-diff-hunk.test.tsx — smoke + accessibility lock for
 * `TerminalDiffHunk` (#117 T9).
 *
 * The load-bearing assertion in this file is the announced WORDS a screen
 * reader gets for `add`/`del` lines — not that two class strings differ,
 * which would pass on colour-only code and prove nothing
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel").
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DiffLine } from "@elabs-ai/components-ui";

import { TerminalDiffHunk, terminalDiffHunkLineVariants } from "./terminal-diff-hunk";

const LINES: DiffLine[] = [
  { type: "context", oldNumber: 1, newNumber: 1, text: "function greet(name) {" },
  { type: "del", oldNumber: 2, text: "  console.log('hi ' + name);" },
  { type: "add", newNumber: 2, text: "  console.log(`hi ${name}`);" },
  { type: "context", oldNumber: 3, newNumber: 3, text: "}" },
];

describe("TerminalDiffHunk", () => {
  it("renders the header naming the file", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);
    expect(screen.getByText("Update (src/greet.ts)")).toBeInTheDocument();
  });

  it("renders an optional summary line prefixed with the continuation glyph", () => {
    render(<TerminalDiffHunk file="src/greet.ts" summary="Use a template literal" lines={LINES} />);
    expect(screen.getByText("Use a template literal")).toBeInTheDocument();
    const summaryRow = screen
      .getByText("Use a template literal")
      .closest("[data-slot='terminal-diff-hunk-summary']");
    const glyph = summaryRow?.querySelector(
      "[data-slot='terminal-row-gutter'] [aria-hidden='true']",
    );
    expect(glyph).toHaveTextContent("⎿");
  });

  it("omits the summary row entirely when none is given", () => {
    const { container } = render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);
    expect(container.querySelector("[data-slot='terminal-diff-hunk-summary']")).toBeNull();
  });

  it("renders every line's text", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);
    expect(screen.getByText("function greet(name) {")).toBeInTheDocument();
    expect(screen.getByText("console.log('hi ' + name);", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("console.log(`hi ${name}`);", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("}")).toBeInTheDocument();
  });

  // The load-bearing accessibility lock for this component: the announced
  // WORD per polarity, not merely that add/del rows carry different classes.
  // Deleting `gutterLabel` from the implementation (or scrambling the
  // type→label wiring) must fail this test.
  it("announces added/removed lines as words, and announces nothing extra for context", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);

    expect(screen.getByText("Added:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Removed:", { exact: false })).toBeInTheDocument();

    const contextRow = screen
      .getByText("function greet(name) {")
      .closest("[data-slot='terminal-diff-hunk-line']");
    const contextGutter = contextRow?.querySelector("[data-slot='terminal-row-gutter']");
    expect(contextGutter?.textContent).not.toContain("Added");
    expect(contextGutter?.textContent).not.toContain("Removed");
  });

  // The header's `⏺` and the summary's `⎿` are the SAME glyphs
  // `TerminalTranscriptRow` and `TerminalToolCall` announce as "Agent" and
  // "Result". They shipped here with no `gutterLabel` at all, so a screen
  // reader heard the file name with no cue that this was an agent-authored
  // change, and heard the summary with no cue that it was a result line.
  it("announces the header and summary gutter glyphs with the family's own words", () => {
    render(<TerminalDiffHunk file="src/greet.ts" summary="2 additions, 1 removal" lines={LINES} />);

    const headerGutter = document
      .querySelector("[data-slot='terminal-diff-hunk-header']")
      ?.querySelector("[data-slot='terminal-row-gutter']");
    expect(headerGutter?.textContent).toContain("Agent");

    const summaryGutter = document
      .querySelector("[data-slot='terminal-diff-hunk-summary']")
      ?.querySelector("[data-slot='terminal-row-gutter']");
    expect(summaryGutter?.textContent).toContain("Result");
  });

  it("hides the polarity marker glyph from assistive tech but keeps it visible", () => {
    const { container } = render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);
    const gutters = [
      ...container.querySelectorAll(
        "[data-slot='terminal-diff-hunk-line'] [data-slot='terminal-row-gutter']",
      ),
    ];
    const glyphs = gutters.map(
      (gutter) => gutter.querySelector("[aria-hidden='true']")?.textContent,
    );
    // context / del / add / context, in document order.
    expect(glyphs[0]?.charCodeAt(0)).toBe(0xa0);
    expect(glyphs[1]).toBe("−");
    expect(glyphs[2]).toBe("+");
    expect(glyphs[3]?.charCodeAt(0)).toBe(0xa0);
  });

  it("renders the line number, hidden from assistive tech", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);
    const numbers = screen.getAllByText("1", {
      selector: "[data-slot='terminal-diff-hunk-line-number']",
    });
    expect(numbers[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the polarity meaning even when the surrounding variant suppresses the glyph (rail)", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} variant="rail" />);

    // `rail` suppresses the visual glyph but never the announced word.
    expect(screen.queryByText("+")).not.toBeInTheDocument();
    expect(screen.getByText("Added:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Removed:", { exact: false })).toBeInTheDocument();
  });

  it("lets a row-level override win over the ambient TerminalSurface variant", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} variant="boxed" />);
    const row = screen
      .getByText("function greet(name) {")
      .closest("[data-slot='terminal-diff-hunk-line']");
    expect(row).toHaveAttribute("data-variant", "boxed");
  });

  it("wraps long content instead of truncating it", () => {
    // Inherited from TerminalRow's grid — locked here too so a future edit
    // that swaps the content wrapper can't silently drop it.
    const longLine: DiffLine[] = [
      {
        type: "add",
        newNumber: 1,
        text: "a very long generated line that must wrap under the content column",
      },
    ];
    const { container } = render(<TerminalDiffHunk file="src/greet.ts" lines={longLine} />);
    const textCell = container.querySelector("[data-slot='terminal-diff-hunk-line-text']");
    expect(textCell?.className).toContain("min-w-0");
  });

  it("keeps the three polarity states distinguishable in greyscale, not colour alone (WCAG 1.4.1)", () => {
    expect(terminalDiffHunkLineVariants({ type: "add" })).toContain("bg-terminal-ansi-green/10");
    expect(terminalDiffHunkLineVariants({ type: "del" })).toContain("bg-terminal-ansi-red/10");
    expect(terminalDiffHunkLineVariants({ type: "context" })).not.toContain(
      "bg-terminal-ansi-green/10",
    );
    expect(terminalDiffHunkLineVariants({ type: "context" })).not.toContain(
      "bg-terminal-ansi-red/10",
    );
  });

  describe("collapsed context runs", () => {
    const LONG_CONTEXT: DiffLine[] = [
      { type: "add", newNumber: 1, text: "top of the hunk" },
      { type: "context", oldNumber: 2, newNumber: 2, text: "ctx 1" },
      { type: "context", oldNumber: 3, newNumber: 3, text: "ctx 2" },
      { type: "context", oldNumber: 4, newNumber: 4, text: "ctx 3" },
      { type: "context", oldNumber: 5, newNumber: 5, text: "ctx 4" },
      { type: "context", oldNumber: 6, newNumber: 6, text: "ctx 5" },
      { type: "context", oldNumber: 7, newNumber: 7, text: "ctx 6" },
      { type: "del", oldNumber: 8, text: "bottom of the hunk" },
    ];

    it("collapses a long context run behind a real disclosure", () => {
      render(<TerminalDiffHunk file="src/greet.ts" lines={LONG_CONTEXT} contextLines={2} />);
      expect(screen.queryByText("ctx 3")).not.toBeInTheDocument();
      const trigger = screen.getByRole("button", { name: /show \d+ more lines?/i });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("reveals the hidden lines on activation, via a real Radix Collapsible", async () => {
      const user = userEvent.setup();
      render(<TerminalDiffHunk file="src/greet.ts" lines={LONG_CONTEXT} contextLines={2} />);

      const trigger = screen.getByRole("button", { name: /show \d+ more lines?/i });
      await user.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("ctx 3")).toBeInTheDocument();
      expect(screen.getByText("ctx 4")).toBeInTheDocument();
    });

    it("does not collapse when no contextLines is given", () => {
      render(<TerminalDiffHunk file="src/greet.ts" lines={LONG_CONTEXT} />);
      expect(screen.getByText("ctx 3")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /show \d+ more lines?/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("lets a hunk render legibly with no surrounding TerminalSurface", () => {
    render(<TerminalDiffHunk file="src/greet.ts" lines={LINES} />);
    expect(
      screen.getByText("function greet(name) {").closest("[data-slot='terminal-diff-hunk-line']"),
    ).toHaveAttribute("data-variant", "marker");
  });
});
