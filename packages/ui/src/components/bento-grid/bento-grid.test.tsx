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

  it("omits the spotlight overlay by default and renders it when opted in", () => {
    const { rerender } = render(<BentoGridItem data-testid="item">x</BentoGridItem>);
    expect(screen.queryByTestId("bento-spotlight")).toBeNull();

    rerender(
      <BentoGridItem data-testid="item" spotlight>
        x
      </BentoGridItem>,
    );
    expect(screen.getByTestId("bento-spotlight")).toBeInTheDocument();
  });

  it("inherits the grid's spotlight opt-in, and a tile's own prop wins", () => {
    render(
      <BentoGrid spotlight>
        <BentoGridItem data-testid="inherited">a</BentoGridItem>
        <BentoGridItem data-testid="opted-out" spotlight={false}>
          b
        </BentoGridItem>
      </BentoGrid>,
    );
    expect(screen.getByTestId("inherited").querySelector("[data-testid=bento-spotlight]")).not.toBe(
      null,
    );
    expect(
      screen.getByTestId("opted-out").querySelector("[data-testid=bento-spotlight]"),
    ).toBeNull();
  });

  it("rests flat and lifts to a visible elevation on hover", () => {
    render(<BentoGridItem data-testid="item">x</BentoGridItem>);
    const item = screen.getByTestId("item");
    // No resting elevation — the Card `shadow-sm` is overridden down to none...
    expect(item.className).toMatch(/(?:^|\s)shadow-none(?:\s|$)/);
    expect(item.className).not.toMatch(/(?:^|\s)shadow-sm(?:\s|$)/);
    // ...and the hover state reaches a clearly readable rung of the ONE ramp.
    expect(item.className).toMatch(/hover:shadow-xl/);
    // The black-ink shadow all but vanishes on a dark ground, so the hover edge is
    // the channel that carries the lift there — it must ride the base, not the
    // `interactive` variant (a plain, non-clickable tile lifts too). It is the
    // soft `ring/40` tint, never the hard `border-strong` outline.
    expect(item.className).toMatch(/hover:border-ring\/40/);
    expect(item.className).not.toMatch(/hover:border-border-strong/);
    // ~4px of travel, neutralized (not dropped) under reduced motion.
    expect(item.className).toMatch(/hover:-translate-y-1/);
    expect(item.className).toMatch(/motion-reduce:hover:translate-y-0/);
    // Smoothness comes from the arrival curve, not from a longer duration.
    expect(item.className).toMatch(/transition-\[translate,box-shadow,border-color\]/);
    expect(item.className).toMatch(/ease-entrance/);
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
    expect(item.className).toMatch(/focus-ring-within/);
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
