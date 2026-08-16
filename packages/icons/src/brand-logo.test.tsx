import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders an svg element", () => {
    const { container } = render(<BrandLogo />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("has role=img with the default accessible name 'Qlik'", () => {
    render(<BrandLogo />);
    expect(screen.getByRole("img", { name: "Qlik" })).toBeInTheDocument();
  });

  it("uses a custom title as the accessible name", () => {
    render(<BrandLogo title="Acme Corp" />);
    expect(screen.getByRole("img", { name: "Acme Corp" })).toBeInTheDocument();
  });

  it("renders the lockup variant (wider viewBox) by default", () => {
    const { container } = render(<BrandLogo />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("119 111 662 278");
  });

  it("renders the mark variant (Q-glyph viewBox)", () => {
    const { container } = render(<BrandLogo variant="mark" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("115 105 298 288");
  });

  it("applies the height prop", () => {
    const { container } = render(<BrandLogo height={40} />);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("40");
  });

  it("renders the 'lik' wordmark letterforms in the lockup variant", () => {
    const { container } = render(<BrandLogo variant="lockup" />);
    // the lockup adds the "lik" letterforms (rects + a dot circle) on top of the Q glyph
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
  });

  it("omits the wordmark letterforms in the mark variant (Q only)", () => {
    const { container } = render(<BrandLogo variant="mark" />);
    expect(container.querySelector("rect")).toBeNull();
  });
});
