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
  it("reserves one value box per column, so a shorter number gets no longer bar", () => {
    // Same reservation, different label lengths: the track (and therefore every
    // bar drawn in it) is the same length on both rows.
    const box = (label: string) => {
      const { container } = render(
        <BarCell value={10} label={label} domain={[0, 40]} labelWidth={7} />,
      );
      return container.querySelector<HTMLElement>('[data-slot="bar-cell-value"]')?.style.width;
    };
    expect(box("+12.5 %")).toBe("7ch");
    expect(box("-4.2 %")).toBe("7ch");
    // A slim bar sits UNDER its value and spans the cell: nothing to reserve.
    const { container } = render(
      <BarCell value={10} label="-4.2 %" domain={[0, 40]} variant="slim" labelWidth={7} />,
    );
    expect(container.querySelector<HTMLElement>('[data-slot="bar-cell-value"]')?.style.width).toBe(
      "",
    );
  });
  it("keeps the slim track off the column flex axis, so the mark has height", () => {
    // `flex-1` is `flex: 1 1 0%`: in the slim variant the parent is a COLUMN,
    // so that would resolve the track's HEIGHT to 0 and paint nothing.
    const { container } = render(
      <BarCell value={10} label="25 %" domain={[0, 40]} variant="slim" track />,
    );
    const slim = container.querySelector('[data-slot="bar-cell-track"]');
    expect(slim).toHaveClass("h-1", "w-full", "shrink-0");
    expect(slim).not.toHaveClass("flex-1");
    const { container: regular } = render(
      <BarCell value={10} label="25 %" domain={[0, 40]} track />,
    );
    const row = regular.querySelector('[data-slot="bar-cell-track"]');
    expect(row).toHaveClass("h-3", "flex-1");
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
