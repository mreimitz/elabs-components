import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BentoGrid, BentoGridItem } from "./bento-grid";

describe("BentoGrid", () => {
  it("renders a grid container with its children", () => {
    render(
      <BentoGrid data-testid="grid">
        <BentoGridItem>A</BentoGridItem>
        <BentoGridItem>B</BentoGridItem>
      </BentoGrid>,
    );
    const grid = screen.getByTestId("grid");
    expect(grid).toBeInTheDocument();
    expect(grid.className).toMatch(/grid/);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});

describe("BentoGridItem", () => {
  it("applies the hero size as a 2x2 span", () => {
    render(
      <BentoGridItem size="hero" data-testid="item">
        hero
      </BentoGridItem>,
    );
    const item = screen.getByTestId("item");
    expect(item.style.gridColumn).toContain("span 2");
    expect(item.style.gridRow).toContain("span 2");
  });

  it("lets an explicit span override the size preset", () => {
    render(
      <BentoGridItem size="sm" span={{ col: 3 }} data-testid="item">
        wide
      </BentoGridItem>,
    );
    const item = screen.getByTestId("item");
    expect(item.style.gridColumn).toContain("span 3");
    // size sm had row 1 → no row span emitted
    expect(item.style.gridRow).toBe("");
  });

  it("renders the spotlight overlay by default and omits it when spotlight is false", () => {
    const { rerender } = render(<BentoGridItem data-testid="item">x</BentoGridItem>);
    expect(screen.getByTestId("bento-spotlight")).toBeInTheDocument();

    rerender(
      <BentoGridItem data-testid="item" spotlight={false}>
        x
      </BentoGridItem>,
    );
    expect(screen.queryByTestId("bento-spotlight")).toBeNull();
  });

  it("supports the stretched-link pattern with a focus-within ring when interactive", () => {
    render(
      <BentoGridItem size="hero" interactive data-testid="item">
        <a href="#go" aria-label="go" className="absolute inset-0" />
        content
      </BentoGridItem>,
    );
    // The tile stays a div; the inner anchor is the focusable element.
    const item = screen.getByTestId("item");
    expect(item.tagName).toBe("DIV");
    expect(item.className).toMatch(/focus-within:ring/);
    expect(screen.getByRole("link", { name: "go" })).toBeInTheDocument();
  });

  it("hero tiles carry the gradient emphasis wash", () => {
    render(
      <BentoGridItem size="hero" data-testid="item">
        hero
      </BentoGridItem>,
    );
    expect(screen.getByTestId("item").className).toMatch(/from-primary/);
  });
});
