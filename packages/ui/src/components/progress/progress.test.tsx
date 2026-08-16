import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "./progress";
describe("Progress", () => {
  it("exposes the value to AT", () => {
    render(<Progress value={40} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  // #358 — tone variant
  it("defaults the indicator fill to bg-primary when no variant is passed", () => {
    const { container } = render(<Progress value={40} />);
    const indicator = container.querySelector('[role="progressbar"] > *');
    expect(indicator).toHaveClass("bg-primary");
    expect(indicator).not.toHaveClass("bg-destructive");
  });

  it.each(["success", "warning", "destructive"] as const)(
    "renders the %s tone as the indicator fill and not bg-primary",
    (variant) => {
      const { container } = render(<Progress value={40} variant={variant} />);
      const indicator = container.querySelector('[role="progressbar"] > *');
      expect(indicator).toHaveClass(`bg-${variant}`);
      expect(indicator).not.toHaveClass("bg-primary");
    },
  );

  it("passes aria-valuetext through to the underlying progressbar (non-color signal)", () => {
    render(<Progress value={100} variant="destructive" aria-valuetext="Exceeded — 100 of 100" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Exceeded — 100 of 100",
    );
  });
});
