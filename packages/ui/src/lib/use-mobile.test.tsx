import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsMobile } from "./use-mobile";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe("useIsMobile", () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  it("reports the correct value on the very first render — no desktop flash", () => {
    setViewportWidth(500);
    const renderedValues: boolean[] = [];
    function Probe() {
      const isMobile = useIsMobile();
      renderedValues.push(isMobile);
      return <span>{String(isMobile)}</span>;
    }
    render(<Probe />);

    // A stale `false` in the recorded renders means the mobile viewport
    // still rendered the desktop layout for at least one paint before the
    // effect corrected it — i.e. a flash.
    expect(renderedValues.length).toBeGreaterThan(0);
    expect(renderedValues.every((value) => value === true)).toBe(true);
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("reports false on a desktop-width viewport", () => {
    setViewportWidth(1280);
    function Probe() {
      const isMobile = useIsMobile();
      return <span>{String(isMobile)}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });
});
