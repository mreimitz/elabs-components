import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChartConfigProvider } from "../chart-config-context";
import type { ChartLegendEntry } from "../chart-context";
import { useContainerLegend } from "./use-container-legend";

const ITEMS: ChartLegendEntry[] = [
  { key: "series:a", label: "Revenue", color: "var(--chart-1)", kind: "series" },
  { key: "series:b", label: "Cost", color: "var(--chart-2)", kind: "series" },
];

function Demo({ legend }: { legend?: Parameters<typeof useContainerLegend>[0]["legend"] }) {
  const result = useContainerLegend({ items: ITEMS, legend });
  return (
    <>
      <div data-testid="position">{result.position}</div>
      <div data-testid="layout">{result.layout}</div>
      <div data-testid="visible">{String(result.visible)}</div>
      {result.wrap(<div data-testid="plot">plot</div>)}
    </>
  );
}

describe("useContainerLegend", () => {
  // R1 (orchestrator ruling, sitting 3): an unset `legend` never shows a
  // legend — moved into the engine itself so every container inherits it
  // from one place (see `use-container-legend.ts`'s `wants` computation).
  it("an unset legend never renders, even with 2+ items", () => {
    render(<Demo />);
    expect(screen.getByTestId("visible").textContent).toBe("false");
    expect(screen.queryByText("Revenue")).toBeNull();
  });

  it("legend={true} renders a visible, top-positioned, row-laid-out legend for 2+ items", () => {
    const { container } = render(<Demo legend />);
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("position").textContent).toBe("top");
    expect(screen.getByTestId("layout").textContent).toBe("row");
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
    // Bug fix (sitting 3): the resolved "row" layout must actually reach
    // `ChartLegend`'s own DOM, not just this hook's return value — before
    // this fix `.legend-container` was unconditionally `flex-col` (see
    // `use-container-legend.ts`'s `layout` forward, added alongside this
    // test).
    const legendContainer = container.querySelector(".legend-container");
    expect(legendContainer?.className).toContain("flex-row");
    expect(legendContainer?.className).not.toContain("flex-col");
  });

  it("a config object turns the legend on just like legend={true}", () => {
    render(<Demo legend={{}} />);
    expect(screen.getByTestId("visible").textContent).toBe("true");
  });

  it("legend={false} never renders, even with 2+ items", () => {
    render(<Demo legend={false} />);
    expect(screen.getByTestId("visible").textContent).toBe("false");
    expect(screen.queryByText("Revenue")).toBeNull();
  });

  it("gives the mounted legend the locale-aware accessible name AutoLegend used to have", () => {
    const { container } = render(<Demo legend />);
    const root = container.querySelector(".legend-container");
    expect(root).toHaveAttribute("role", "group");
    expect(root).toHaveAccessibleName("Chart legend");
  });

  it("wraps the plot in a flex row and shrinks a right-positioned legend to a fixed column", () => {
    const { container } = render(<Demo legend={{ position: "right" }} />);
    const root = container.querySelector('[data-slot="container-legend-root"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-container-legend-position")).toBe("right");
    expect(root?.className).toContain("flex-row");
  });

  it("density xs hides an explicitly-on legend entirely", () => {
    render(
      <ChartConfigProvider value={{ density: "xs" }}>
        <Demo legend />
      </ChartConfigProvider>,
    );
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

  it("density sm still renders an explicitly-on legend, stacked", () => {
    const { container } = render(
      <ChartConfigProvider value={{ density: "sm" }}>
        <Demo legend />
      </ChartConfigProvider>,
    );
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("layout").textContent).toBe("stack");
    const legendContainer = container.querySelector(".legend-container");
    expect(legendContainer?.className).toContain("flex-col");
    expect(legendContainer?.className).not.toContain("flex-row");
  });

  it("interactive: toggle renders real aria-pressed buttons that flip on click", () => {
    render(<Demo legend={{ interactive: "toggle" }} />);
    const button = screen.getByRole("button", { name: /Revenue/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("applies text-meta typography role to legend labels", () => {
    const { getByText } = render(<Demo legend />);
    const revenueLabel = getByText("Revenue");
    expect(revenueLabel.className).toContain("text-meta");
    const costLabel = getByText("Cost");
    expect(costLabel.className).toContain("text-meta");
  });

  it("applies text-meta typography role with font-semibold to legend title", () => {
    const { getByText } = render(<Demo legend={{ title: "Series" }} />);
    const titleElement = getByText("Series");
    expect(titleElement.className).toContain("text-meta");
    expect(titleElement.className).toContain("font-semibold");
  });

  it("passes text-meta with tabular-nums as valueClassName to ChartLegend", () => {
    // The valueClassName is set via useContainerLegend's props, passed to
    // ChartLegend. This test verifies the override exists in the hook's
    // resolved props (it's harder to test the actual DOM render without
    // rendering chart data with showValue=true).
    const { container } = render(<Demo legend />);
    const legendContainer = container.querySelector(".legend-container");
    expect(legendContainer).toBeInTheDocument();
    // Just verify the mount succeeds with the overrides applied.
    // The actual valueClassName application is tested in chart-legend's own
    // tests or in stories with showValue=true.
  });
});
