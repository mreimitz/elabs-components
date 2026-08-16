/**
 * PieChart smoke tests.
 *
 * PieChart uses @visx/responsive ParentSize (ResizeObserver) and SVG geometry
 * measurement — both unavailable in jsdom. We mock @visx/responsive so
 * ParentSize renders its children with a fixed size, matching the pattern used
 * by @qlik-coe-emea/qlabs-components-flow tests that mock @xyflow/react internals.
 *
 * Real render + interaction fidelity is covered by the Storybook story build
 * (pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook, story id: charts-piechart--default).
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";

// Provide a fixed 300×300 viewport so PieChartInner renders (size >= 10)
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 300, height: 300 }),
}));

// Shim ResizeObserver (jsdom omits it; @visx/responsive needs it at module load)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const sampleData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
];

describe("PieChart", () => {
  it("exports PieChart as a renderable component (forwardRef returns an object)", () => {
    // React.forwardRef returns an object with $$typeof, not a plain function.
    // Verify it is truthy and has a displayName so the module contract holds.
    expect(PieChart).toBeTruthy();
    expect(PieChart.displayName).toBe("PieChart");
  });

  it("mounts and renders a container div", () => {
    const { container } = render(
      <PieChart data={sampleData}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with a fixed size prop", () => {
    const { container } = render(
      <PieChart data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.style.width).toBe("280px");
    expect(root.style.height).toBe("280px");
  });

  it("forwards a ref to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <PieChart data={sampleData} ref={ref} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("merges a custom className", () => {
    const { container } = render(
      <PieChart className="my-custom-class" data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains("my-custom-class")).toBe(true);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided (fixed size)", () => {
    const { container } = render(
      <PieChart
        data={sampleData}
        size={280}
        accessibleLabel="Revenue by channel pie chart"
        accessibleDescription="Slices: Direct 320, Organic 280, Referral 190."
      >
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Revenue by channel pie chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
    expect(descSpan?.textContent).toBe("Slices: Direct 320, Organic 280, Referral 190.");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <PieChart data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
  });
});
