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
  it("defaults to a visible, top-positioned, row-laid-out legend for 2+ items", () => {
    render(<Demo />);
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("position").textContent).toBe("top");
    expect(screen.getByTestId("layout").textContent).toBe("row");
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
  });

  it("legend={false} never renders, even with 2+ items", () => {
    render(<Demo legend={false} />);
    expect(screen.getByTestId("visible").textContent).toBe("false");
    expect(screen.queryByText("Revenue")).toBeNull();
  });

  it("wraps the plot in a flex row and shrinks a right-positioned legend to a fixed column", () => {
    const { container } = render(<Demo legend={{ position: "right" }} />);
    const root = container.querySelector('[data-slot="container-legend-root"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-container-legend-position")).toBe("right");
    expect(root?.className).toContain("flex-row");
  });

  it("density xs hides the legend entirely", () => {
    render(
      <ChartConfigProvider value={{ density: "xs" }}>
        <Demo />
      </ChartConfigProvider>,
    );
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

  it("density sm still renders, stacked", () => {
    render(
      <ChartConfigProvider value={{ density: "sm" }}>
        <Demo />
      </ChartConfigProvider>,
    );
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("layout").textContent).toBe("stack");
  });

  it("interactive: toggle renders real aria-pressed buttons that flip on click", () => {
    render(<Demo legend={{ interactive: "toggle" }} />);
    const button = screen.getByRole("button", { name: /Revenue/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
