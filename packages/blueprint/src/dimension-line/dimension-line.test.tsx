import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { DimensionLine } from "./dimension-line";

afterEach(cleanup);

describe("DimensionLine", () => {
  it("exposes the measurement as a labelled image", () => {
    const { getByRole } = render(<DimensionLine label="120 mm" />);
    expect(getByRole("img", { name: "120 mm" })).toBeInTheDocument();
  });

  it("renders the label text and a measure line", () => {
    const { getByText, container } = render(<DimensionLine label="42 px" />);
    expect(getByText("42 px")).toBeInTheDocument();
    expect(container.querySelector("line")).toBeTruthy();
  });

  it("supports a vertical orientation", () => {
    const { getByRole } = render(<DimensionLine label="64 mm" orientation="vertical" />);
    expect(getByRole("img", { name: "64 mm" })).toBeInTheDocument();
  });

  it("forwards ref + className", () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(<DimensionLine ref={ref} label="x" className="text-rule" />);
    expect(ref.current).toBe(container.querySelector("svg"));
  });

  // Issue #24: the measure label must carry extra weight so it reads on the
  // saturated blueprint ground (perceived dimness, not a contrast failure).
  it("renders the measure label with a heavier weight (horizontal)", () => {
    const { getByText } = render(<DimensionLine label="120 mm" />);
    expect(getByText("120 mm").getAttribute("class")).toMatch(/font-medium/);
  });

  it("renders the measure label with a heavier weight (vertical)", () => {
    const { getByText } = render(<DimensionLine label="64 mm" orientation="vertical" />);
    expect(getByText("64 mm").getAttribute("class")).toMatch(/font-medium/);
  });
});
