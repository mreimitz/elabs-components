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

  // marker (pace / target reference tick)
  it("renders no tick and leaves the DOM unchanged when marker is unset", () => {
    const { container } = render(<Progress value={40} />);
    expect(container.querySelector('[data-slot="progress-marker"]')).toBeNull();
    // The Indicator stays the progressbar's direct child (no wrapper added).
    const directChild = container.querySelector('[role="progressbar"] > *');
    expect(directChild).toHaveAttribute("data-slot", "progress-indicator");
  });

  it("positions the tick at marker% via insetInlineStart", () => {
    const { container } = render(<Progress value={40} marker={70} />);
    const tick = container.querySelector('[data-slot="progress-marker"]');
    expect(tick).toHaveStyle({ insetInlineStart: "70%" });
  });

  it("clamps marker to 0–100", () => {
    const { container } = render(<Progress value={40} marker={140} />);
    const tick = container.querySelector('[data-slot="progress-marker"]');
    expect(tick).toHaveStyle({ insetInlineStart: "100%" });
  });

  it("is decorative and leaves aria-valuetext unchanged when markerLabel is absent", () => {
    render(<Progress value={62} marker={70} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).not.toHaveAttribute("aria-valuetext");
  });

  it("composes aria-valuetext from value + markerLabel when both marker and markerLabel are set", () => {
    render(<Progress value={62} marker={70} markerLabel="expected 70% by today" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "62%, expected 70% by today",
    );
  });

  it("lets a caller-supplied aria-valuetext win over the composed marker text", () => {
    render(
      <Progress
        aria-valuetext="Custom text"
        marker={70}
        markerLabel="expected 70% by today"
        value={62}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Custom text");
  });
});
