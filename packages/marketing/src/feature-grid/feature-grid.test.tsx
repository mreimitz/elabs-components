import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureGrid } from "./feature-grid";

const features = [
  { title: "Fast Queries", description: "Run queries at lightning speed" },
  { title: "Secure Data", description: "Enterprise-grade security built in" },
  { title: "Easy Setup", description: "Get started in minutes" },
];

describe("FeatureGrid", () => {
  it("renders all feature titles", () => {
    render(<FeatureGrid features={features} animate={false} />);
    expect(screen.getByText("Fast Queries")).toBeInTheDocument();
    expect(screen.getByText("Secure Data")).toBeInTheDocument();
    expect(screen.getByText("Easy Setup")).toBeInTheDocument();
  });

  it("renders all feature descriptions", () => {
    render(<FeatureGrid features={features} animate={false} />);
    expect(screen.getByText("Run queries at lightning speed")).toBeInTheDocument();
    expect(screen.getByText("Enterprise-grade security built in")).toBeInTheDocument();
    expect(screen.getByText("Get started in minutes")).toBeInTheDocument();
  });

  it("renders feature titles as h3 headings", () => {
    render(<FeatureGrid features={features} animate={false} />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);
  });

  it("renders with a single feature", () => {
    render(
      <FeatureGrid
        features={[{ title: "Only Feature", description: "Just one" }]}
        animate={false}
      />,
    );
    expect(screen.getByText("Only Feature")).toBeInTheDocument();
  });

  // --- `ruled` (the hairline seam) ---
  it("is the open, gapped grid by default — no rules", () => {
    const { container } = render(<FeatureGrid features={features} animate={false} />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveClass("gap-6");
    expect(grid).not.toHaveClass("overflow-hidden");
    expect(grid.firstElementChild).not.toHaveClass("border-dashed");
  });

  it("`ruled` closes the gap and rules every cell with a dashed hairline the grid clips", () => {
    const { container } = render(<FeatureGrid features={features} animate={false} ruled />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveClass("overflow-hidden");
    expect(grid).not.toHaveClass("gap-6");
    for (const cell of Array.from(grid.children)) {
      expect(cell).toHaveClass("border-dashed", "border-rule-strong", "-ms-px", "-mt-px", "p-6");
    }
  });
});
