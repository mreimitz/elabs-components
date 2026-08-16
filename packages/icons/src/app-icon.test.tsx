import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppIcon } from "./app-icon";
import { BRAND_MARK_VIEWBOX_SIZE, brandLockupWidth } from "./brand-logo";

const LOCKUP_VIEWBOX = (title: string) =>
  `0 0 ${brandLockupWidth(title)} ${BRAND_MARK_VIEWBOX_SIZE}`;
const MARK_VIEWBOX = `0 0 ${BRAND_MARK_VIEWBOX_SIZE} ${BRAND_MARK_VIEWBOX_SIZE}`;

describe("AppIcon", () => {
  it("exposes a single accessible name (default 'Brand') in auto mode", () => {
    render(<AppIcon />);
    // The wrapper carries the name; the two inner BrandLogos are aria-hidden, so
    // there is exactly one "Brand" in the a11y tree (no duplicate label).
    expect(screen.getAllByRole("img", { name: "Brand" })).toHaveLength(1);
  });

  it("renders BOTH marks in auto mode so they can crossfade", () => {
    const { container } = render(<AppIcon />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    const viewBoxes = Array.from(svgs).map((s) => s.getAttribute("viewBox"));
    expect(viewBoxes).toContain(LOCKUP_VIEWBOX("Brand")); // lockup
    expect(viewBoxes).toContain(MARK_VIEWBOX); // mark
  });

  it("passes its title through to both marks, so the wordmark is the product's own", () => {
    const { container } = render(<AppIcon title="Acme" />);
    expect(container.querySelector("text")?.textContent).toBe("Acme");
    const viewBoxes = Array.from(container.querySelectorAll("svg")).map((s) =>
      s.getAttribute("viewBox"),
    );
    expect(viewBoxes).toContain(LOCKUP_VIEWBOX("Acme"));
  });

  it("wires the collapse morph to the Sidebar group-data selector", () => {
    const { container } = render(<AppIcon />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("group-data-[collapsible=icon]:w-[var(--app-icon-w-mark)]");
  });

  it("sizes the morph endpoints from the rendered geometry, not a baked ratio", () => {
    const { container } = render(<AppIcon title="Acme" height={24} />);
    const style = (container.firstElementChild as HTMLElement).getAttribute("style") ?? "";
    const expected = Math.round((24 * brandLockupWidth("Acme")) / BRAND_MARK_VIEWBOX_SIZE);
    expect(style).toContain(`--app-icon-w-lockup: ${expected}px`);
    expect(style).toContain("--app-icon-w-mark: 24px");
  });

  it("forces a single mark with morph='mark' (glyph only, no morph wrapper)", () => {
    const { container } = render(<AppIcon morph="mark" title="Acme" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(svgs[0]?.getAttribute("viewBox")).toBe(MARK_VIEWBOX);
    expect(screen.getByRole("img", { name: "Acme" })).toBeInTheDocument();
  });

  it("forces the full lockup with morph='lockup'", () => {
    const { container } = render(<AppIcon morph="lockup" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(svgs[0]?.getAttribute("viewBox")).toBe(LOCKUP_VIEWBOX("Brand"));
  });

  it("applies the height prop", () => {
    const { container } = render(<AppIcon morph="lockup" height={40} />);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("40");
  });
});
