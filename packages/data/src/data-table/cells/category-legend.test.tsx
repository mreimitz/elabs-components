import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { colorScaleFor } from "@elabs-ai/components-ui";
import { CategoryLegend } from "./category-legend";

const regions = colorScaleFor(["North", "South", "East", "South"], {
  type: "stepped",
  palette: "categorical",
});

describe("CategoryLegend", () => {
  it("names every category beside its swatch, as one named group", () => {
    const { container } = render(<CategoryLegend scale={regions} title="Region" />);
    const group = screen.getByRole("group", { name: "Region" });
    expect(group).toBeInTheDocument();
    expect([...group.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "North",
      "South",
      "East",
    ]);
    // The swatch is the colour the cells are painted in, so a reader can match
    // the two; it is decorative because the name beside it carries the meaning.
    const swatches = container.querySelectorAll<HTMLElement>(
      '[data-slot="category-legend-swatch"]',
    );
    expect(swatches).toHaveLength(3);
    expect([...swatches].map((s) => s.style.backgroundColor)).toEqual(
      regions.categories.map((c) => c.color),
    );
    expect(swatches[0]).toHaveAttribute("aria-hidden", "true");
  });
  it("renders nothing for a scale with no categories", () => {
    const numeric = colorScaleFor([1, 2, 3], { type: "continuous" });
    const { container } = render(<CategoryLegend scale={numeric} title="Rides" />);
    expect(container.querySelector('[data-slot="category-legend"]')).toBeNull();
  });
});
