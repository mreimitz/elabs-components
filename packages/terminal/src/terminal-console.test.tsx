/**
 * terminal-console.test.tsx — smoke + structural lock for the console FRAME
 * (ADR 0033, `docs/ADR/0033-terminal-console-frame-and-regions.md`).
 *
 * The load-bearing assertion here is that `TerminalConsole` draws the edge
 * exactly once and `TerminalSurface` omits its own frame classes the moment
 * it sits inside one — not merely that two class strings differ, but that
 * the SPECIFIC frame declarations (`rounded-lg`, a standalone `border`,
 * `shadow-sm`) move from the region to the frame, and that a standalone
 * `TerminalSurface` is completely unaffected.
 */
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TerminalConsole } from "./terminal-console";
import { TerminalRow } from "./terminal-row";
import { TerminalSurface } from "./terminal-surface";

/** Whole-token class check — a substring match would also accept `border-t`. */
function hasClass(el: Element, token: string) {
  return el.className.split(/\s+/).includes(token);
}

describe("TerminalConsole", () => {
  it("draws the frame: radius, border, ground and a resting shadow", () => {
    render(<TerminalConsole data-testid="console">content</TerminalConsole>);
    const el = screen.getByTestId("console");
    expect(hasClass(el, "rounded-lg")).toBe(true);
    expect(hasClass(el, "border")).toBe(true);
    expect(hasClass(el, "shadow-sm")).toBe(true);
    expect(el).toHaveAttribute("data-slot", "terminal-console");
  });

  it("owns the seam between adjacent regions, not a gap of page background", () => {
    render(<TerminalConsole data-testid="console">content</TerminalConsole>);
    // Structural lock: the seam rule targets every child after the first.
    // jsdom cannot resolve the `:has`/sibling selector's rendered effect, so
    // this asserts the class is actually declared on the frame.
    expect(screen.getByTestId("console").className).toContain("[&>*+*]:border-t");
  });

  it("forwards a ref to the frame's root element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<TerminalConsole ref={ref}>content</TerminalConsole>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute("data-slot", "terminal-console");
  });

  it("merges a caller className with cn(), caller last", () => {
    render(
      <TerminalConsole data-testid="console" className="max-w-xl">
        content
      </TerminalConsole>,
    );
    expect(hasClass(screen.getByTestId("console"), "max-w-xl")).toBe(true);
  });

  describe("frame-awareness in TerminalSurface", () => {
    it("omits the region's own frame classes and adds an inset ring inside a console", () => {
      render(
        <TerminalConsole>
          <TerminalSurface data-testid="region">
            <TerminalRow gutter="*">output</TerminalRow>
          </TerminalSurface>
        </TerminalConsole>,
      );
      const region = screen.getByTestId("region");
      // Omitted, not negated: no `rounded-none border-0 shadow-none` either.
      expect(hasClass(region, "rounded-lg")).toBe(false);
      expect(hasClass(region, "border")).toBe(false);
      expect(hasClass(region, "shadow-sm")).toBe(false);
      expect(hasClass(region, "rounded-none")).toBe(false);
      expect(hasClass(region, "border-0")).toBe(false);
      expect(hasClass(region, "shadow-none")).toBe(false);
      expect(hasClass(region, "ring-inset")).toBe(true);
      // The ground ink, type role and gutter grid are unchanged.
      expect(hasClass(region, "text-terminal-foreground")).toBe(true);
      expect(hasClass(region, "text-code")).toBe(true);
      expect(hasClass(region, "font-mono")).toBe(true);
    });

    it("leaves a standalone TerminalSurface completely unchanged", () => {
      render(
        <TerminalSurface data-testid="standalone">
          <TerminalRow gutter="*">output</TerminalRow>
        </TerminalSurface>,
      );
      const standalone = screen.getByTestId("standalone");
      expect(hasClass(standalone, "rounded-lg")).toBe(true);
      expect(hasClass(standalone, "border")).toBe(true);
      expect(hasClass(standalone, "shadow-sm")).toBe(true);
      expect(hasClass(standalone, "ring-inset")).toBe(false);
    });

    it("lets a caller re-add a frame to a region via className, resolved by cn()", () => {
      render(
        <TerminalConsole>
          <TerminalSurface data-testid="region" className="rounded-lg border shadow-sm">
            content
          </TerminalSurface>
        </TerminalConsole>,
      );
      const region = screen.getByTestId("region");
      expect(hasClass(region, "rounded-lg")).toBe(true);
      expect(hasClass(region, "border")).toBe(true);
      expect(hasClass(region, "shadow-sm")).toBe(true);
    });
  });
});
