import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ColumnsCell } from "./columns-cell";

describe("ColumnsCell", () => {
  it("draws one column per present value from a zero rule, heights never negative", () => {
    const { container, getByText } = render(
      <ColumnsCell
        values={[
          { key: "q1", value: 2 },
          { key: "q2", value: null },
          { key: "q3", value: -1 },
        ]}
        domain={{ min: -1, max: 4 }}
        label="2, –, -1"
        height={20}
      />,
    );
    expect(getByText("2, –, -1")).toHaveClass("sr-only");
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(2);
    rects.forEach((r) => expect(Number(r.getAttribute("height"))).toBeGreaterThanOrEqual(0));
    // 2 on [-1, 4] over 20 px → 8 px tall; -1 → 4 px.
    expect(Number(rects[0]?.getAttribute("height"))).toBeCloseTo(8);
    expect(Number(rects[1]?.getAttribute("height"))).toBeCloseTo(4);
  });
});
