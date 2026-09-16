import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

    // #184: a source that overflows its row must stay recoverable in full —
    // by hover (native `title`) at minimum, by keyboard (the tab stop + the
    // accessible Tooltip) once it measurably overflows. A source that FITS
    // must gain neither, or a short caption would grow a spurious tooltip.
    describe("overflow recovery (#184)", () => {
      const longSource =
        "Source: Internal analytics platform, aggregated nightly from three regional warehouses";

      it("sets a native title on a string source so it is recoverable by hover even before it is measured", () => {
        render(
          <ChartCard title="Monthly Revenue" source={longSource}>
            <div>chart</div>
          </ChartCard>,
        );
        expect(screen.getByText(longSource)).toHaveAttribute("title", longSource);
      });

      it("adds no tab stop for a source that fits its row", () => {
        render(
          <ChartCard title="Monthly Revenue" source="Short source">
            <div>chart</div>
          </ChartCard>,
        );
        const row = screen.getByText("Short source");
        // jsdom reports 0 for scrollWidth/clientWidth, i.e. never overflowing.
        expect(row).not.toHaveAttribute("tabindex");
        expect(row).not.toHaveAttribute("aria-describedby");
      });

      it("gains a tab stop and a keyboard-reachable tooltip once the row measurably overflows", () => {
        const { rerender } = render(
          <ChartCard title="Monthly Revenue" source={longSource}>
            <div>chart</div>
          </ChartCard>,
        );
        const row = screen.getByText(longSource);
        // jsdom never lays out real text, so overflow is simulated — same
        // idiom as `packages/ui/src/components/table/table.test.tsx`.
        Object.defineProperty(row, "scrollWidth", { configurable: true, value: 900 });
        Object.defineProperty(row, "clientWidth", { configurable: true, value: 240 });
        // No dependency array on the row's measuring effect: any re-render
        // re-measures, so re-rendering with the same props is enough to pick
        // up the metrics just set on the (unchanged) DOM node.
        rerender(
          <ChartCard title="Monthly Revenue" source={longSource}>
            <div>chart</div>
          </ChartCard>,
        );
        expect(row).toHaveAttribute("tabindex", "0");
        expect(row).toHaveAttribute("title", longSource);

        // Radix only wires `aria-describedby` up while the tooltip is open —
        // a keyboard user reaches that by focusing the (now-focusable) row.
        fireEvent.focus(row);
        const describedBy = row.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy!)).toHaveTextContent(longSource);
      });

      it("keeps caps CSS-driven, not literal uppercase in the DOM, and keeps the row a <p>", () => {
        render(
          <ChartCard title="Monthly Revenue" source="source: mixed Case Text">
            <div>chart</div>
          </ChartCard>,
        );
        const row = screen.getByText("source: mixed Case Text");
        expect(row.tagName).toBe("P");
        expect(row.textContent).toBe("source: mixed Case Text");
      });
    });
  });
});
