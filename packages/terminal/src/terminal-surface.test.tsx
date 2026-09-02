import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalSurface, TERMINAL_VARIANTS, DEFAULT_TERMINAL_GUTTER } from "./terminal-surface";
import { TerminalRow } from "./terminal-row";

describe("TerminalSurface", () => {
  it("publishes its variant to every row inside", () => {
    render(
      <TerminalSurface variant="boxed">
        <TerminalRow gutter="*">output</TerminalRow>
      </TerminalSurface>,
    );

    expect(screen.getByText("output").closest("[data-slot='terminal-row']")).toHaveAttribute(
      "data-variant",
      "boxed",
    );
  });

  it("lets a row override the surface's variant", () => {
    render(
      <TerminalSurface variant="boxed">
        <TerminalRow gutter="*" variant="marker">
          output
        </TerminalRow>
      </TerminalSurface>,
    );

    expect(screen.getByText("output").closest("[data-slot='terminal-row']")).toHaveAttribute(
      "data-variant",
      "marker",
    );
  });

  it("writes --terminal-gutter, and a caller's own style still wins", () => {
    // The gutter is a LOCAL custom property, not a theme token — but it is
    // still a public seam, so a consumer must be able to widen the track for
    // a two-character marker without forking the surface.
    const { rerender } = render(<TerminalSurface data-testid="s" />);
    expect(screen.getByTestId("s").style.getPropertyValue("--terminal-gutter")).toBe(
      DEFAULT_TERMINAL_GUTTER,
    );

    rerender(<TerminalSurface data-testid="s" gutter="3rem" />);
    expect(screen.getByTestId("s").style.getPropertyValue("--terminal-gutter")).toBe("3rem");

    rerender(
      <TerminalSurface
        data-testid="s"
        gutter="3rem"
        style={{ "--terminal-gutter": "9rem" } as React.CSSProperties}
      />,
    );
    expect(screen.getByTestId("s").style.getPropertyValue("--terminal-gutter")).toBe("9rem");
  });

  describe("loading", () => {
    it("reserves layout-shaped rows behind exactly ONE live region", () => {
      const { container } = render(<TerminalSurface loading loadingRows={4} />);

      // One announcement for the whole not-ready region. A live region per
      // skeleton box floods assistive tech, which is why the boxes are
      // decorative and the region is not.
      const live = container.querySelectorAll("[role='status']");
      expect(live).toHaveLength(1);
      expect(live[0]).toHaveAttribute("aria-live", "polite");

      // The placeholders are REAL TerminalRows, so the reserved grid cannot
      // drift from the grid it stands in for.
      const rows = container.querySelectorAll("[data-slot='terminal-surface-loading-row']");
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row).toHaveAttribute("aria-hidden", "true");
      }
    });

    it("hides the real children while loading rather than stacking both", () => {
      render(<TerminalSurface loading>settled output</TerminalSurface>);
      expect(screen.queryByText("settled output")).not.toBeInTheDocument();
    });

    it("renders no live region at rest", () => {
      const { container } = render(<TerminalSurface>done</TerminalSurface>);
      expect(container.querySelector("[role='status']")).toBeNull();
    });
  });

  it("exposes every gutter grammar the row variants declare", () => {
    // Guards the surface and the row against drifting apart: a variant added
    // to one and not the other would leave a value that no surface can select.
    expect([...TERMINAL_VARIANTS]).toEqual(["marker", "rail", "boxed"]);
  });
});

describe("TerminalRow", () => {
  it("renders legibly with no surface above it", () => {
    // A row dropped outside a TerminalSurface must degrade, not break — that
    // is the difference between a surface and a required provider.
    render(<TerminalRow gutter="*">standalone</TerminalRow>);
    expect(screen.getByText("standalone").closest("[data-slot='terminal-row']")).toHaveAttribute(
      "data-variant",
      "marker",
    );
  });

  it("hides a bare gutter glyph from assistive tech", () => {
    const { container } = render(<TerminalRow gutter="◼">building</TerminalRow>);
    const glyph = container.querySelector("[data-slot='terminal-row-gutter'] [aria-hidden='true']");

    expect(glyph).toHaveTextContent("◼");
  });

  // The load-bearing accessibility assertion for the whole family. A glyph and
  // a colour are both VISUAL channels; `gutterLabel` is the third one. This
  // asserts the announced WORDS, not that two class strings differ — a
  // class-difference assertion passes on colour-only code and proves nothing.
  it.each([...TERMINAL_VARIANTS])(
    "announces the gutter's meaning as words in the %s variant",
    (variant) => {
      render(
        <TerminalRow gutter="◼" gutterLabel="in progress" variant={variant}>
          Refactor the parser
        </TerminalRow>,
      );

      expect(screen.getByText("in progress")).toBeInTheDocument();
    },
  );

  it("keeps the meaning even when the variant suppresses the glyph", () => {
    // `rail` draws a rule instead of a glyph. An earlier draft dropped the
    // sr-only label along with the glyph, which would have made the row's
    // meaning a function of its decoration in every component built on it.
    const { container } = render(
      <TerminalRow gutter="◼" gutterLabel="in progress" variant="rail">
        Refactor the parser
      </TerminalRow>,
    );

    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  it("gives the content cell a zero minimum so long content can shrink", () => {
    // Structural lock, not cosmetics: without `min-w-0` beside the grid's
    // `minmax(0,1fr)` track, a long unbroken path refuses to shrink and pushes
    // the row out of the surface instead of wrapping.
    const { container } = render(
      <TerminalRow gutter="*">/very/long/path/that/would/otherwise/overflow.tsx</TerminalRow>,
    );

    expect(container.querySelector("[data-slot='terminal-row-content']")?.className).toContain(
      "min-w-0",
    );
  });
});
