import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartTooltipContent } from "./tooltip-content";

describe("ChartTooltipContent", () => {
  const rows = [
    { color: "#4f81c4", label: "Revenue", value: 12345 },
    { color: "#e37c2f", label: "Cost", value: "9,876" },
  ];

  it("renders the title when provided", () => {
    render(<ChartTooltipContent title="Jan 2024" rows={rows} />);
    expect(screen.getByText("Jan 2024")).toBeInTheDocument();
  });

  it("renders all row labels", () => {
    render(<ChartTooltipContent rows={rows} />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
  });

  it("renders row values (numeric formatted and string verbatim)", () => {
    render(<ChartTooltipContent rows={rows} />);
    // numeric value goes through intFmt — should contain 12,345 or 12345
    expect(screen.getByText(/12[,.]?345/)).toBeInTheDocument();
    expect(screen.getByText("9,876")).toBeInTheDocument();
  });

  it("renders optional children", () => {
    render(
      <ChartTooltipContent rows={rows}>
        <div data-testid="extra-content">extra</div>
      </ChartTooltipContent>,
    );
    expect(screen.getByTestId("extra-content")).toBeInTheDocument();
  });

  it("does not render a title element when title is omitted", () => {
    const { container } = render(<ChartTooltipContent rows={rows} />);
    // no title heading present
    expect(container.querySelector(".font-medium.text-xs")).not.toBeInTheDocument();
  });
});
