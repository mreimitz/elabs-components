import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "../metric-card";
import { MetricGrid } from "./metric-grid";

describe("MetricGrid", () => {
  it("renders children", () => {
    render(
      <MetricGrid>
        <div>Tile A</div>
        <div>Tile B</div>
      </MetricGrid>,
    );
    expect(screen.getByText("Tile A")).toBeInTheDocument();
    expect(screen.getByText("Tile B")).toBeInTheDocument();
  });

  it("defaults to a grid wrapper (no reveal)", () => {
    render(
      <MetricGrid>
        <div data-testid="child">child</div>
      </MetricGrid>,
    );
    const child = screen.getByTestId("child");
    // The grid div is the direct parent of children when reveal=false
    expect(child.parentElement?.tagName).toBe("DIV");
  });

  it("applies custom className", () => {
    render(
      <MetricGrid className="custom-class">
        <div>item</div>
      </MetricGrid>,
    );
    expect(screen.getByText("item").parentElement).toHaveClass("custom-class");
  });

  // featured axis (#191, research 11 §B.5 KPI-2): one tile spans wider, no
  // wrapper element — the span class lands on the tile itself.
  it("spans the featured tile without adding a wrapper element", () => {
    render(
      <MetricGrid featured={0}>
        <div data-testid="first">Tile A</div>
        <div data-testid="second">Tile B</div>
      </MetricGrid>,
    );
    expect(screen.getByTestId("first")).toHaveClass("sm:col-span-2");
    expect(screen.getByTestId("second")).not.toHaveClass("sm:col-span-2");
    expect(screen.getByTestId("first").parentElement).toHaveClass("grid");
  });

  it("caps the featured span at the grid's column count", () => {
    render(
      <MetricGrid columns={2} featured={1} featuredSpan={3}>
        <div>Tile A</div>
        <div data-testid="featured">Tile B</div>
      </MetricGrid>,
    );
    const featured = screen.getByTestId("featured");
    expect(featured).toHaveClass("sm:col-span-2");
    expect(featured.className).not.toContain("lg:col-span-3");
  });

  // Loading vs ready (#268): forwards `loading` to each real tile, and reserves
  // the grid's final shape with placeholders when no tiles exist yet.
  describe("loading", () => {
    it("forwards loading to each child MetricCard, hiding its real content", () => {
      render(
        <MetricGrid loading>
          <MetricCard label="Active users" value="24,512" />
          <MetricCard label="MRR" value="$84.2k" />
        </MetricGrid>,
      );
      expect(screen.queryByText("Active users")).not.toBeInTheDocument();
      expect(screen.queryByText("24,512")).not.toBeInTheDocument();
      expect(screen.queryByText("MRR")).not.toBeInTheDocument();
    });

    it("renders `columns` placeholder tiles when loading with no children", () => {
      render(<MetricGrid columns={3} loading />);
      // Skeleton primitive marks its box aria-hidden; only the region's own
      // status node should be exposed to AT.
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    it("renders exactly one status live region for the whole grid, not per tile", () => {
      render(
        <MetricGrid loading>
          <MetricCard label="Active users" value="24,512" />
          <MetricCard label="MRR" value="$84.2k" />
        </MetricGrid>,
      );
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    // Regression: the `reveal` branch used to spread role="status" onto
    // RevealGroup without ever rendering the sr-only announcement into it, so
    // the live region had no accessible name for AT (loading-states.md §a11y).
    it("announces loading via an accessible name when reveal is combined with loading", () => {
      render(
        <MetricGrid reveal loading>
          <MetricCard label="Active users" value="24,512" />
          <MetricCard label="MRR" value="$84.2k" />
        </MetricGrid>,
      );
      expect(screen.getByRole("status", { name: /loading metrics/i })).toBeInTheDocument();
    });

    // Regression: MetricGrid used to `cloneElement` the `loading`/
    // `announceLoading` pair onto EVERY valid-element child, not only
    // MetricCards. `children` is typed `ReactNode`, so a plain element (a
    // wrapping `<div>`/`<a>`, per the documented contract) received both as
    // unknown DOM attributes, producing React console warnings.
    it("does not forward loading/announceLoading onto a non-MetricCard child", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <MetricGrid loading>
          <div data-testid="plain">not a MetricCard</div>
        </MetricGrid>,
      );
      const plain = screen.getByTestId("plain");
      expect(plain).not.toHaveAttribute("loading");
      expect(plain).not.toHaveAttribute("announceLoading");
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("renders real content (no status region) when not loading", () => {
      render(
        <MetricGrid>
          <MetricCard label="Active users" value="24,512" />
        </MetricGrid>,
      );
      expect(screen.getByText("Active users")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
