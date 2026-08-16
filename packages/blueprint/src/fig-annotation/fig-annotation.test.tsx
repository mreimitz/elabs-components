import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { FigAnnotation } from "./fig-annotation";

afterEach(cleanup);

describe("FigAnnotation", () => {
  it("zero-pads a numeric figure number", () => {
    const { getByText } = render(<FigAnnotation figNumber={1} />);
    expect(getByText("FIG. 01")).toBeInTheDocument();
  });

  it("renders the caption", () => {
    const { getByText } = render(<FigAnnotation figNumber={3} caption="A caption" />);
    expect(getByText("A caption")).toBeInTheDocument();
  });

  it("renders as a <figcaption> by default and forwards ref + className", () => {
    const ref = createRef<HTMLElement>();
    const { getByText } = render(<FigAnnotation ref={ref} figNumber="A" className="custom" />);
    const root = getByText("FIG. A").parentElement;
    expect(root?.tagName.toLowerCase()).toBe("figcaption");
    expect(root).toHaveClass("custom");
    expect(ref.current).toBe(root);
  });
});
