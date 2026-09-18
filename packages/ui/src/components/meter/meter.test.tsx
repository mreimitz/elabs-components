import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Meter } from "./meter";

describe("Meter", () => {
  it("is a meter, not a progressbar, and exposes the range to AT", () => {
    render(<Meter aria-label="confidence" max={1} value={0.91} />);
    const el = screen.getByRole("meter", { name: "confidence" });
    expect(el).toHaveAttribute("aria-valuenow", "0.91");
    expect(el).toHaveAttribute("aria-valuemin", "0");
    expect(el).toHaveAttribute("aria-valuemax", "1");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("fills with foreground ink by default — a quantity, not a status", () => {
    const { container } = render(<Meter aria-label="share" value={40} />);
    const fill = container.querySelector('[data-slot="meter-fill"]');
    expect(fill).toHaveClass("bg-foreground");
    expect(fill).toHaveStyle({ width: "40%" });
  });

  it.each(["success", "warning", "destructive"] as const)("paints the %s tone", (variant) => {
    const { container } = render(<Meter aria-label="share" value={40} variant={variant} />);
    expect(container.querySelector('[data-slot="meter-fill"]')).toHaveClass(`bg-${variant}`);
  });

  it("clamps the fill but reports the raw value when over the ceiling", () => {
    const { container } = render(
      <Meter aria-label="spend" aria-valuetext="$612 of $500, over limit" max={500} value={612} />,
    );
    expect(container.querySelector('[data-slot="meter-fill"]')).toHaveStyle({ width: "100%" });
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "612");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "$612 of $500, over limit");
  });

  it("renders a countable strip when segments is set", () => {
    const { container } = render(<Meter aria-label="signals" max={5} segments={5} value={4} />);
    const cells = container.querySelectorAll('[data-slot="meter-cell"]');
    expect(cells).toHaveLength(5);
    expect(cells[3]).toHaveClass("bg-foreground");
    expect(cells[4]).toHaveClass("bg-muted");
    expect(container.querySelector('[data-slot="meter-fill"]')).toBeNull();
  });

  it("draws a marker tick outside the clipped track and joins markerLabel to the value text", () => {
    const { container } = render(
      <Meter aria-label="spend" marker={500} markerLabel="ceiling 500" max={800} value={612} />,
    );
    const tick = container.querySelector('[data-slot="meter-marker"]') as HTMLElement;
    expect(tick).not.toBeNull();
    expect(tick.style.insetInlineStart).toBe("62.5%");
    expect(tick.parentElement).not.toBe(screen.getByRole("meter"));
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "612, ceiling 500");
  });

  it("renders no tick and no wrapper when marker is unset", () => {
    const { container } = render(<Meter aria-label="share" value={40} />);
    expect(container.querySelector('[data-slot="meter-marker"]')).toBeNull();
    expect(container.firstElementChild).toBe(screen.getByRole("meter"));
  });
});
