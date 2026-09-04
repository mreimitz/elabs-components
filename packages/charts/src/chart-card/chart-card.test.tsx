import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartCard } from "./chart-card";

describe("ChartCard", () => {
  it("renders the title and child chart", () => {
    render(
      <ChartCard title="Monthly Revenue">
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.getByText("Monthly Revenue")).toBeInTheDocument();
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(
      <ChartCard title="Sessions" description="Last 30 days">
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("renders optional actions", () => {
    render(
      <ChartCard title="Conversions" actions={<button>Filter</button>}>
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
  });

  it("renders children inside a sized container", () => {
    render(
      <ChartCard title="KPI" height={320}>
        <div data-testid="chart-content">chart</div>
      </ChartCard>,
    );
    const content = screen.getByTestId("chart-content");
    // The sizing wrapper is the direct parent
    const wrapper = content.parentElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper?.style.height).toBe("320px");
  });

  // Loading vs ready (#268): title/description keep rendering; the body becomes
  // a layout-shaped skeleton with a single status live region.
  describe("loading", () => {
    it("keeps rendering title/description but replaces the body with a skeleton", () => {
      render(
        <ChartCard title="Monthly Revenue" description="Jan – Jun" loading>
          <div>chart content</div>
        </ChartCard>,
      );
      expect(screen.getByText("Monthly Revenue")).toBeInTheDocument();
      expect(screen.getByText("Jan – Jun")).toBeInTheDocument();
      expect(screen.queryByText("chart content")).not.toBeInTheDocument();
    });

    it("renders exactly one status live region for the not-ready state", () => {
      render(
        <ChartCard title="Monthly Revenue" loading>
          <div>chart</div>
        </ChartCard>,
      );
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    it("renders the real content (no status region) when not loading", () => {
      render(
        <ChartCard title="Monthly Revenue">
          <div>chart content</div>
        </ChartCard>,
      );
      expect(screen.getByText("chart content")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  // Card contract source row (RM-019): a fourth, optional attribution part.
  describe("source", () => {
    it("renders the source row when provided", () => {
      render(
        <ChartCard title="Monthly Revenue" source="Source: Internal analytics">
          <div>chart</div>
        </ChartCard>,
      );
      expect(screen.getByText("Source: Internal analytics")).toBeInTheDocument();
    });

    it("renders no source row when absent", () => {
      render(
        <ChartCard title="Monthly Revenue">
          <div>chart</div>
        </ChartCard>,
      );
      expect(screen.queryByText(/source/i)).not.toBeInTheDocument();
    });
  });
});
