import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BRAND_MARK_VIEWBOX_SIZE, BrandLogo, brandLockupWidth } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders an svg element", () => {
    const { container } = render(<BrandLogo />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("has role=img with the default accessible name 'Brand'", () => {
    render(<BrandLogo />);
    expect(screen.getByRole("img", { name: "Brand" })).toBeInTheDocument();
  });

  it("uses a custom title as the accessible name", () => {
    render(<BrandLogo title="Acme Corp" />);
    expect(screen.getByRole("img", { name: "Acme Corp" })).toBeInTheDocument();
  });

  it("renders the lockup variant (wordmark-derived viewBox) by default", () => {
    const { container } = render(<BrandLogo />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      `0 0 ${brandLockupWidth("Brand")} ${BRAND_MARK_VIEWBOX_SIZE}`,
    );
  });

  it("renders the mark variant with a square viewBox", () => {
    const { container } = render(<BrandLogo variant="mark" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      `0 0 ${BRAND_MARK_VIEWBOX_SIZE} ${BRAND_MARK_VIEWBOX_SIZE}`,
    );
  });

  it("widens the lockup viewBox for a longer wordmark", () => {
    const { container } = render(<BrandLogo title="Longer Name" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      `0 0 ${brandLockupWidth("Longer Name")} ${BRAND_MARK_VIEWBOX_SIZE}`,
    );
    expect(brandLockupWidth("Longer Name")).toBeGreaterThan(brandLockupWidth("Brand"));
  });

  it("applies the height prop, and derives width from the viewBox", () => {
    const { container } = render(<BrandLogo variant="mark" height={40} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("height")).toBe("40");
    // square mark, so width == height
    expect(svg?.getAttribute("width")).toBe("40");
  });

  it("renders the wordmark as text in the lockup variant, hidden from AT", () => {
    const { container } = render(<BrandLogo variant="lockup" title="Acme" />);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("Acme");
    // <title> already names the whole logo; the wordmark must not be announced twice.
    expect(text?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("img", { name: "Acme" })).toHaveLength(1);
  });

  it("omits the wordmark in the mark variant (glyph only)", () => {
    const { container } = render(<BrandLogo variant="mark" title="Acme" />);
    expect(container.querySelector("text")).toBeNull();
  });

  it("forces the monochrome white colorway with tone='white'", () => {
    const { container } = render(<BrandLogo variant="mark" tone="white" />);
    const style = (container.querySelector("svg") as SVGElement).getAttribute("style") ?? "";
    expect(style).toContain("--brand-mark-ring: #FFFFFF");
    expect(style).toContain("--brand-mark-tail: #FFFFFF");
  });

  /* The mark is background-adaptive ONLY because both inks resolve through
     tokens that already track the surface — a literal anywhere in here is the
     regression these tests exist to catch. */
  describe("two-ink split", () => {
    it("paints the construction square from --brand-mark-tail, falling back to --primary", () => {
      const { container } = render(<BrandLogo variant="mark" />);
      const square = container.querySelector("rect");
      expect(square?.getAttribute("fill")).toBe(
        "var(--brand-mark-tail, var(--primary, currentColor))",
      );
      expect(square?.getAttribute("stroke")).toBe(
        "var(--brand-mark-tail, var(--primary, currentColor))",
      );
      // Dashed construction line, not a solid box.
      expect(square?.getAttribute("stroke-dasharray")).toBeTruthy();
    });

    it("paints every drawn element from --brand-mark-ring, falling back to currentColor", () => {
      const { container } = render(<BrandLogo variant="mark" />);
      const ink = "var(--brand-mark-ring, currentColor)";
      // The outline circle is the only <circle> with a stroke; the register dots
      // are filled. Both are ink, and neither may carry a literal colour.
      const circles = [...container.querySelectorAll("circle")].filter(
        // the <clipPath> circle is unpainted
        (c) => c.getAttribute("stroke") !== null || c.getAttribute("fill") !== null,
      );
      expect(circles.length).toBeGreaterThan(0);
      for (const c of circles) {
        expect(c.getAttribute("stroke") ?? c.getAttribute("fill")).toBe(ink);
      }
      for (const g of container.querySelectorAll("g[stroke]")) {
        expect(g.getAttribute("stroke")).toBe(ink);
      }
    });

    it("has no literal colour anywhere in the mark", () => {
      const { container } = render(<BrandLogo variant="mark" />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
    });
  });

  describe("hatch", () => {
    it("clips the hatch to the circle it fills", () => {
      const { container } = render(<BrandLogo variant="mark" />);
      const clipId = container.querySelector("clipPath")?.getAttribute("id");
      expect(clipId).toBeTruthy();
      const hatch = container.querySelector(`g[clip-path="url(#${clipId})"]`);
      expect(hatch).not.toBeNull();
      // Derived from the circle, so it always spans it — never a hand-kept list.
      expect(hatch?.querySelectorAll("line").length).toBeGreaterThan(6);
    });

    it("gives each instance its own clip-path id", () => {
      const { container } = render(
        <>
          <BrandLogo variant="mark" title="One" />
          <BrandLogo variant="mark" title="Two" />
        </>,
      );
      const ids = [...container.querySelectorAll("clipPath")].map((c) => c.getAttribute("id"));
      expect(ids).toHaveLength(2);
      // A shared id would make the second logo clip against the first's circle.
      expect(new Set(ids).size).toBe(2);
    });
  });
});
