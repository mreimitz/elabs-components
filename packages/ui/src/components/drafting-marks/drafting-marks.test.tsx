import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { DraftingMarks } from "./drafting-marks";

const marks = (container: HTMLElement) =>
  container.querySelector('[data-slot="drafting-marks"]') as SVGSVGElement;

describe("DraftingMarks", () => {
  it("is decorative and inert: hidden from AT, no pointer events, absolutely positioned", () => {
    const { container } = render(<DraftingMarks />);
    const svg = marks(container);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("pointer-events-none", "absolute");
  });

  it("grows out of the top-start corner by default and mirrors for the other anchors", () => {
    const { container, rerender } = render(<DraftingMarks />);
    expect(marks(container)).toHaveAttribute("data-anchor", "top-start");
    expect(marks(container)).toHaveClass("top-0", "start-0");
    rerender(<DraftingMarks anchor="bottom-end" />);
    expect(marks(container)).toHaveClass("bottom-0", "end-0", "-scale-100");
  });

  it("inks from tokens only, and fades away from its corner", () => {
    const { container } = render(<DraftingMarks />);
    const svg = marks(container);
    expect(svg).toHaveAttribute("stroke", "var(--hairline-ink-strong)");
    expect(svg.style.maskImage).toBe("var(--drafting-marks-fade, var(--deco-fade-corner))");
    const fills = Array.from(svg.querySelectorAll("[fill]")).map((el) => el.getAttribute("fill"));
    for (const fill of fills) expect(fill).toMatch(/^(none|var\(--|url\(#)/);
  });

  it("`accent={false}` drops the two coloured accents", () => {
    const { container, rerender } = render(<DraftingMarks />);
    expect(marks(container).querySelectorAll('[fill="var(--primary)"]').length).toBe(2);
    rerender(<DraftingMarks accent={false} />);
    expect(marks(container).querySelectorAll('[fill="var(--primary)"]').length).toBe(0);
    expect(marks(container).querySelector('[fill="var(--chart-2)"]')).toBeNull();
  });

  it("gives each instance its own dot-pattern id, forwards the ref and merges className", () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(
      <div>
        <DraftingMarks ref={ref} className="opacity-60" />
        <DraftingMarks />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll("pattern")).map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    expect(ref.current).toBe(container.querySelector("svg"));
    expect(ref.current).toHaveClass("opacity-60");
  });
});
