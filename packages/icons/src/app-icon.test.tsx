import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppIcon } from "./app-icon";

describe("AppIcon", () => {
  it("exposes a single accessible name (default 'Qlik') in auto mode", () => {
    render(<AppIcon />);
    // The wrapper carries the name; the two inner BrandLogos are aria-hidden, so
    // there is exactly one "Qlik" in the a11y tree (no duplicate label).
    expect(screen.getAllByRole("img", { name: "Qlik" })).toHaveLength(1);
  });

  it("renders BOTH marks in auto mode so they can crossfade", () => {
    const { container } = render(<AppIcon />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    const viewBoxes = Array.from(svgs).map((s) => s.getAttribute("viewBox"));
    expect(viewBoxes).toContain("119 111 662 278"); // lockup
    expect(viewBoxes).toContain("115 105 298 288"); // mark
  });

  it("wires the collapse morph to the Sidebar group-data selector", () => {
    const { container } = render(<AppIcon />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("group-data-[collapsible=icon]:w-[var(--app-icon-w-mark)]");
  });

  it("forces a single mark with morph='mark' (Q only, no morph wrapper)", () => {
    const { container } = render(<AppIcon morph="mark" title="Acme" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(svgs[0]?.getAttribute("viewBox")).toBe("115 105 298 288");
    expect(screen.getByRole("img", { name: "Acme" })).toBeInTheDocument();
  });

  it("forces the full lockup with morph='lockup'", () => {
    const { container } = render(<AppIcon morph="lockup" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(svgs[0]?.getAttribute("viewBox")).toBe("119 111 662 278");
  });

  it("applies the height prop", () => {
    const { container } = render(<AppIcon morph="lockup" height={40} />);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("40");
  });
});
