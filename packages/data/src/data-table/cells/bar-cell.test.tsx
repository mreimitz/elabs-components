import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BAR_CELL_NEGATIVE_COLOR, BAR_CELL_POSITIVE_COLOR, BarCell } from "./bar-cell";

describe("BarCell", () => {
  it("keeps the printed value and sizes the bar against the domain", () => {
    const { container, getByText } = render(
      <BarCell value={20} label="20" domain={[0, 40]} track />,
    );
    expect(getByText("20")).toBeInTheDocument();
    const bar = container.querySelector<HTMLElement>('[data-slot="bar-cell-bar"]');
    expect(bar?.style.width).toBe("50%");
    expect(bar?.style.backgroundColor).toBe(BAR_CELL_POSITIVE_COLOR);
    expect(container.querySelector('[data-slot="bar-cell-track"]')).toHaveClass("bg-muted");
  });
  it("paints a negative value in the negative token, left of zero, with a zero rule", () => {
    const { container } = render(<BarCell value={-5} label="-5" domain={[-5, 20]} />);
    const bar = container.querySelector<HTMLElement>('[data-slot="bar-cell-bar"]');
    expect(bar?.style.backgroundColor).toBe(BAR_CELL_NEGATIVE_COLOR);
    expect(bar?.style.insetInlineStart).toBe("0%");
    expect(bar?.style.width).toBe("20%");
    expect(container.querySelector('[data-slot="bar-cell-zero"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="bar-cell"]')).toHaveAttribute(
      "data-negative",
      "true",
    );
  });
  it("uses a category colour for positive bars; negative: false keeps it on negatives", () => {
    const { container } = render(
      <BarCell
        value={-2}
        label="-2"
        domain={[-5, 5]}
        fillColor="var(--chart-3)"
        negativeColor={false}
      />,
    );
    expect(
      container.querySelector<HTMLElement>('[data-slot="bar-cell-bar"]')?.style.backgroundColor,
    ).toBe("var(--chart-3)");
  });
});
