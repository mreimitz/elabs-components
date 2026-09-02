/**
 * terminal-transcript-row.test.tsx — smoke + accessibility lock for one
 * agent-transcript line (#117 T2).
 *
 * The load-bearing assertion in this file is the announced WORDS a screen
 * reader gets for each `kind` — not that two class strings differ, which
 * would pass on colour-only code and prove nothing
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel").
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TERMINAL_TRANSCRIPT_ROW_KINDS,
  TerminalTranscriptRow,
  type TerminalTranscriptRowKind,
} from "./terminal-transcript-row";

describe("TerminalTranscriptRow", () => {
  it("defaults to the user kind", () => {
    render(<TerminalTranscriptRow>pnpm build</TerminalTranscriptRow>);
    expect(
      screen.getByText("pnpm build").closest("[data-slot='terminal-transcript-row']"),
    ).toHaveAttribute("data-kind", "user");
  });

  it("renders every kind's meaning as announced words, not just as colour or glyph", () => {
    // This is the accessibility lock for the whole component: it asserts the
    // WORDS a screen reader gets, in every kind. Deleting `gutterLabel` from
    // the implementation (or scrambling the kind→label map) must fail this
    // test — verified by hand while authoring it (see PR/session notes).
    const expected: Record<TerminalTranscriptRowKind, string> = {
      user: "Prompt",
      agent: "Agent",
      output: "Output",
      error: "Error",
    };

    for (const kind of TERMINAL_TRANSCRIPT_ROW_KINDS) {
      const { unmount } = render(
        <TerminalTranscriptRow kind={kind}>line for {kind}</TerminalTranscriptRow>,
      );
      expect(screen.getByText(expected[kind])).toBeInTheDocument();
      unmount();
    }
  });

  it("hides the gutter glyph from assistive tech but keeps it visible", () => {
    const { container } = render(
      <TerminalTranscriptRow kind="agent">did a thing</TerminalTranscriptRow>,
    );
    const glyph = container.querySelector("[data-slot='terminal-row-gutter'] [aria-hidden='true']");
    expect(glyph).toHaveTextContent("⏺");
  });

  it("gives error, and only error, role=alert", () => {
    const { rerender, getByText } = render(
      <TerminalTranscriptRow kind="error">Build failed</TerminalTranscriptRow>,
    );
    expect(getByText("Build failed").closest("[role='alert']")).not.toBeNull();

    for (const kind of ["user", "agent", "output"] as const) {
      rerender(<TerminalTranscriptRow kind={kind}>line</TerminalTranscriptRow>);
      expect(getByText("line").closest("[role='alert']")).toBeNull();
    }
  });

  it("lets a caller override role explicitly", () => {
    render(
      <TerminalTranscriptRow kind="error" role="status">
        settled, but the caller wants status semantics
      </TerminalTranscriptRow>,
    );
    expect(
      screen.getByText("settled, but the caller wants status semantics").closest("[role='status']"),
    ).not.toBeNull();
  });

  describe("exitCode", () => {
    it("renders the exit affordance on output and error kinds", () => {
      render(
        <TerminalTranscriptRow kind="error" exitCode={1}>
          Build failed
        </TerminalTranscriptRow>,
      );
      expect(screen.getByText("Exit 1")).toBeInTheDocument();
    });

    it("stays silent when exitCode is not given", () => {
      const { container } = render(
        <TerminalTranscriptRow kind="output">quiet</TerminalTranscriptRow>,
      );
      expect(container.querySelector("[data-slot='terminal-transcript-row-exit-code']")).toBeNull();
    });

    it("ignores exitCode on kinds that carry no exit status", () => {
      const { container } = render(
        <TerminalTranscriptRow kind="user" exitCode={0}>
          pnpm build
        </TerminalTranscriptRow>,
      );
      expect(container.querySelector("[data-slot='terminal-transcript-row-exit-code']")).toBeNull();
    });

    it("renders exit 0 too — a falsy-but-valid code must not be treated as absent", () => {
      render(
        <TerminalTranscriptRow kind="output" exitCode={0}>
          done
        </TerminalTranscriptRow>,
      );
      expect(screen.getByText("Exit 0")).toBeInTheDocument();
    });
  });

  it("wraps long content instead of truncating it", () => {
    // Inherited from TerminalRow's grid — locked here too so a future edit
    // that swaps the content wrapper can't silently drop it.
    const { container } = render(
      <TerminalTranscriptRow kind="output">
        a very long line of program output that must wrap under the gutter column
      </TerminalTranscriptRow>,
    );
    expect(container.querySelector("[data-slot='terminal-row-content']")?.className).toContain(
      "min-w-0",
    );
  });

  it("lets a row render legibly with no surrounding TerminalSurface", () => {
    render(<TerminalTranscriptRow kind="agent">standalone</TerminalTranscriptRow>);
    expect(
      screen.getByText("standalone").closest("[data-slot='terminal-transcript-row']"),
    ).toHaveAttribute("data-variant", "marker");
  });
});
